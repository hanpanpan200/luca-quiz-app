import type { AiStore, AnswerStat } from "../types";

export function stat(store: AiStore, qid: string): AnswerStat {
  return store.answers[qid] || { r: 0, w: 0, streak: 0, ts: 0 };
}

/** 练习/模拟考的记录：答错进错题本；答对只累计次数。返回更新后的 store（新引用）。 */
export function recordAnswer(store: AiStore, qid: string, correct: boolean): AiStore {
  const s = { ...stat(store, qid) };
  if (correct) s.r += 1;
  else {
    s.w += 1;
    s.streak = 0;
    if (!store.wrongBook.includes(qid)) store.wrongBook = [...store.wrongBook, qid];
  }
  s.ts = Date.now();
  return { ...store, answers: { ...store.answers, [qid]: s } };
}

/** 错题重刷：连对 2 次毕业（从活跃错题本移除）；答错重新计数 */
export function recordWrongQuiz(store: AiStore, qid: string, correct: boolean): AiStore {
  const s = { ...stat(store, qid) };
  let wrongBook = store.wrongBook;
  let graduated = store.graduated;
  if (correct) {
    s.streak += 1;
    s.r += 1;
    if (s.streak >= 2 && wrongBook.includes(qid)) {
      wrongBook = wrongBook.filter((x) => x !== qid);
      if (!graduated.includes(qid)) graduated = [...graduated, qid];
    }
  } else {
    s.streak = 0;
    s.w += 1;
  }
  s.ts = Date.now();
  return { ...store, answers: { ...store.answers, [qid]: s }, wrongBook, graduated };
}

/** 统计辅助：题库某章节的做题情况 */
export function chapterStats(store: AiStore, questions: { id: string }[]) {
  let tried = 0, right = 0, wrong = 0, wrongActive = 0;
  for (const q of questions) {
    const s = store.answers[q.id];
    if (s && s.r + s.w > 0) { tried += 1; right += s.r; wrong += s.w; }
    if (store.wrongBook.includes(q.id)) wrongActive += 1;
  }
  const total = right + wrong;
  const acc = total ? Math.round((right / total) * 100) : 0;
  return { tried, acc, total, wrongActive };
}

export function overall(store: AiStore) {
  let r = 0, w = 0, tried = 0;
  for (const s of Object.values(store.answers)) {
    r += s.r; w += s.w;
    if (s.r + s.w > 0) tried += 1;
  }
  const total = r + w;
  return { tried, total, acc: total ? Math.round((r / total) * 100) : 0 };
}
