"""PDF / Word 文字提取（文字版文件）。"""


def extract_pdf(path) -> str:
    """提取 PDF 全部页面的文字。"""
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    try:
        pages = [page.get_text("text") for page in doc]
    finally:
        doc.close()
    return "\n".join(pages)


def extract_docx(path) -> str:
    """提取 Word (.docx) 文字，按文档实际顺序（段落与表格穿插）输出。"""
    import docx
    from docx.oxml.ns import qn

    d = docx.Document(path)
    parts = []
    for child in d.element.body.iterchildren():
        tag = child.tag.split("}")[-1]
        if tag == "p":
            txt = "".join(node.text or "" for node in child.iter(qn("w:t")))
            if txt.strip():
                parts.append(txt)
        elif tag == "tbl":
            for tr in child.findall(qn("w:tr")):
                tcs = tr.findall(qn("w:tc"))
                cells = [
                    "".join(n.text or "" for n in tc.iter(qn("w:t"))).strip()
                    for tc in tcs
                ]
                if any(cells):
                    parts.append("  ".join(cells))
    return "\n".join(parts)
