import type { ChipAttempt } from "../types";
import { shuffle } from "./utils";

export const TIME_LIMIT_SEC = 180;

export function chipLimitMs(dataLimitSec?: number): number {
  return ((dataLimitSec || TIME_LIMIT_SEC) * 1000);
}

export interface TimerState {
  qid: string;
  phase: "timing";
  startAt: number;
  elapsedMs: 0;
}

export function chipTimerStart(qid: string, now: number): TimerState {
  return { qid, phase: "timing", startAt: now, elapsedMs: 0 };
}

export interface TimerResult {
  qid: string;
  ms: number;
  overtime: boolean;
}

export function chipTimerStop(st: TimerState, now: number, limitMs: number): TimerResult {
  const ms = Math.max(0, now - st.startAt);
  return { qid: st.qid, ms, overtime: ms > limitMs };
}

/** 语音触发词匹配：忽略空格与常见标点后做子串命中 */
export function matchPhrase(transcript: string, phrases: readonly string[]): boolean {
  const norm = (s: string) => String(s).replace(/[\s，。！？!?.,、]/g, "");
  const t = norm(transcript);
  return phrases.some((p) => t.includes(norm(p)));
}

export const VOICE_START = ["现在开始", "开始计时", "开始"];
export const VOICE_STOP = ["我做完了", "做完了", "完成", "结束"];

/** 模拟考：全池随机抽 n 题（贴近真实抽题） */
export function sampleCircuitExam<T>(qs: readonly T[], n: number): T[] {
  return shuffle(qs).slice(0, n);
}

/** 超时本规则的宿主结构（ChipStore 与 ProgStore 均满足） */
export interface WrongBookStore {
  attempts: Record<string, ChipAttempt>;
  wrongBook: string[];
}

/** 记录一次练习：超时进超时本；连续 2 次达标毕业。就地修改 store。 */
export function recordChipAttempt(s: WrongBookStore, qid: string, ms: number, limitMs: number) {
  const overtime = ms > limitMs;
  const a = s.attempts[qid] || (s.attempts[qid] = { best_ms: null, count: 0, streak: 0 });
  a.count += 1;
  if (a.best_ms === null || ms < a.best_ms) a.best_ms = ms;
  let graduated = false;
  if (overtime) {
    a.streak = 0;
    if (!s.wrongBook.includes(qid)) s.wrongBook.push(qid);
  } else {
    a.streak += 1;
    if (a.streak >= 2 && s.wrongBook.includes(qid)) {
      s.wrongBook = s.wrongBook.filter((x) => x !== qid);
      graduated = true;
    }
  }
  return { overtime, graduated };
}
