import { useState } from "react";
import { CIRCUITS } from "../../data";
import { shuffle } from "../../domain/utils";
import { useChipStore } from "./ChipApp";
import ChipSessionScreen, { type ChipSession } from "./ChipSessionScreen";

const MAX_NO = 60;

export default function ChipPracticeScreen() {
  const [session, setSession] = useState<ChipSession | null>(null);
  const [mode, setMode] = useState<"category" | "range">("category");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const { store } = useChipStore();

  if (session) {
    return <ChipSessionScreen session={session} onExit={() => setSession(null)} onRestart={() => setSession(null)} />;
  }

  const rangeValid = Number.isInteger(from) && Number.isInteger(to)
    && from >= 1 && to <= MAX_NO && from <= to;

  return (
    <div className="card">
      <h2 className="sec">✏️ 练习 <small>选一种方式开练</small></h2>

      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className={`btn small ${mode === "category" ? "" : "ghost"}`}
          onClick={() => setMode("category")}>📚 按考点</button>
        <button className={`btn small ${mode === "range" ? "" : "ghost"}`}
          onClick={() => setMode("range")}>🔢 按题号</button>
      </div>

      {mode === "category" ? (
        <>
          <div className="grid" style={{ marginTop: 14 }}>
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
        </>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>练第</span>
            <input type="number" min={1} max={MAX_NO} aria-label="起始题号"
              value={from} onChange={(e) => setFrom(Number(e.target.value))}
              style={{ width: 84, fontSize: 18, padding: "8px 10px", borderRadius: 10, border: "2px solid var(--line)" }} />
            <span>题 到 第</span>
            <input type="number" min={1} max={MAX_NO} aria-label="结束题号"
              value={to} onChange={(e) => setTo(Number(e.target.value))}
              style={{ width: 84, fontSize: 18, padding: "8px 10px", borderRadius: 10, border: "2px solid var(--line)" }} />
            <span>题</span>
          </div>
          <div className="btn-row">
            <button className="btn warn" disabled={!rangeValid}
              onClick={() => setSession({
                mode: "practice",
                qs: CIRCUITS.questions.filter((q) => q.no >= from && q.no <= to), // 按题号顺序
              })}>
              ▶️ 开始练习（{rangeValid ? to - from + 1 : "--"} 题）
            </button>
          </div>
          {!rangeValid && (
            <div style={{ fontSize: 15, color: "var(--red)" }}>
              题号范围不对：要 1~{MAX_NO} 之间，且起始 ≤ 结束
            </div>
          )}
        </div>
      )}
    </div>
  );
}
