"""题目结构化：把原始文字拆分成一道道结构化题目。

支持两类常见格式：
1. 带题号的题目：「1. 题干 … A. … B. … 答案：A 解析：…」
2. 无题号、选项挤一行的题目：「题干 … A. xx B. yy C. zz 答案：C 解析：…」

输出题目结构（dict）：
{
    "number": int,
    "type": "single" | "multiple" | "judge" | "fill" | "short",
    "stem": str,
    "options": [{"label": "A", "text": "..."}],
    "answer": str,
    "explanation": str,
}
"""
import re

# 题号起始（仅用于识别并跳过目录条目）
QUESTION_START = re.compile(
    r"^\s*(?:"
    r"(\d{1,3})\s*[.、．)）\]]"
    r"|[(（]\s*(\d{1,3})\s*[)）]"
    r"|第\s*(\d{1,3})\s*题"
    r"|([一二三四五六七八九十百]+)\s*[、.．]"
    r")"
)

# 选项行（整行以 A-H 标记开头）
OPTION_RE = re.compile(r"^\s*([A-Ha-h])\s*[.、．)）:：]\s*(.*)$")
# 答案行（整行以「答案：」开头）
ANSWER_RE = re.compile(r"^\s*(?:【\s*)?(?:参考\s*)?答案\s*(?:】)?\s*[:：]?\s*(.*)$")
# 解析行（整行以「解析：」开头）
EXPLAIN_RE = re.compile(r"^\s*(?:【\s*)?(?:解析|详解|解答|试题分析)\s*(?:】)?\s*[:：]?\s*(.*)$")

# 挤在一行的选项拆分点：A. / B、 / C． / D)（后带空格）等。
# 只认「字母 + 点/顿号」或「字母 + 括号/冒号 + 空格」；
# 且字母前不能是字母/数字/左括号，避免把「( IR)」「( PC)」「(C) 、零标志位」里的字母误判成选项。
OPTION_SPLIT = re.compile(r"(?<![A-Za-z0-9(（])(?=[A-Ha-h]\s*(?:[.．、]|[)）:：]\s))")

# 目录/章节标题等噪声
CHAPTER_RE = re.compile(r"^\s*第\s*[一二三四五六七八九十百0-9]+\s*[章节]")
YEAR_RE = re.compile(r"^\s*(?:19|20)\d{2}\s*[年]?\s*[上上下]?\s*半年\s*$")
NUMBERED_SHORT_RE = re.compile(r"^\s*\d{1,3}\s*[.、．]")

JUDGE_TRUE = {"对", "√", "正确", "T", "t", "是"}
JUDGE_FALSE = {"错", "×", "错误", "F", "f", "否"}


def normalize_answer(ans) -> str:
    """归一化答案：判断→对/错，选择题→大写字母串，其余→原文。"""
    if ans is None:
        return ""
    ans = ans.strip().strip("。.；;")
    if not ans:
        return ""
    if ans in JUDGE_TRUE:
        return "对"
    if ans in JUDGE_FALSE:
        return "错"
    # 纯字母（可能带分隔符）→ 视为选择题答案
    if re.fullmatch(r"[A-Ha-h,，、\s]+", ans):
        letters = re.findall(r"[A-Ha-h]", ans)
        if letters:
            return "".join(l.upper() for l in letters)
    return ans


def _split_inline_answer(ans: str):
    """处理「答案：A 解析：xxx」这种情况。"""
    for kw in ("解析", "详解", "解答"):
        if kw in ans:
            ans_part, _, expl_part = ans.partition(kw)
            return ans_part.strip(), expl_part.lstrip("：: ").strip()
    return ans.strip(), ""


def _parse_options_line(line: str):
    """解析选项行：可能是多个选项挤在一行，且行尾可能带「答案：X」。

    返回 (options, answer)，options 为 [{"label": "A", "text": "..."}]。
    若该行并非选项行，返回 ([], "")。
    """
    line = line.strip()
    answer = ""
    m = re.search(r"\s*答案\s*[:：]\s*([A-Ha-h][A-Ha-h,，、\s]*)\s*$", line)
    if m:
        answer = m.group(1).strip()
        line = line[: m.start()].rstrip()

    options = []
    for seg in OPTION_SPLIT.split(line):
        seg = seg.strip()
        if not seg:
            continue
        om = OPTION_RE.match(seg)
        if om:
            options.append({"label": om.group(1).upper(), "text": om.group(2).strip()})
    return options, answer


def _is_numbered_short(s: str) -> bool:
    """是否像目录条目：短小的「1. xxx」行。"""
    return bool(NUMBERED_SHORT_RE.match(s)) and len(s.strip()) <= 40


def _is_noise(s: str) -> bool:
    """章节标题 / 年份批次 / 考试大纲说明等噪声。"""
    if CHAPTER_RE.match(s):
        return True
    if YEAR_RE.match(s):
        return True
    if s.startswith("根据考试大纲"):
        return True
    return False


def detect_type(stem: str, options: list, answer: str) -> str:
    if len(options) >= 2:
        letters = re.findall(r"[A-H]", answer or "")
        return "multiple" if len(letters) > 1 else "single"
    if answer in ("对", "错"):
        return "judge"
    if re.search(r"_{2,}|（\s*）|\(\s*\)|【\s*】", stem) or "填空" in stem:
        return "fill"
    return "short"


def _next_nonblank(lines, i):
    j = i + 1
    while j < len(lines) and not lines[j].strip():
        j += 1
    return lines[j].strip() if j < len(lines) else ""


def _prev_nonblank(lines, i):
    j = i - 1
    while j >= 0 and not lines[j].strip():
        j -= 1
    return lines[j].strip() if j >= 0 else ""


def structure(text: str, with_answers: bool = True):
    """按行扫描，返回 (questions, answer_section)。"""
    main_text, ans_section = split_answer_section(text)
    lines = main_text.split("\n")
    n = len(lines)

    questions = []
    cur = None  # {"stem": [], "options": [], "answer": str, "explanation": []}

    def new_q():
        return {"stem": [], "options": [], "answer": "", "explanation": []}

    def finalize():
        nonlocal cur
        if cur is None:
            return
        stem = "\n".join(x.strip() for x in cur["stem"] if x.strip()).strip()
        stem = re.sub(r"^\s*\d{1,3}\s*[.、．)）]\s*", "", stem)
        explanation = "\n".join(x.strip() for x in cur["explanation"] if x.strip()).strip()
        answer = normalize_answer(cur["answer"]) if cur["answer"] else ""
        if stem or cur["options"] or answer or explanation:
            questions.append(
                {
                    "type": detect_type(stem, cur["options"], answer),
                    "stem": stem,
                    "options": cur["options"],
                    "answer": answer,
                    "explanation": explanation,
                }
            )
        cur = None

    i = 0
    while i < n:
        raw = lines[i]
        s = raw.strip()
        i += 1

        if not s:
            continue
        if _is_noise(s):
            continue
        # 目录条目：短小的编号行，且前后（忽略空行）有相邻编号行
        if _is_numbered_short(s):
            if _is_numbered_short(_prev_nonblank(lines, i - 1)) or _is_numbered_short(
                _next_nonblank(lines, i - 1)
            ):
                continue

        # 答案行（整行以「答案：」开头）
        if with_answers:
            am = ANSWER_RE.match(s)
            if am:
                if cur is None:
                    cur = new_q()
                ans, expl = _split_inline_answer(am.group(1))
                cur["answer"] = ans
                if expl:
                    cur["explanation"].append(expl)
                continue

            em = EXPLAIN_RE.match(s)
            if em:
                if cur is None:
                    cur = new_q()
                cur["explanation"].append(em.group(1))
                continue

        # 选项行（可能挤在一行，行尾可能带答案）
        opts, ans = _parse_options_line(raw)
        if opts:
            if cur is None:
                cur = new_q()
            cur["options"].extend(opts)
            if ans:
                cur["answer"] = ans
            continue

        # 其余为普通文字（题干或解析续文）
        next_struct = False
        if i < n:
            ns = lines[i].strip()
            next_struct = (
                bool(_parse_options_line(lines[i])[0])
                or bool(ANSWER_RE.match(ns))
                or bool(EXPLAIN_RE.match(ns))
            )

        if cur is None:
            cur = new_q()
            cur["stem"].append(raw)
        elif not (cur["options"] or cur["answer"] or cur["explanation"]):
            # 仍处于题干阶段（多行题干）
            cur["stem"].append(raw)
        elif next_struct:
            # 上一题已结束，这是新题题干
            finalize()
            cur = new_q()
            cur["stem"].append(raw)
        else:
            # 解析续文
            cur["explanation"].append(raw)

    finalize()
    for idx, q in enumerate(questions, 1):
        q["number"] = idx
    return questions, ans_section


def split_answer_section(text: str):
    """把末尾独立的「参考答案」区块从正文中切出来，返回 (正文, 答案区块)。"""
    lines = text.split("\n")
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if re.fullmatch(r"(?:【\s*)?(?:参考\s*)?答案\s*(?:】)?\s*[:：]?\s*", line) and i > 0:
            return "\n".join(lines[:i]), "\n".join(lines[i:])
    return text, ""


def parse_answer_list(text: str) -> dict:
    """从「1.A 2.B 3.C」这类答案文本中解析 {题号: 答案}。"""
    result = {}
    if not text:
        return result
    pat = re.compile(
        r"(\d{1,3})\s*[.、．)）]?\s*[:：]?\s*"
        r"([A-Ha-h对错√×正确错误]+(?:[、,，\s]+[A-Ha-h对错√×正确错误]+)*)"
    )
    for m in pat.finditer(text):
        num = int(m.group(1))
        result[num] = normalize_answer(m.group(2))
    return result


def attach(questions: list, amap: dict) -> None:
    for q in questions:
        n = q["number"]
        if n in amap:
            q["answer"] = amap[n]


def _split_multi_blank(questions: list) -> list:
    """把「一题多空」拆成多道单选题。

    共享题干里含 (1)(2)(3) 多个空，选项按「每空 4 个（A-D）」连续排列，
    答案如「CD」表示第 1 空选 C、第 2 空选 D。
    """
    out = []
    for q in questions:
        letters = re.findall(r"[A-H]", q.get("answer") or "")
        opts = q.get("options") or []
        k = len(letters)
        # 每空 4 个选项、共 k 空：选项数 == 4k 且 >= 8
        if k > 1 and len(opts) >= 8 and len(opts) % 4 == 0 and len(opts) // 4 == k:
            per = 4
            expl = q.get("explanation") or ""
            for i in range(k):
                sub_opts = opts[i * per:(i + 1) * per]
                sub = dict(q)
                sub["options"] = sub_opts
                sub["answer"] = letters[i]
                sub["type"] = detect_type(q.get("stem", ""), sub_opts, letters[i])
                sub["explanation"] = expl
                out.append(sub)
        else:
            out.append(q)
    return out


def _is_garbage_stem(stem: str) -> bool:
    """识别表格碎片等非题干文本：几乎无中文、内容短小。"""
    s = (stem or "").strip()
    if len(s) < 3:
        return True
    cjk = len(re.findall(r"[一-鿿]", s))
    return cjk < 3 and len(s) < 30


def _postprocess(questions: list) -> list:
    """拆分一题多空、剔除表格碎片垃圾题。"""
    questions = _split_multi_blank(questions)
    questions = [
        q
        for q in questions
        if not (q["type"] in ("short", "multiple") and _is_garbage_stem(q["stem"]))
    ]
    for idx, q in enumerate(questions, 1):
        q["number"] = idx
    return questions


def process(text: str, has_answers: bool, answer_location: str = "auto", answer_text: str = ""):
    """按答案位置模式处理，返回结构化题目列表。"""
    questions, ans_section = structure(text, with_answers=has_answers)
    if not has_answers:
        return _postprocess(questions)

    if answer_location == "inline":
        pass  # 答案已在题目内解析出来
    elif answer_location == "end":
        attach(questions, parse_answer_list(ans_section))
    elif answer_location == "separate":
        attach(questions, parse_answer_list(answer_text))
    else:  # auto
        inline_count = sum(1 for q in questions if q.get("answer"))
        if inline_count >= max(1, int(len(questions) * 0.6)):
            pass
        else:
            amap = parse_answer_list(ans_section)
            if amap:
                attach(questions, amap)
            elif answer_text:
                attach(questions, parse_answer_list(answer_text))
    return _postprocess(questions)
