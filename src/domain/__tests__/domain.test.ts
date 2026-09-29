import fs from "node:fs";
import path from "node:path";
import { CIRCUITS, QUESTIONS } from "../../data";
import { EXAM_QUOTA, EXAM_SIZE, PASS_SCORE, examScore, sampleExamQuestions } from "../aiExam";
import { VOICE_START, chipLimitMs, chipTimerStart, chipTimerStop, matchPhrase, recordChipAttempt, sampleCircuitExam } from "../chipRules";
import { recordAnswer, recordWrongQuiz } from "../aiRecords";
import { freshAiStore, freshChipStore } from "../../storage";

const LIMIT = chipLimitMs(CIRCUITS.time_limit_sec);

describe("AI 模拟考分层抽样", () => {
  it("配额总和 = EXAM_SIZE = 20", () => {
    expect(Object.values(EXAM_QUOTA).reduce((s, n) => s + n, 0)).toBe(EXAM_SIZE);
    expect(EXAM_SIZE).toBe(20);
  });

  it("三库各按配额精确抽取（重复200次）", () => {
    for (let k = 0; k < 200; k++) {
      const qs = sampleExamQuestions(QUESTIONS.banks, EXAM_QUOTA);
      const byBank: Record<string, number> = {};
      for (const q of qs) byBank[q.bank] = (byBank[q.bank] || 0) + 1;
      expect(byBank).toEqual(EXAM_QUOTA);
      expect(qs.length).toBe(EXAM_SIZE);
    }
  });

  it("某库可用题不足配额时从其余题补齐总数", () => {
    const banks = QUESTIONS.banks.map((b) =>
      b.name === "进阶版" ? { ...b, questions: b.questions.slice(0, 2) } : b);
    const qs = sampleExamQuestions(banks, EXAM_QUOTA);
    expect(qs.length).toBe(EXAM_SIZE);
    expect(qs.filter((q) => q.bank === "进阶版").length).toBe(2);
  });

  it("计分：20题全对=100，12对=60，与配额总数解耦", () => {
    expect(examScore(20, 20)).toBe(100);
    expect(examScore(12, 20)).toBe(60);
    expect(PASS_SCORE).toBe(60);
  });
});

describe("chip 计时状态机", () => {
  it("开始→计时中→完成记录用时", () => {
    const st = chipTimerStart("c01", 1000);
    expect(st.phase).toBe("timing");
    const done = chipTimerStop(st, 61000, LIMIT);
    expect(done).toEqual({ qid: "c01", ms: 60000, overtime: false });
  });

  it("超时判定：超过 180 秒记为 overtime，恰好180秒不算", () => {
    const st = chipTimerStart("c18", 0);
    expect(chipTimerStop(st, LIMIT + 1, LIMIT).overtime).toBe(true);
    expect(chipTimerStop(chipTimerStart("c19", 0), LIMIT, LIMIT).overtime).toBe(false);
  });
});

describe("语音触发词匹配", () => {
  it("去除空格标点后子串命中", () => {
    expect(matchPhrase("现在 开始 ！", VOICE_START)).toBe(true);
    expect(matchPhrase("我说开始计时了", VOICE_START)).toBe(true);
    expect(matchPhrase("还没准备好呢", VOICE_START)).toBe(false);
    expect(matchPhrase("我做完了。", ["我做完了", "做完了", "完成"])).toBe(true);
  });
});

describe("chip 模拟考抽样", () => {
  it("抽 4 题不重复", () => {
    for (let k = 0; k < 100; k++) {
      const qs = sampleCircuitExam(CIRCUITS.questions, 4);
      expect(qs.length).toBe(4);
      expect(new Set(qs.map((q) => q.id)).size).toBe(4);
    }
  });
});

describe("超时本规则", () => {
  it("超时进本；连续2次达标毕业", () => {
    const s = freshChipStore();
    const r1 = recordChipAttempt(s, "c22", LIMIT + 5000, LIMIT);
    expect(r1.overtime).toBe(true);
    expect(s.wrongBook).toContain("c22");
    recordChipAttempt(s, "c22", 100000, LIMIT);
    expect(s.wrongBook).toContain("c22"); // 1次达标不应毕业
    const r3 = recordChipAttempt(s, "c22", 120000, LIMIT);
    expect(r3.graduated).toBe(true);
    expect(s.wrongBook).not.toContain("c22");
  });

  it("达标后再超时重置连击", () => {
    const s = freshChipStore();
    recordChipAttempt(s, "c23", LIMIT + 1, LIMIT);
    recordChipAttempt(s, "c23", 100000, LIMIT);
    recordChipAttempt(s, "c23", LIMIT + 1, LIMIT); // 打断连击
    recordChipAttempt(s, "c23", 100000, LIMIT);    // 重新累计1次
    expect(s.wrongBook).toContain("c23");
  });
});

describe("AI 错题本规则", () => {
  it("答错进错题本；错题重刷连对2次毕业", () => {
    let s = freshAiStore();
    s = recordAnswer(s, "基础版-1-1", false);
    expect(s.wrongBook).toContain("基础版-1-1");
    s = recordWrongQuiz(s, "基础版-1-1", true);
    expect(s.wrongBook).toContain("基础版-1-1"); // 连对1次
    s = recordWrongQuiz(s, "基础版-1-1", true);
    expect(s.wrongBook).not.toContain("基础版-1-1"); // 连对2次毕业
    expect(s.graduated).toContain("基础版-1-1");
  });

  it("错题重刷答错重新计数", () => {
    let s = freshAiStore();
    s = recordAnswer(s, "基础版-1-2", false);
    s = recordWrongQuiz(s, "基础版-1-2", true);
    s = recordWrongQuiz(s, "基础版-1-2", false);
    s = recordWrongQuiz(s, "基础版-1-2", true);
    expect(s.wrongBook).toContain("基础版-1-2");
  });
});

describe("数据完整性", () => {
  it("AI 题库：174 题、id 唯一、四选项、答案字母与 correct_idx 一致", () => {
    const ids: string[] = [];
    for (const b of QUESTIONS.banks) {
      for (const q of b.questions) {
        expect(q.options.length).toBe(4);
        expect(q.options.every(Boolean)).toBe(true);
        if (!q.needs_review) {
          expect("ABCD".indexOf(q.answer)).toBe(q.correct_idx);
        }
        ids.push(q.id);
      }
    }
    expect(ids.length).toBe(174);
    expect(new Set(ids).size).toBe(174);
  });

  it("电路题库：60 题、image 为可服务完整路径且文件存在", () => {
    expect(CIRCUITS.questions.length).toBe(60);
    for (const q of CIRCUITS.questions) {
      if (!q.image) continue;
      expect(q.image.startsWith("assets/circuits/")).toBe(true);
      expect(fs.existsSync(path.join(process.cwd(), "public", q.image))).toBe(true);
    }
  });
});
