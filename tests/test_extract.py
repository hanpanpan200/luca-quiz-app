"""题库提取器测试：验证从官方 HTML 提取的结构化数据正确无误。"""
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT / "tools"))

import extract  # noqa: E402


def load_all():
    return extract.parse_all(PROJECT / "raw")


def test_question_counts():
    """与官方页面标注的题数一致（93/36/45，共 174 题）。"""
    banks = load_all()
    counts = {b["name"]: len(b["questions"]) for b in banks}
    assert counts == {"基础版": 93, "进阶版": 36, "高阶版": 45}


def test_bank_chapters():
    banks = load_all()
    for b in banks:
        assert len(b["chapters"]) == 4, f"{b['name']} 章节数应为 4"


def test_first_question_spotcheck():
    banks = load_all()
    basic = banks[0]
    q = basic["questions"][0]
    assert q["text"] == "芯片像我们身体的哪个部分？"
    assert q["options"] == ["像大脑一样会思考", "像脚一样会走路", "像头发一样会长长", "像嘴巴一样会吃东西"]
    assert q["answer"] == "A"
    assert q["needs_review"] is False


def test_stale_number_prefix_cleaned():
    banks = load_all()
    texts = [q["text"] for q in banks[0]["questions"]]
    assert "芯片的小脚丫是用来做什么的？" in texts  # 原文为 "5. 芯片的小脚丫…"
    assert not any(t[:2].rstrip(".").isdigit() for t in texts), "所有题干不应残留编号前缀"


def test_no_unanswered_questions():
    """源数据修复后不应再有未标注答案的题目。"""
    banks = load_all()
    review = [q for b in banks for q in b["questions"] if q["needs_review"]]
    assert review == []


def test_unanswered_badge_flagged():
    """提取器仍应能识别"未标注"徽标并置 needs_review（内联样例验证）。"""
    html = """
    <section class="chapter" id="ch1">
      <h2><span class="ch-num">1</span>I、测试<span class="ch-count">1 题</span></h2>
      <div class="q-list"><div class="q-card">
      <div class="q-head">
        <span class="q-no">1</span>
        <span class="q-text">测试题？</span>
        <span class="ans-badge none">未标注</span>
      </div>
      <ul class="options"><li class="opt"><span class="opt-letter">A.</span> <span class="opt-text">甲</span></li><li class="opt"><span class="opt-letter">B.</span> <span class="opt-text">乙</span></li><li class="opt"><span class="opt-letter">C.</span> <span class="opt-text">丙</span></li><li class="opt"><span class="opt-letter">D.</span> <span class="opt-text">丁</span></li></ul>
    </div></div>
    </section>
    """
    q = extract.parse_bank(html, "测试版")["questions"][0]
    assert q["needs_review"] is True
    assert q["answer"] is None
    assert q["correct_idx"] is None


def test_corrected_answers_spotcheck():
    """人工核实的两处答案修正：电机→D（提供力量），逻辑门组合→A（复杂逻辑电路）。"""
    banks = load_all()
    questions = {q["id"]: q for b in banks for q in b["questions"]}
    motor = questions["基础版-3-30"]
    assert motor["text"] == "电机的作用主要作用是什么？"
    assert motor["answer"] == "D"
    assert motor["correct_idx"] == 3
    assert motor["needs_review"] is False
    gates = questions["高阶版-1-8"]
    assert gates["text"] == "多个逻辑门组合起来可以形成什么？"
    assert gates["answer"] == "A"
    assert gates["correct_idx"] == 0
    assert gates["needs_review"] is False


def test_answer_letter_matches_correct_option():
    """交叉验证：徽标答案字母必须与标了 correct class 的选项一致。"""
    banks = load_all()
    for b in banks:
        for q in b["questions"]:
            if q["needs_review"]:
                continue
            assert q["answer"] in ("A", "B", "C", "D"), q
            idx = "ABCD".index(q["answer"])
            assert q.get("correct_idx") == idx, q["text"]


def test_all_questions_have_four_options_and_unique_ids():
    banks = load_all()
    ids = []
    for b in banks:
        for q in b["questions"]:
            assert len(q["options"]) == 4, q["text"]
            assert all(q["options"]), q["text"]
            ids.append(q["id"])
    assert len(ids) == len(set(ids)), "题目 ID 必须唯一"


def test_chapter_assignment():
    banks = load_all()
    basic = banks[0]
    ch1 = [q for q in basic["questions"] if q["chapter"] == basic["chapters"][0]]
    assert len(ch1) == 9  # 官方标注 I、芯片原理 9 题
