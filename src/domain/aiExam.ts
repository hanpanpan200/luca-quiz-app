import type { Bank } from "../types";
import { answerable, shuffle } from "./utils";

/** 模拟考分层配额：各题库抽题数（按竞赛难度金字塔 5:3:2 配置；改这里即可，计分自动适配满分 100） */
export const EXAM_QUOTA: Record<string, number> = { 基础版: 10, 进阶版: 6, 高阶版: 4 };
export const EXAM_SIZE = Object.values(EXAM_QUOTA).reduce((s, n) => s + n, 0);
export const PASS_SCORE = 60;

/** 分层抽题：每库各抽配额数；某库可用题不足时从全局剩余题补齐，整体洗牌出卷 */
export function sampleExamQuestions(banks: readonly Bank[], quota: Record<string, number>) {
  const unknown = Object.keys(quota).filter((k) => !banks.some((b) => b.name === k));
  const missing = banks.filter((b) => quota[b.name] === undefined).map((b) => b.name);
  if (unknown.length || missing.length) {
    console.warn(`[模拟考] 配额键与题库名不匹配：多余 ${JSON.stringify(unknown)}，缺少 ${JSON.stringify(missing)}`);
  }
  const picked: Bank["questions"] = [];
  const rest: Bank["questions"] = [];
  for (const b of banks) {
    const pool = shuffle(answerable(b.questions));
    const n = quota[b.name] ?? 0;
    picked.push(...pool.slice(0, n));
    rest.push(...pool.slice(n));
  }
  return shuffle([...picked, ...shuffle(rest).slice(0, EXAM_SIZE - picked.length)]);
}

/** 计分：满分恒为 100，与配额总题数解耦 */
export function examScore(correctCount: number, total: number): number {
  return Math.round((correctCount * 100) / total);
}
