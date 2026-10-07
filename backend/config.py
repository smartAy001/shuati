"""全局配置：路径、DeepSeek 配置的读写。"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
CONFIG_PATH = DATA_DIR / "config.json"
DB_PATH = DATA_DIR / "app.db"

for _d in (DATA_DIR, UPLOAD_DIR):
    _d.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 单文件上传上限 50MB

DEFAULT_CONFIG = {
    "api_key": "",
    "base_url": "https://api.deepseek.com",
    "model": "deepseek-chat",
}


def get_config() -> dict:
    """读取配置：config.json（界面修改）优先，其次 .env 环境变量，最后默认值。"""
    cfg = dict(DEFAULT_CONFIG)
    cfg["api_key"] = os.getenv("DEEPSEEK_API_KEY", "")
    cfg["base_url"] = os.getenv("DEEPSEEK_BASE_URL", DEFAULT_CONFIG["base_url"])
    cfg["model"] = os.getenv("DEEPSEEK_MODEL", DEFAULT_CONFIG["model"])

    if CONFIG_PATH.exists():
        try:
            saved = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            for k in DEFAULT_CONFIG:
                if k in saved and saved[k] not in (None, ""):
                    cfg[k] = saved[k]
        except Exception:
            pass
    return cfg


def save_config(new_cfg: dict) -> dict:
    """保存配置（只覆盖传入的非空字段）。"""
    cfg = get_config()
    for k in DEFAULT_CONFIG:
        if k in new_cfg and new_cfg[k] is not None:
            cfg[k] = new_cfg[k]
    CONFIG_PATH.write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return cfg
