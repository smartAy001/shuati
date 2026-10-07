"""后台任务管理：用于上传解析等耗时操作，支持进度查询。"""
import threading
import time
import uuid

_TASKS = {}
_LOCK = threading.Lock()


def create() -> str:
    tid = uuid.uuid4().hex
    with _LOCK:
        _TASKS[tid] = {
            "status": "processing",
            "progress": 0,
            "message": "准备中",
            "result": None,
            "error": None,
            "updated_at": time.time(),
        }
    return tid


def update(tid: str, **kw) -> None:
    with _LOCK:
        t = _TASKS.get(tid)
        if t:
            t.update(kw)
            t["updated_at"] = time.time()


def get(tid: str) -> dict:
    with _LOCK:
        t = _TASKS.get(tid)
        return dict(t) if t else {"status": "not_found"}


def run(fn) -> str:
    """启动一个后台任务。fn(progress) 会在后台线程中执行，返回 task_id。"""
    tid = create()

    def progress(**kw):
        update(tid, **kw)

    def runner():
        try:
            result = fn(progress)
            update(tid, status="done", progress=100, result=result)
        except Exception as e:  # noqa: BLE001
            update(tid, status="error", error=str(e))

    threading.Thread(target=runner, daemon=True).start()
    return tid
