import { CIRCUITS } from "../../data";
import { chipLimitMs } from "../../domain/chipRules";
import { fmtMs } from "../../domain/utils";
import { useChipStore } from "./ChipApp";

const LIMIT_MS = chipLimitMs(CIRCUITS.time_limit_sec);

export default function ChipStatsScreen() {
  const { store } = useChipStore();
  const hist = store.exam_history.slice(-5).reverse();

  return (
    <div className="card">
      <h2 className="sec">📊 各考点进度</h2>
      {CIRCUITS.categories.map((c) => {
        const qs = CIRCUITS.questions.filter((q) => q.category === c.id);
        const tried = qs.filter((q) => store.attempts[q.id]);
        const bests = tried.map((q) => store.attempts[q.id].best_ms).filter((t): t is number => t != null);
        const avg = bests.length ? bests.reduce((s, t) => s + t, 0) / bests.length : null;
        const wrong = qs.filter((q) => store.wrongBook.includes(q.id)).length;
        return (
          <div className="stat-row" key={c.id}>
            <span className="name">{c.emoji} {c.name}</span>
            <span className="bar"><i style={{ width: `${(tried.length / qs.length) * 100}%` }} /></span>
            <span className="val">
              {tried.length}/{qs.length} 题 · {avg ? `平均最快 ${fmtMs(avg)}` : "未练"}{wrong ? ` · ⏰${wrong}` : ""}
            </span>
          </div>
        );
      })}
      {hist.length > 0 && (
        <>
          <h2 className="sec" style={{ marginTop: 20 }}>🏆 最近模拟考</h2>
          {hist.map((h, idx) => {
            const done = h.times_ms.filter((t): t is number => t != null);
            const over = done.filter((t) => t > LIMIT_MS).length;
            const total = done.reduce((s, t) => s + t, 0);
            const pct = Math.round(((h.qids.length - over) / h.qids.length) * 100);
            const color = over === 0 ? "var(--green)" : "var(--orange)";
            return (
              <div className="exam-hist" key={idx}>
                <span className="d">{h.d}</span>
                <div className="bar"><i style={{ width: `${pct}%`, background: color }} /></div>
                <b style={{ color }}>{h.qids.length - over}/{h.qids.length} 达标</b>
                <span>{fmtMs(total)}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
