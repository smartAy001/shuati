"""试题集与题目的接口：上传解析、列表、查看、编辑、删除。

上传采用后台任务 + 进度轮询（解析/OCR 可能较慢）。
"""
import json
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import config, database, tasks
from ..services import ocr as ocr_svc
from ..services import parser as parser_svc
from ..services import structurer as struct
from ..utils import serialize_question

router = APIRouter(prefix="/api/sets", tags=["sets"])

DEFAULT_SCORES = {"single": 2, "multiple": 2, "judge": 1, "fill": 3, "short": 10}

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _extract_text(path: Path, ext: str):
    """按扩展名提取文字，返回 (text, source_type)。用于答案文件等无进度场景。"""
    if ext == ".pdf":
        text = parser_svc.extract_pdf(str(path))
        if len(text.strip()) < 20:
            text = ocr_svc.ocr_pdf(str(path))
        return text, "pdf"
    if ext == ".docx":
        return parser_svc.extract_docx(str(path)), "word"
    if ext == ".doc":
        raise ValueError("暂不支持旧版 .doc，请用 Word 另存为 .docx 后上传")
    if ext in IMG_EXTS:
        return ocr_svc.ocr_image(str(path)), "image"
    raise ValueError(f"不支持的文件格式：{ext}")


def _process_files(file_paths, answer_path, has_answers, answer_location, title, progress):
    """后台线程：解析文件 → 结构化 → 入库。file_paths: [(path, ext, 原名), ...]"""
    texts = []
    source_types = set()
    total = len(file_paths)

    for fi, (p, ext, oname) in enumerate(file_paths, 1):
        path = Path(p)
        try:
            if ext == ".pdf":
                progress(
                    message=f"正在解析 PDF（第 {fi}/{total} 个文件）",
                    progress=5 + int(fi / total * 5),
                )
                text = parser_svc.extract_pdf(str(path))
                if len(text.strip()) < 20:
                    text = ocr_svc.ocr_pdf(
                        str(path),
                        progress_cb=lambda cur, tot: progress(
                            message=f"OCR 识别第 {cur}/{tot} 页",
                            progress=10 + int(cur / tot * 75),
                        ),
                    )
                st = "pdf"
            elif ext == ".docx":
                progress(message=f"正在解析 Word（第 {fi}/{total} 个文件）")
                text = parser_svc.extract_docx(str(path))
                st = "word"
            elif ext in IMG_EXTS:
                progress(message=f"正在识别图片（第 {fi}/{total} 个文件）")
                text = ocr_svc.ocr_image(str(path))
                st = "image"
            else:
                raise ValueError(f"不支持的文件格式：{ext}")

            if text.strip():
                texts.append(text)
                source_types.add(st)
        finally:
            path.unlink(missing_ok=True)

    if not texts:
        raise ValueError("未能从文件解析出文字，请确认文件内容或更换文件")

    progress(message="正在结构化题目", progress=90)

    answer_text = ""
    if answer_path:
        ap = Path(answer_path)
        try:
            answer_text, _ = _extract_text(ap, ap.suffix.lower())
        finally:
            ap.unlink(missing_ok=True)

    questions = struct.process(
        "\n\n".join(texts), bool(has_answers), answer_location, answer_text
    )
    questions = [q for q in questions if q.get("stem")]
    if not questions:
        raise ValueError("未能识别出题目，请检查文件内容或手动整理")

    for q in questions:
        q["score"] = DEFAULT_SCORES.get(q["type"], 5)

    progress(message="正在保存", progress=95)

    now = time.strftime("%Y-%m-%d %H:%M:%S")
    file_name = file_paths[0][2] if file_paths else ""
    conn = database.get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO question_set(title, file_name, has_answers, answer_location, source_type, created_at) "
            "VALUES(?,?,?,?,?,?)",
            (
                title or file_name,
                file_name,
                int(bool(has_answers)),
                answer_location,
                ",".join(sorted(source_types)),
                now,
            ),
        )
        set_id = cur.lastrowid
        for q in questions:
            conn.execute(
                "INSERT INTO question(set_id, number, type, stem, options, answer, explanation, score) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (
                    set_id,
                    q["number"],
                    q["type"],
                    q["stem"],
                    json.dumps(q["options"], ensure_ascii=False),
                    q["answer"],
                    q["explanation"],
                    q["score"],
                ),
            )
        conn.commit()
    finally:
        conn.close()

    return {
        "set_id": set_id,
        "title": title or file_name,
        "has_answers": bool(has_answers),
        "answer_location": answer_location,
        "questions": questions,
    }


@router.post("/upload")
async def upload(
    files: list[UploadFile] = File(...),
    answer_file: UploadFile | None = File(None),
    has_answers: int = Form(0),
    answer_location: str = Form("auto"),
    title: str = Form(""),
):
    if not files:
        raise HTTPException(400, "请选择题目文件")

    saved = []
    try:
        for f in files:
            data = await f.read()
            if not data:
                continue
            if len(data) > config.MAX_FILE_SIZE:
                raise HTTPException(
                    400,
                    f"文件「{f.filename}」为 {len(data) / 1024 / 1024:.1f} MB，超过单文件上限 "
                    f"{config.MAX_FILE_SIZE // 1024 // 1024} MB，请拆分后上传",
                )
            ext = Path(f.filename or "").suffix.lower()
            p = config.UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
            p.write_bytes(data)
            saved.append((str(p), ext, f.filename or ""))

        if not saved:
            raise HTTPException(400, "未收到有效文件")

        answer_path = None
        if answer_file is not None:
            data = await answer_file.read()
            if len(data) > config.MAX_FILE_SIZE:
                raise HTTPException(400, "答案文件超过大小限制，请拆分")
            ext = Path(answer_file.filename or "").suffix.lower()
            p = config.UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
            p.write_bytes(data)
            answer_path = str(p)
    except HTTPException:
        for p, _, _ in saved:
            Path(p).unlink(missing_ok=True)
        raise

    task_id = tasks.run(
        lambda progress: _process_files(
            saved, answer_path, bool(has_answers), answer_location, title, progress
        )
    )
    return {"task_id": task_id}


@router.get("")
def list_sets():
    conn = database.get_conn()
    try:
        rows = conn.execute(
            "SELECT s.*, "
            "(SELECT COUNT(*) FROM question q WHERE q.set_id = s.id) AS qcount, "
            "(SELECT id FROM practice_session ps WHERE ps.set_id = s.id AND ps.status='in_progress' "
            " AND ps.session_type='practice' ORDER BY ps.id DESC LIMIT 1) AS unfinished_id "
            "FROM question_set s ORDER BY s.id DESC"
        ).fetchall()
    finally:
        conn.close()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "file_name": r["file_name"],
            "has_answers": bool(r["has_answers"]),
            "answer_location": r["answer_location"],
            "source_type": r["source_type"],
            "created_at": r["created_at"],
            "question_count": r["qcount"],
            "unfinished_id": r["unfinished_id"],
        }
        for r in rows
    ]


@router.get("/{set_id}")
def get_set(set_id: int):
    conn = database.get_conn()
    try:
        srow = conn.execute("SELECT * FROM question_set WHERE id=?", (set_id,)).fetchone()
        if not srow:
            raise HTTPException(404, "试题集不存在")
        qrows = conn.execute(
            "SELECT * FROM question WHERE set_id=? ORDER BY number", (set_id,)
        ).fetchall()
    finally:
        conn.close()
    questions = [serialize_question(r) for r in qrows]
    return {
        "id": srow["id"],
        "title": srow["title"],
        "file_name": srow["file_name"],
        "has_answers": bool(srow["has_answers"]),
        "answer_location": srow["answer_location"],
        "source_type": srow["source_type"],
        "created_at": srow["created_at"],
        "questions": questions,
    }


@router.put("/{set_id}")
def update_set(set_id: int, payload: dict):
    conn = database.get_conn()
    try:
        srow = conn.execute("SELECT * FROM question_set WHERE id=?", (set_id,)).fetchone()
        if not srow:
            raise HTTPException(404, "试题集不存在")
        if payload.get("title"):
            conn.execute(
                "UPDATE question_set SET title=? WHERE id=?", (payload["title"], set_id)
            )
        if "questions" in payload:
            qs = payload["questions"]
            conn.execute("DELETE FROM question WHERE set_id=?", (set_id,))
            for i, q in enumerate(qs, 1):
                conn.execute(
                    "INSERT INTO question(set_id, number, type, stem, options, answer, explanation, score) "
                    "VALUES(?,?,?,?,?,?,?,?)",
                    (
                        set_id,
                        q.get("number", i),
                        q.get("type", "short"),
                        q.get("stem", ""),
                        json.dumps(q.get("options") or [], ensure_ascii=False),
                        q.get("answer") or "",
                        q.get("explanation") or "",
                        float(q.get("score") or 0),
                    ),
                )
        conn.commit()
    finally:
        conn.close()
    return get_set(set_id)


@router.delete("/{set_id}")
def delete_set(set_id: int):
    conn = database.get_conn()
    try:
        cur = conn.execute("DELETE FROM question_set WHERE id=?", (set_id,))
        conn.commit()
    finally:
        conn.close()
    if cur.rowcount == 0:
        raise HTTPException(404, "试题集不存在")
    return {"ok": True}
