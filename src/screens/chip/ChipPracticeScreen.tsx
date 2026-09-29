import { useState } from "react";
import { CIRCUITS } from "../../data";
import { shuffle } from "../../domain/utils";
import { useChipStore } from "./ChipApp";
import ChipSessionScreen, { type ChipSession } from "./ChipSessionScreen";

export default function ChipPracticeScreen() {
  const [session, setSession] = useState<ChipSession | null>(null);
  const { store } = useChipStore();

  if (session) {
    return <ChipSessionScreen session={session} onExit={() => setSession(null)} onRestart={() => setSession(null)} />;
  }

  return (
    <div className="card">
      <h2 className="sec">✏️ 练习 <small>选一个考点开练</small></h2>
      <div className="grid">
        {CIRCUITS.categories.map((c) => {
          const qs = CIRCUITS.questions.filter((q) => q.category === c.id);
          const wrong = qs.filter((q) => store.wrongBook.includes(q.id)).length;
          return (
            <button key={c.id} className="tile"
              onClick={() => setSession({ mode: "practice", qs: shuffle(qs) })}>
              <span className="emoji">{c.emoji}</span><b>{c.name}</b>
              <div className="sub">{qs.length} 题{wrong ? ` · ⏰${wrong} 题超时中` : ""}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 15, color: "var(--ink-soft)", marginTop: 12 }}>
        每题 3 分钟内拼完并演示；超时自动进超时本，可反复练到达标毕业
      </div>
    </div>
  );
}
