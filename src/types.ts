/** AI 实物编程题库 */
export interface Question {
  text: string;
  options: string[];
  answer: string;
  correct_idx: number;
  needs_review: boolean;
  id: string;
  bank: string;
  chapter: string;
  qno: number;
}

export interface Bank {
  name: string;
  chapters: string[];
  questions: Question[];
}

export interface QuestionsData {
  generated_at: string;
  banks: Bank[];
}

/** 电子创芯赛题库 */
export interface CircuitCategory {
  id: string;
  name: string;
  emoji: string;
}

export interface CircuitQuestion {
  id: string;
  no: number;
  text: string;
  category: string;
  image: string | null;
}

export interface CircuitsData {
  generated_at: string;
  time_limit_sec: number;
  categories: CircuitCategory[];
  questions: CircuitQuestion[];
}

/** 持久化：AI 应用（schema 与 vanilla 版完全一致，进度无缝迁移） */
export interface AnswerStat {
  r: number;
  w: number;
  streak: number;
  ts: number;
}

export interface ExamHistoryEntry {
  d: string;
  score: number;
  total: number;
}

export interface AiStore {
  answers: Record<string, AnswerStat>;
  wrongBook: string[];
  graduated: string[];
  examHistory: ExamHistoryEntry[];
  v: 1;
}

/** 持久化：电子创芯赛 */
export interface ChipAttempt {
  best_ms: number | null;
  count: number;
  streak: number;
}

export interface ChipExamHistoryEntry {
  d: string;
  qids: string[];
  times_ms: (number | null)[];
}

export interface ChipStore {
  v: 1;
  attempts: Record<string, ChipAttempt>;
  wrongBook: string[];
  mic_enabled: boolean;
  exam_history: ChipExamHistoryEntry[];
}
