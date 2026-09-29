/** Fisher-Yates 洗牌，返回新数组 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 可答题池：排除待确认答案的题 */
export function answerable<T extends { needs_review: boolean }>(qs: readonly T[]): T[] {
  return qs.filter((q) => !q.needs_review);
}

/** mm:ss 格式化 */
export function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 中文日期（月/日），与旧版考试记录一致 */
export function todayLabel(): string {
  return new Date().toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
