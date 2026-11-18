import type { ScienceQuestion } from "../types";
import { shuffle } from "./utils";

export const SCIENCE_EXAM_SIZE = 20;
export const SCIENCE_PASS_SCORE = 60;

/** 单元模拟考抽题：按章节轮转分层抽取——先保证每课至少 1 题，再逐轮补齐到 size，
 *  最后整体洗牌。题库总量不足时返回全部题。 */
export function sampleScienceExam(
  questions: readonly ScienceQuestion[],
  size: number = SCIENCE_EXAM_SIZE,
): ScienceQuestion[] {
  if (questions.length === 0) return [];
  const byChapter = new Map<string, ScienceQuestion[]>();
  for (const q of questions) {
    const pool = byChapter.get(q.chapter) ?? [];
    pool.push(q);
    byChapter.set(q.chapter, pool);
  }
  const pools = shuffle([...byChapter.values()].map((pool) => shuffle(pool)));
  const target = Math.min(size, questions.length);
  const picked: ScienceQuestion[] = [];
  for (let round = 0; picked.length < target; round++) {
    for (const pool of pools) {
      if (picked.length >= target) break;
      if (pool[round]) picked.push(pool[round]);
    }
  }
  return shuffle(picked);
}
