"""DeepSeek 配置的读取与保存。"""
from fastapi import APIRouter

from .. import config

router = APIRouter(prefix="/api/config", tags=["config"])


def _masked(key: str) -> str:
    if not key:
        return ""
    if len(key) > 8:
        return f"{key[:3]}****{key[-4:]}"
    return "****"


@router.get("")
def get_cfg():
    cfg = config.get_config()
    return {
        "has_api_key": bool(cfg["api_key"]),
        "api_key_masked": _masked(cfg["api_key"]),
        "base_url": cfg["base_url"],
        "model": cfg["model"],
    }


@router.post("")
def set_cfg(payload: dict):
    new = {}
    if "api_key" in payload:
        new["api_key"] = (payload.get("api_key") or "").strip()
    if payload.get("base_url"):
        new["base_url"] = payload["base_url"].strip()
    if payload.get("model"):
        new["model"] = payload["model"].strip()
    config.save_config(new)
    return get_cfg()
