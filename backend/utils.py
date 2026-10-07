"""公共小工具。"""
import json


def serialize_question(row) -> dict:
    return {
        "id": row["id"],
        "number": row["number"],
        "type": row["type"],
        "stem": row["stem"] or "",
        "options": json.loads(row["options"] or "[]"),
        "answer": row["answer"] or "",
        "explanation": row["explanation"] or "",
        "score": row["score"] or 0,
    }


def qmarks(n: int) -> str:
    return ",".join("?" * n)
