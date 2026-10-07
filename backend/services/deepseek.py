"""DeepSeek API 调用：生成答案与解析、主观题评分。"""
import json
import re

import httpx

from .. import config

TYPE_LABELS = {
    "single": "单选题",
    "multiple": "多选题",
    "judge": "判断题",
    "fill": "填空题",
    "short": "简答题/主观题",
}


async def _chat(messages: list, temperature: float = 0.3) -> str:
    cfg = config.get_config()
    if not cfg.get("api_key"):
        raise RuntimeError("未配置 DeepSeek API Key，请先在「设置」中填写")
    url = cfg["base_url"].rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg['api_key']}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": cfg["model"],
        "messages": messages,
        "temperature": temperature,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(url, json=payload, headers=headers)
    if r.status_code != 200:
        raise RuntimeError(f"DeepSeek 调用失败（{r.status_code}）：{r.text[:300]}")
    return r.json()["choices"][0]["message"]["content"]


def _extract_json(text: str):
    text = re.sub(r"```(?:json)?", "", text).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


def _question_text(q: dict) -> str:
    lines = [f"题目类型：{TYPE_LABELS.get(q['type'], '简答题')}", f"题干：{q['stem']}"]
    if q.get("options"):
        lines.append("选项：")
        for o in q["options"]:
            lines.append(f"{o['label']}. {o['text']}")
    return "\n".join(lines)


async def generate_answer(q: dict) -> dict:
    """生成答案 + 解析。"""
    prompt = _question_text(q)
    messages = [
        {
            "role": "system",
            "content": "你是刷题软件的答案解析助手。请解答题目并给出简洁解析，"
            "严格只输出一个 JSON 对象，不要输出其它内容。",
        },
        {
            "role": "user",
            "content": prompt
            + '\n\n请严格按以下格式输出：{"answer": "答案", "explanation": "解析"}',
        },
    ]
    content = await _chat(messages)
    data = _extract_json(content)
    if not data:
        return {"answer": content.strip(), "explanation": ""}
    return {
        "answer": str(data.get("answer", "")).strip(),
        "explanation": str(data.get("explanation", "")).strip(),
    }


async def score_subjective(q: dict, user_answer: str, max_score: float) -> dict:
    """按参考答案对主观题作答评分。"""
    ref = q.get("answer") or "（无参考答案，请根据题意自行评判）"
    prompt = "\n".join(
        [
            f"题目：{q['stem']}",
            f"参考答案：{ref}",
            f"用户作答：{user_answer}",
        ]
    )
    messages = [
        {
            "role": "system",
            "content": "你是一名阅卷老师。请根据参考答案对用户的主观题作答打分，"
            "并给出简短评分理由。严格只输出一个 JSON 对象。",
        },
        {
            "role": "user",
            "content": prompt
            + f'\n\n本题满分 {max_score} 分。请严格按格式输出：'
            f'{{"score": <0到{max_score}之间的数字>, "reason": "评分理由"}}',
        },
    ]
    content = await _chat(messages)
    data = _extract_json(content)
    if not data:
        return {"score": 0.0, "reason": content.strip()}
    try:
        s = float(data.get("score", 0))
    except (TypeError, ValueError):
        s = 0.0
    return {"score": s, "reason": str(data.get("reason", "")).strip()}
