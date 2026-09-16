"""从官方题库 HTML 提取结构化题目数据。

用法：python tools/extract.py  → 在项目根生成 questions.json
测试见 tests/test_extract.py。
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

BANK_FILES = [
    ("基础版", "bank_basic.html"),
    ("进阶版", "bank_advanced.html"),
    ("高阶版", "bank_master.html"),
]

Q_TEXT_RE = re.compile(r'<span class="q-text">(.*?)</span>', re.S)
Q_NO_RE = re.compile(r'<span class="q-no">(\d+)</span>')
ANSWER_RE = re.compile(r'<span class="ans-badge">参考答案：([A-D])</span>')
NEEDS_REVIEW_RE = re.compile(r'<span class="ans-badge none">')
OPT_RE = re.compile(
    r'<li class="opt( correct)?"><span class="opt-letter">([A-D])\.</span> '
    r'<span class="opt-text">(.*?)</span></li>'
)
PREFIX_RE = re.compile(r"^\d+\.\s*")


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return PREFIX_RE.sub("", text)


def parse_bank(html: str, name: str) -> dict:
    questions, chapters = [], []
    # 按 <section class="chapter" 切分，每段一个章节
    sections = re.split(r'<section class="chapter"[^>]*>', html)[1:]
    for ch_idx, section in enumerate(sections, start=1):
        m = re.search(r"<h2>.*?</span>(.*?)<span class=\"ch-count\">(\d+) 题</span></h2>", section, re.S)
        chapter_title = re.sub(r"\s+", "", m.group(1))
        chapters.append(chapter_title)
        for qno, card in enumerate(re.split(r'<div class="q-card">', section)[1:], start=1):
            q = parse_card(card)
            q["id"] = f"{name}-{ch_idx}-{qno}"
            q["bank"] = name
            q["chapter"] = chapter_title
            q["qno"] = qno
            questions.append(q)
    return {"name": name, "chapters": chapters, "questions": questions}


def parse_card(card: str) -> dict:
    text = clean_text(Q_TEXT_RE.search(card).group(1))
    options = [None, None, None, None]
    correct_idx = None
    for is_correct, letter, opt_text in OPT_RE.findall(card):
        idx = "ABCD".index(letter)
        options[idx] = re.sub(r"\s+", " ", opt_text).strip()
        if is_correct:
            correct_idx = idx
    m = ANSWER_RE.search(card)
    if m:
        answer = m.group(1)
        needs_review = False
        # 交叉验证：徽标与 correct 标记必须一致
        if correct_idx is not None and "ABCD".index(answer) != correct_idx:
            raise ValueError(f"答案不一致：{text}（徽标={answer}, correct={correct_idx}）")
    elif NEEDS_REVIEW_RE.search(card):
        answer, needs_review = None, True
    else:
        raise ValueError(f"无法解析答案：{text}")
    return {
        "text": text,
        "options": options,
        "answer": answer,
        "correct_idx": correct_idx,
        "needs_review": needs_review,
    }


def parse_all(raw_dir: Path) -> list:
    return [parse_bank((raw_dir / f).read_text(encoding="utf-8"), name) for name, f in BANK_FILES]


def main() -> None:
    project = Path(__file__).resolve().parent.parent
    banks = parse_all(project / "raw")
    data = {
        "generated_at": date.today().isoformat(),
        "banks": banks,
    }
    out = project / "questions.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(len(b["questions"]) for b in banks)
    review = sum(1 for b in banks for q in b["questions"] if q["needs_review"])
    print(f"✅ 已生成 {out.name}：{total} 题，待确认答案 {review} 题")
    for b in banks:
        per_ch = {c: 0 for c in b["chapters"]}
        for q in b["questions"]:
            per_ch[q["chapter"]] += 1
        detail = " / ".join(f"{c}{n}题" for c, n in per_ch.items())
        print(f"  {b['name']}：{len(b['questions'])} 题（{detail}）")


if __name__ == "__main__":
    sys.exit(main())
