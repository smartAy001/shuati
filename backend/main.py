"""FastAPI 应用入口。"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, database, tasks
from .routers import config_router, sessions, sets

app = FastAPI(title="自定义刷题")

database.init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sets.router)
app.include_router(sessions.router)
app.include_router(config_router.router)


@app.get("/api/tasks/{task_id}")
def get_task(task_id: str):
    return tasks.get(task_id)


# 若前端已构建（frontend/dist 存在），则由后端直接托管，实现单命令启动
_dist = Path(config.BASE_DIR) / "frontend" / "dist"
if _dist.exists():
    _assets = _dist / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        candidate = _dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")
