"""刷题会话：创建、进度保存、交卷判分（含 DeepSeek 生成/评分）。"""
import asyncio
import json
import random
import time

from fastapi import APIRouter, HTTPException

from .. import config, database
from ..services import deepseek
from ..services.structurer import normalize_answer
from ..utils import qmarks, serialize_question

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

OBJECTIVE_TYPES = {"single", "multiple", "judge", "fill"}


def _load_session(conn, session_id):
    sess = conn.execute(
        "SELECT * FROM practice_session WHERE id=?", (session_id,)
    ).fetchone()
    if not sess:
        raise HTTPException(404, "会话不存在")
    return sess


def _result_payload(conn, sess):
    srow = conn.execute(
        "SELECT * FROM question_set WHERE id=?", (sess["set_id"],)
    ).fetchone()
    qids = json.loads(sess["question_order"] or "[]")
    if not qids:
        qmap = {}
    else:
        qmap = {
            r["id"]: serialize_question(r)
            for r in conn.execute(
                f"SELECT * FROM question WHERE id IN ({qmarks(len(qids))})", qids
            ).fetchall()
        }
    questions = [qmap[qid] for qid in qids if qid in qmap]

    submitted = sess["status"] == "submitted"
    if not submitted:
        # 刷题中隐藏答案与解析，防止直接看到
        for q in questions:
            q["answer"] = ""
            q["explanation"] = ""

    return {
        "id": sess["id"],
        "set_id": sess["set_id"],
        "title": srow["title"] if srow else "",
        "has_answers": bool(srow["has_answers"]) if srow else False,
        "mode": sess["mode"],
        "status": sess["status"],
        "answers": json.loads(sess["answers"] or "{}"),
        "results": json.loads(sess["results"] or "{}"),
        "total_score": sess["total_score"] or 0,
        "correct_count": sess["correct_count"] or 0,
        "created_at": sess["created_at"],
        "submitted_at": sess["submitted_at"],
        "questions": questions,
    }


@router.post("")
def create_session(set_id: int, mode: str = "order"):
    conn = database.get_conn()
    try:
        srow = conn.execute("SELECT * FROM question_set WHERE id=?", (set_id,)).fetchone()
        if not srow:
            raise HTTPException(404, "试题集不存在")
        qids = [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM question WHERE set_id=? ORDER BY number", (set_id,)
            ).fetchall()
        ]
        if not qids:
            raise HTTPException(400, "该试题集没有题目")

        if mode == "random":
            random.shuffle(qids)
        elif mode == "wrong":
            wrong = set()
            for s in conn.execute(
                "SELECT results FROM practice_session WHERE set_id=? AND status='submitted'",
                (set_id,),
            ).fetchall():
                for qid, r in (json.loads(s["results"] or "{}")).items():
                    if not r.get("correct"):
                        wrong.add(int(qid))
            if wrong:
                qids = [q for q in qids if q in wrong]

        now = time.strftime("%Y-%m-%d %H:%M:%S")
        cur = conn.execute(
            "INSERT INTO practice_session(set_id, mode, status, question_order, answers, scores, results, created_at) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (set_id, mode, "in_progress", json.dumps(qids), "{}", "{}", "{}", now),
        )
        sid = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    return get_session(sid)


@router.get("/{session_id}")
def get_session(session_id: int):
    conn = database.get_conn()
    try:
        sess = _load_session(conn, session_id)
        return _result_payload(conn, sess)
    finally:
        conn.close()


@router.put("/{session_id}/answer")
def save_answer(session_id: int, payload: dict):
    qid = payload.get("question_id")
    answer = payload.get("answer", "")
    if qid is None:
        raise HTTPException(400, "缺少 question_id")
    conn = database.get_conn()
    try:
        sess = _load_session(conn, session_id)
        if sess["status"] == "submitted":
            raise HTTPException(400, "已交卷，不能再修改答案")
        answers = json.loads(sess["answers"] or "{}")
        answers[str(qid)] = answer
        conn.execute(
            "UPDATE practice_session SET answers=? WHERE id=?",
            (json.dumps(answers, ensure_ascii=False), session_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@router.post("/{session_id}/submit")
async def submit(session_id: int):
    conn = database.get_conn()
    try:
        sess = _load_session(conn, session_id)
        if sess["status"] == "submitted":
            return _result_payload(conn, sess)

        set_id = sess["set_id"]
        srow = conn.execute("SELECT * FROM question_set WHERE id=?", (set_id,)).fetchone()
        qids = json.loads(sess["question_order"] or "[]")
        answers = json.loads(sess["answers"] or "{}")

        if not qids:
            raise HTTPException(400, "没有题目")

        qmap = {
            r["id"]: serialize_question(r)
            for r in conn.execute(
                f"SELECT * FROM question WHERE id IN ({qmarks(len(qids))})", qids
            ).fetchall()
        }

        has_answers = bool(srow["has_answers"])

        # 无答案文件 → 先调用 DeepSeek 生成答案与解析
        if not has_answers:
            if not config.get_config().get("api_key"):
                raise HTTPException(
                    400, "该试题集无自带答案，请先在「设置」中配置 DeepSeek API Key"
                )
            sem = asyncio.Semaphore(3)

            async def gen_one(qid):
                async with sem:
                    res = await deepseek.generate_answer(qmap[qid])
                return qid, res

            gen_results = await asyncio.gather(
                *[gen_one(qid) for qid in qids]
            )
            for qid, res in gen_results:
                conn.execute(
                    "UPDATE question SET answer=?, explanation=? WHERE id=?",
                    (res["answer"], res["explanation"], qid),
                )
                qmap[qid]["answer"] = res["answer"]
                qmap[qid]["explanation"] = res["explanation"]
            conn.commit()

        # 判分
        results = {}
        total = 0.0
        correct = 0
        for qid in qids:
            q = qmap[qid]
            r = await _judge(q, answers.get(str(qid), ""))
            results[str(qid)] = r
            total += r["score"]
            if r["correct"]:
                correct += 1

        now = time.strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(
            "UPDATE practice_session SET status='submitted', results=?, scores=?, "
            "total_score=?, correct_count=?, submitted_at=? WHERE id=?",
            (
                json.dumps(results, ensure_ascii=False),
                json.dumps({str(qid): results[str(qid)]["score"] for qid in qids}),
                total,
                correct,
                now,
                session_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_session(session_id)


async def _judge(q: dict, user_answer: str):
    """对单题判分，返回 {correct, user_answer, score, reason}。"""
    qtype = q["type"]
    ref = (q["answer"] or "").strip()
    score = float(q["score"] or 0)
    user_answer = (user_answer or "").strip()

    if qtype in ("single", "multiple"):
        user_norm = normalize_answer(user_answer)
        correct = bool(user_norm) and user_norm == ref
        return {
            "correct": correct,
            "user_answer": user_answer,
            "score": score if correct else 0.0,
        }

    if qtype == "judge":
        user_norm = normalize_answer(user_answer)
        correct = bool(user_norm) and user_norm == ref
        return {
            "correct": correct,
            "user_answer": user_answer,
            "score": score if correct else 0.0,
        }

    if qtype == "fill":
        correct = user_answer == ref
        return {
            "correct": correct,
            "user_answer": user_answer,
            "score": score if correct else 0.0,
        }

    # 主观题
    if ref and user_answer:
        try:
            res = await deepseek.score_subjective(q, user_answer, score)
            s = min(max(float(res["score"]), 0.0), score)
        except Exception:  # DeepSeek 评分失败则不给分，保留作答
            return {
                "correct": False,
                "user_answer": user_answer,
                "score": 0.0,
                "reason": "AI 评分失败，请人工评判",
            }
        return {
            "correct": s >= score * 0.6,
            "user_answer": user_answer,
            "score": s,
            "reason": res["reason"],
        }

    return {"correct": False, "user_answer": user_answer, "score": 0.0, "reason": "未作答"}
