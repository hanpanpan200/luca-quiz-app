import { beforeEach, describe, expect, it } from "vitest";
import { SCIENCE_UNITS } from "../../data/science";
import { recordAnswer, recordWrongQuiz } from "../aiRecords";
import { SCIENCE_EXAM_SIZE, sampleScienceExam } from "../science";
import { freshAiStore, loadScienceStore, saveScienceStore, scienceKey } from "../../storage";

describe("科学板块·单元存储", () => {
  beforeEach(() => localStorage.clear());

  it("key 按 unitId 参数化，各单元进度互不干扰", () => {
    expect(scienceKey("g3a-u2")).toBe("swcode_science_g3a-u2_v1");
    expect(scienceKey("g3a-u3")).toBe("swcode_science_g3a-u3_v1");

    let s = freshAiStore();
    s = recordAnswer(s, "g3a-u2-1-1", false); // 答错进错题本
    saveScienceStore("g3a-u2", s);

    expect(loadScienceStore("g3a-u2").wrongBook).toEqual(["g3a-u2-1-1"]);
    expect(loadScienceStore("g3a-u3")).toEqual(freshAiStore());
  });

  it("非法 unitId 拒绝生成 key，防止写脏 localStorage", () => {
    expect(() => scienceKey("")).toThrow();
    expect(() => scienceKey("science")).toThrow();
    expect(() => scienceKey("g3a-u2.js")).toThrow();
    expect(() => scienceKey("../../etc")).toThrow();
  });

  it("损坏或形状不对的数据回退到空 store", () => {
    localStorage.setItem("swcode_science_g3a-u2_v1", "{oops");
    expect(loadScienceStore("g3a-u2")).toEqual(freshAiStore());
    localStorage.setItem("swcode_science_g3a-u2_v1", JSON.stringify({ answers: 123 }));
    expect(loadScienceStore("g3a-u2")).toEqual(freshAiStore());
  });

  it("与比赛题库的存储完全隔离", () => {
    let s = freshAiStore();
    s = recordAnswer(s, "g3a-u2-1-1", false);
    saveScienceStore("g3a-u2", s);
    // AI 比赛模块的 key 不受影响
    expect(localStorage.getItem("swcode_quiz_v1")).toBeNull();
    expect(Object.keys(localStorage).sort()).toEqual(["swcode_science_g3a-u2_v1"]);
  });
});

describe("科学板块·模拟考抽题", () => {
  const unit = SCIENCE_UNITS.find((u) => u.id === "g3a-u2")!;

  it("默认抽 SCIENCE_EXAM_SIZE 题，无重复且都来自该单元题库", () => {
    for (let run = 0; run < 20; run++) {
      const exam = sampleScienceExam(unit.questions);
      expect(exam).toHaveLength(SCIENCE_EXAM_SIZE);
      const ids = exam.map((q) => q.id);
      expect(new Set(ids).size).toBe(SCIENCE_EXAM_SIZE);
      for (const q of exam) expect(unit.questions).toContain(q);
    }
  });

  it("每课至少被抽到 1 题（考卷覆盖全部章节）", () => {
    for (let run = 0; run < 20; run++) {
      const chapters = new Set(sampleScienceExam(unit.questions).map((q) => q.chapter));
      for (const c of unit.chapters) expect(chapters).toContain(c);
    }
  });

  it("size 超过题库总量时返回全部题", () => {
    const all = sampleScienceExam(unit.questions, unit.questions.length + 100);
    expect(all).toHaveLength(unit.questions.length);
  });

  it("错题连对 2 次毕业的规则在科学 store 上同样生效", () => {
    let s = freshAiStore();
    s = recordAnswer(s, "g3a-u2-1-1", false);
    expect(s.wrongBook).toContain("g3a-u2-1-1");
    s = recordWrongQuiz(s, "g3a-u2-1-1", true);
    expect(s.wrongBook).toContain("g3a-u2-1-1"); // 连对 1 次还没毕业
    s = recordWrongQuiz(s, "g3a-u2-1-1", true);
    expect(s.wrongBook).not.toContain("g3a-u2-1-1");
    expect(s.graduated).toContain("g3a-u2-1-1");
  });
});

describe("科学板块·数据校验", () => {
  const UNIT_ID_RE = /^g\d[ab]-u\d+$/;

  it("单元 id 唯一且符合 g{年级}{a|b}-u{单元} 格式", () => {
    expect(SCIENCE_UNITS.length).toBeGreaterThan(0);
    const ids = SCIENCE_UNITS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of SCIENCE_UNITS) expect(u.id).toMatch(UNIT_ID_RE);
  });

  it("每个单元结构完整：章节注册、题量对得上", () => {
    for (const u of SCIENCE_UNITS) {
      expect(u.name.length).toBeGreaterThan(0);
      expect(u.chapters.length).toBeGreaterThan(0);
      expect(u.questions.length).toBeGreaterThanOrEqual(u.chapters.length);
      const chapterSet = new Set(u.chapters);
      for (const q of u.questions) expect(chapterSet).toContain(q.chapter);
    }
  });

  it("每道题：4 个选项、answer 与 correct_idx 一致、解析非空、id 前缀为单元 id 且唯一", () => {
    const letters = ["A", "B", "C", "D"];
    for (const u of SCIENCE_UNITS) {
      const seen = new Set<string>();
      for (const q of u.questions) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4); // 选项不重复
        expect(q.answer).toBe(letters[q.correct_idx]);
        expect(q.explanation.trim().length).toBeGreaterThan(0);
        expect(q.id.startsWith(`${u.id}-`)).toBe(true);
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
        expect(q.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("首个单元《水》是全覆盖题库（>= 60 题）", () => {
    const u2 = SCIENCE_UNITS.find((u) => u.id === "g3a-u2")!;
    expect(u2.name).toContain("水");
    expect(u2.questions.length).toBeGreaterThanOrEqual(60);
    expect(u2.chapters.length).toBe(9); // 8 节课 + 科学阅读
  });
});
