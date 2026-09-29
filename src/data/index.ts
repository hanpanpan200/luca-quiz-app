import questionsJson from "./questions.json";
import circuitsJson from "./circuits.json";
import type { CircuitsData, QuestionsData } from "../types";

export const QUESTIONS = questionsJson as unknown as QuestionsData;
export const CIRCUITS = circuitsJson as unknown as CircuitsData;
export const BANK_EMOJI: Record<string, string> = { 基础版: "🧱", 进阶版: "🚀", 高阶版: "👑" };
export const LETTERS = ["A", "B", "C", "D"];

export function findQuestion(qid: string) {
  for (const b of QUESTIONS.banks) {
    const q = b.questions.find((x) => x.id === qid);
    if (q) return q;
  }
  return undefined;
}
