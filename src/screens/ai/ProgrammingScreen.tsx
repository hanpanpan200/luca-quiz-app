import { useEffect, useState } from "react";
import { PROGRAMMING_TASKS, PROG_TIME_LIMIT_SEC, type ProgrammingTask } from "../../data/programming";
import { chipTimerStart, chipTimerStop, recordChipAttempt, sampleCircuitExam, type TimerState } from "../../domain/chipRules";
import { fmtMs } from "../../domain/utils";
import { useProgStore } from "./progStore";

const LIMIT_MS = PROG_TIME_LIMIT_SEC * 1000;

/** 学习页的编程题浏览：任务卡 + 任务描述/考察重点/结构考察 */
export function ProgTaskBrowser() {
  const groups: [string, ProgrammingTask[]][] = [
    ["🌱 基础任务", PROGRAMMING_TASKS.filter((t) => t.tier === "basic")],
    ["🚀 进阶任务", PROGRAMMING_TASKS.filter((t) => t.tier === "advanced")],
  ];
  return (
    <div className="card">
      <h2 className="sec">💻 编程任务 <small>先读懂题，练的时候不慌</small></h2>
      {groups.map(([label, tasks]) => (
        <div key={label}>
          <h2 className="sec" style={{ marginTop: 10, fontSize: 17 }}>{label}（{tasks.length}）</h2>
          {tasks.map((t) => (
            <div className="study-q" key={t.id}>
              <div className="q-head">
                <span className="no">{t.no}</span>
                <div>
                  <span className="q-text" style={{ fontSize: 18 }}>🧩 {t.name}</span>
                  <div style={{ margin: "6px 0 0", fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.9 }}>
                    📝 {t.description}<br />
                    🎯 考察重点：{t.focus}<br />
                    🏗️ 结构考察：{t.structure}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** 练习页的编程题子模块：任务列表 → 10 分钟计时练习 */
export function ProgPractice() {
  const { store } = useProgStore();
  const [active, setActive] = useState<ProgrammingTask | null>(null);

  if (active) return <Session key={active.id} task={active} onExit={() => setActive(null)} />;

  const basics = PROGRAMMING_TASKS.filter((t) => t.tier === "basic");
  const advanced = PROGRAMMING_TASKS.filter((t) => t.tier === "advanced");
  const row = (t: ProgrammingTask) => {
    const a = store.attempts[t.id];
    return (
      <button key={t.id} className="tile" onClick={() => setActive(t)}>
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
        照题搭建并演示，完成点「我做完了」；超时会收进错题本，连对 2 次达标就毕业
      </div>
    </div>
  );
}

/** 模拟考页的编程题子模块：随机抽 1 个任务，10 分钟计时 */
export function ProgExam() {
  const [task, setTask] = useState<ProgrammingTask | null>(null);
  const [seed, setSeed] = useState(0);

  if (task) return <Session key={`${task.id}-${seed}`} task={task} onExit={() => setTask(null)} />;

  return (
    <div className="card">
      <h2 className="sec">💻 编程模拟考 <small>像现场一样抽题</small></h2>
      <div style={{ fontSize: 18, lineHeight: 2 }}>
        <div>🎲 从 6 个任务随机抽 <b>1 个</b>（基础或进阶都可能）</div>
        <div>⏱ <b>10 分钟</b>限时搭建并演示，超时进错题本</div>
      </div>
      <div className="btn-row">
        <button className="btn warn" onClick={() => { setSeed((s) => s + 1); setTask(sampleCircuitExam(PROGRAMMING_TASKS, 1)[0]); }}>
          🚀 开始考试
        </button>
      </div>
    </div>
  );
}

/** 错题本页的编程题子模块：超时任务列表 + 重练 */
export function ProgWrongBook() {
  const { store } = useProgStore();
  const [session, setSession] = useState<{ tasks: ProgrammingTask[] } | null>(null);

  if (session) {
    const t = session.tasks[0];
    return <Session key={t.id + "-w"} task={t} onExit={() => setSession(null)} />;
  }

  const wrong = PROGRAMMING_TASKS.filter((t) => store.wrongBook.includes(t.id));
  if (!wrong.length) {
    return (
      <div className="card"><div className="empty">
        <span className="big">🎉</span>编程题错题本是空的！<br />
        <span style={{ fontSize: 16 }}>练习和模拟考里超时的任务会自动收进来，连对 2 次就能毕业</span>
      </div></div>
    );
  }

  return (
    <div className="card">
      <h2 className="sec">💻 编程题错题本 <small>{wrong.length} 个任务待征服</small></h2>
      {wrong.map((t) => {
        const a = store.attempts[t.id];
        return (
          <div className="stat-row" key={t.id}>
            <span className="name" style={{ flex: 2 }}>🧩 {t.name}</span>
            <span className="val">
              {a && a.best_ms != null ? `最快 ${fmtMs(a.best_ms)}` : "还没完成过"}
              <span className="mini-badge">连击 {a ? a.streak : 0}/2</span>
            </span>
          </div>
        );
      })}
      <div className="btn-row">
        <button className="btn warn" onClick={() => setSession({ tasks: shufflePick(wrong) })}>
          💪 开练这 {wrong.length} 个任务
        </button>
      </div>
    </div>
  );
}

function shufflePick<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 计时会话（练习/错题重练/模拟考共用） */
function Session({ task, onExit }: { task: ProgrammingTask; onExit: () => void }) {
  const { setStore } = useProgStore();
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [lastDone, setLastDone] = useState<{ ms: number; overtime: boolean; graduated: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useTick(timer, setNow);

  function startTimer() {
    if (timer) return;
    setNow(Date.now()); // 同步刷新，首帧即 0:00
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

      {!timer && <button className="back" onClick={onExit}>⬅️ 退出练习</button>}
      {timer && <button className="back" onClick={onExit}>⬅️ 退出练习</button>}
    </div>
  );
}

function useTick(timer: TimerState | null, setNow: (n: number) => void) {
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timer]);
}
