import { createContext, useContext, useEffect, useState } from "react";
import { PROGRAMMING_TASKS, PROG_TIME_LIMIT_SEC, type ProgrammingTask } from "../../data/programming";
import { chipTimerStart, chipTimerStop, recordChipAttempt, type TimerState } from "../../domain/chipRules";
import { fmtMs } from "../../domain/utils";
import { loadProgStore, saveProgStore } from "../../storage";
import type { ProgStore } from "../../types";

const LIMIT_MS = PROG_TIME_LIMIT_SEC * 1000;

const ProgStoreContext = createContext<{ store: ProgStore; setStore: React.Dispatch<React.SetStateAction<ProgStore>> } | null>(null);

function useProgStore() {
  const ctx = useContext(ProgStoreContext);
  if (!ctx) throw new Error("useProgStore 必须在 ProgrammingScreen 内使用");
  return ctx;
}

/** AI 模块·编程题：任务列表 + 10 分钟计时练习（孩子自核对，超时进错题本） */
export default function ProgrammingScreen() {
  const [store, setStore] = useState<ProgStore>(() => loadProgStore());
  const [active, setActive] = useState<ProgrammingTask | null>(null);
  useEffect(() => { saveProgStore(store); }, [store]);

  return (
    <ProgStoreContext.Provider value={{ store, setStore }}>
      {active
        ? <Session key={active.id} task={active} onExit={() => setActive(null)} />
        : <TaskList onPick={setActive} />}
    </ProgStoreContext.Provider>
  );
}

function TaskList({ onPick }: { onPick: (t: ProgrammingTask) => void }) {
  const { store } = useProgStore();
  const basics = PROGRAMMING_TASKS.filter((t) => t.tier === "basic");
  const advanced = PROGRAMMING_TASKS.filter((t) => t.tier === "advanced");

  const row = (t: ProgrammingTask) => {
    const a = store.attempts[t.id];
    return (
      <button key={t.id} className="tile" onClick={() => onPick(t)}>
        <b>🧩 {t.name}</b>
        <div className="sub">{t.focus}</div>
        <div className="sub">
          {store.wrongBook.includes(t.id) && "⏰ 超时中 · "}
          {a ? `最快 ${fmtMs(a.best_ms ?? 0)}` : "没练过"}
        </div>
      </button>
    );
  };

  return (
    <div className="card">
      <h2 className="sec">💻 编程题 <small>10 分钟限时搭建 · 超时进错题本</small></h2>
      <h2 className="sec" style={{ marginTop: 10, fontSize: 17 }}>🌱 基础任务（5）</h2>
      <div className="grid">{basics.map(row)}</div>
      <h2 className="sec" style={{ marginTop: 16, fontSize: 17 }}>🚀 进阶任务（1）</h2>
      <div className="grid">{advanced.map(row)}</div>
      <div style={{ fontSize: 15, color: "var(--ink-soft)", marginTop: 12 }}>
        和电路拼装一样：自己照题搭建并演示，完成点「我做完了」；超时会收进错题本，连对 2 次达标就毕业
      </div>
    </div>
  );
}

function Session({ task, onExit }: { task: ProgrammingTask; onExit: () => void }) {
  const { setStore } = useProgStore();
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [lastDone, setLastDone] = useState<{ ms: number; overtime: boolean; graduated: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timer]);

  function startTimer() {
    if (timer) return;
    setNow(Date.now()); // 同步刷新，首帧即 0:00（见 chip 同款修复）
    setTimer(chipTimerStart(task.id, Date.now()));
    setLastDone(null);
  }

  function finishTimer() {
    if (!timer) return;
    const r = chipTimerStop(timer, Date.now(), LIMIT_MS);
    const rec = { overtime: false, graduated: false };
    setStore((s) => {
      const draft = structuredClone(s);
      const { overtime, graduated } = recordChipAttempt(draft, r.qid, r.ms, LIMIT_MS);
      rec.overtime = overtime;
      rec.graduated = graduated;
      return draft;
    });
    setTimer(null);
    setLastDone({ ms: r.ms, overtime: rec.overtime, graduated: rec.graduated });
  }

  return (
    <div className="card">
      <h2 className="sec">💻 {task.name} <small>{task.tier === "advanced" ? "进阶任务" : "基础任务"}</small></h2>
      <div className="q-meta">📝 任务描述</div>
      <div className="q-text" style={{ fontSize: 18 }}>{task.description}</div>
      <div style={{ margin: "12px 0", fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.9 }}>
        <div>🎯 考察重点：{task.focus}</div>
        <div>🏗️ 结构考察：{task.structure}</div>
      </div>

      {timer ? (
        <>
          <div className="score-hero" style={{ padding: "10px 0" }}>
            <div className={`num ${now - timer.startAt > LIMIT_MS ? "over" : ""}`}>{fmtMs(now - timer.startAt)}</div>
            <div style={{ fontSize: 15, color: "var(--ink-soft)" }}>目标 10 分钟内完成，超时数字会变红</div>
          </div>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button className="btn warn" onClick={finishTimer}>✅ 我做完了</button>
            <button className="btn ghost" onClick={() => setTimer(null)}>放弃（不计时间）</button>
          </div>
        </>
      ) : lastDone ? (
        <>
          <div className={`feedback ${lastDone.overtime ? "no" : "ok"}`} style={{ textAlign: "center" }}>
            {lastDone.overtime ? `⏰ 用时 ${fmtMs(lastDone.ms)}，超过 10 分钟，已进错题本` : `🎉 ${fmtMs(lastDone.ms)} 完成！`}
            {lastDone.graduated && <br />}
            {lastDone.graduated && "连续 2 次达标，这个任务从错题本毕业啦 🎓"}
          </div>
          <div style={{ fontSize: 15, color: "var(--ink-soft)", textAlign: "center", marginTop: 8 }}>
            自己演示检查一下效果对不对，不对就再搭一次
          </div>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button className="btn" onClick={onExit}>⬅️ 返回任务列表</button>
          </div>
        </>
      ) : (
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <button className="btn warn" onClick={startTimer}>▶️ 开始计时</button>
        </div>
      )}

      {timer && <button className="back" onClick={onExit}>⬅️ 退出练习</button>}
      {!timer && !lastDone && <button className="back" onClick={onExit}>⬅️ 返回任务列表</button>}
    </div>
  );
}
