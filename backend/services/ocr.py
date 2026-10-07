"""OCR 识别（图片 / 扫描版 PDF），基于 RapidOCR（本地离线）。

- 逐页渲染 + 识别，避免一次性把所有页面图片载入内存
- 多线程并行识别（每个线程各自持有引擎，线程安全）
- 支持进度回调
"""
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

_thread_local = threading.local()


def get_engine():
    eng = getattr(_thread_local, "engine", None)
    if eng is None:
        from rapidocr_onnxruntime import RapidOCR

        eng = RapidOCR()
        _thread_local.engine = eng
    return eng


def _run(engine, content) -> str:
    try:
        result, _ = engine(content)
    except Exception:
        result = engine(content)
    if not result:
        return ""
    lines = []
    for item in result:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            lines.append(str(item[1]))
        else:
            lines.append(str(item))
    return "\n".join(lines)


def _render_page(page):
    import cv2
    import numpy as np

    pix = page.get_pixmap(dpi=200)
    buf = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, pix.n
    )
    if pix.n == 4:
        return cv2.cvtColor(buf, cv2.COLOR_RGBA2BGR)
    if pix.n == 3:
        return cv2.cvtColor(buf, cv2.COLOR_RGB2BGR)
    return cv2.cvtColor(buf, cv2.COLOR_GRAY2BGR)


def ocr_image(path) -> str:
    return _run(get_engine(), str(path))


def ocr_pdf(path, progress_cb=None, workers: int = 3) -> str:
    """OCR 识别扫描版 PDF，逐页处理并报告进度。progress_cb(cur, total)。"""
    import fitz

    doc = fitz.open(path)
    total = doc.page_count
    texts = [None] * total
    render_lock = threading.Lock()

    def do_page(i):
        with render_lock:
            img = _render_page(doc[i])
        return _run(get_engine(), img)

    done = 0
    done_lock = threading.Lock()

    def report(cur, tot):
        if progress_cb:
            progress_cb(cur, tot)

    if total <= 1 or workers <= 1:
        for i in range(total):
            texts[i] = do_page(i)
            done += 1
            report(done, total)
    else:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            future_map = {ex.submit(do_page, i): i for i in range(total)}
            for fut in as_completed(future_map):
                i = future_map[fut]
                texts[i] = fut.result()
                with done_lock:
                    done += 1
                    report(done, total)

    doc.close()
    return "\n".join(t for t in texts if t)
