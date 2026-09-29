import { useState } from "react";
import { CIRCUITS } from "../../data";
import { fmtMs } from "../../domain/utils";
import { shuffle } from "../../domain/utils";
import { useChipStore } from "./ChipApp";
import ChipSessionScreen, { type ChipSession } from "./ChipSessionScreen";

export default function ChipWrongbookScreen() {
  const { store } = useChipStore();
  const [session, setSession] = useState<ChipSession | null>(null);
  const qs = store.wrongBook
    .map((id) => CIRCUITS.questions.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q));

  if (session) {
    return <ChipSessionScreen session={session} onExit={() => setSession(null)} onRestart={() => setSession(null)} />;
  }

  if (!qs.length) {
    return (
      <div className="card"><div className="empty">
        <span className="big">🎉</span>超时本是空的！<br />
        <span style={{ fontSize: 16 }}>练习和模拟考里超时的题会自动收进来，连对 2 次就能毕业</span>
      </div></div>
    );
  }

  return (
    <div className="card">
      <h2 className="sec">⏰ 超时本 <small>{qs.length} 题待征服</small></h2>
      {qs.map((q) => {
        const a = store.attempts[q.id];
        const cat = CIRCUITS.categories.find((c) => c.id === q.category);
        return (
          <div className="study-q" key={q.id}>
            <div className="q-head"><span className="no">{q.no}</span>
              <div style={{ whiteSpace: "nowrap" }}>
                {cat?.name} · {a && a.best_ms != null ? `最快 ${fmtMs(a.best_ms)}` : "还没完成过"}
                <span className="mini-badge">连击 {a ? a.streak : 0}/2</span>
              </div>
            </div>
            <div style={{ margin: "6px 0 4px 34px", fontSize: 16, color: "var(--ink-soft)" }}>{q.text.slice(0, 50)}…</div>
          </div>
        );
      })}
      <div className="btn-row">
        <button className="btn warn" onClick={() => setSession({ mode: "practice", qs: shuffle(qs) })}>
          💪 开练这 {qs.length} 题
        </button>
      </div>
    </div>
  );
}
