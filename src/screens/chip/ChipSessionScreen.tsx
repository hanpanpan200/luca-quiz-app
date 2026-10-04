import { useEffect, useRef, useState } from "react";
import { CIRCUITS } from "../../data";
import { chipLimitMs, chipTimerStart, chipTimerStop, recordChipAttempt, type TimerState } from "../../domain/chipRules";
import { fmtMs, todayLabel } from "../../domain/utils";
import { useVoiceControl, voiceSupported } from "../../hooks/useVoiceControl";
import { useChipStore } from "./ChipApp";
import type { CircuitQuestion } from "../../types";

export interface ChipSession {
  mode: "practice" | "exam";
  qs: CircuitQuestion[];
}

interface Props {
  session: ChipSession;
  onExit: () => void;
  /** 模拟考成绩单「再来一场」：重新抽题开考 */
  onRestart: () => void;
}

interface LastDone {
  ms: number;
  overtime: boolean;
  graduated: boolean;
}

const LIMIT_MS = chipLimitMs(CIRCUITS.time_limit_sec);
const LIMIT_S = LIMIT_MS / 1000;

/** 按钮防误触窗口：换屏后短暂锁定操作键，连点/手滑不会串到下一屏的按钮上 */
const TAP_LOCK_MS = 600;

/** 答题会话：电路图 + 题目 + 正计时（3 分钟变红）+ 声控/按钮，核心交互屏 */
export default function ChipSessionScreen({ session, onExit, onRestart }: Props) {
  const { store, setStore } = useChipStore();
  const [i, setI] = useState(0);
  const [times, setTimes] = useState<(number | null)[]>(() => Array(session.qs.length).fill(null));
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [lastDone, setLastDone] = useState<LastDone | null>(null);
  const [finished, setFinished] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef<number>(undefined);

  // 计时中每 200ms 刷新显示（只更新时间文本，不重渲染整棵树）
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => () => clearTimeout(lockTimer.current), []);

  const q = session.qs[i];

  /** 每次换一组按钮就重新锁定：孩子连点「我做完了」时，多点的几下不会落到
   *  刚出现在同一位置的「下一题 / 开始计时」上，避免一路误触冲到结尾。 */
  function relock() {
    setLocked(true);
    clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => setLocked(false), TAP_LOCK_MS);
  }

  function startTimer() {
    if (timer || finished) return;
    setNow(Date.now()); // 同步刷新：否则首帧用过期的 now 减新 startAt 会闪负数
    setTimer(chipTimerStart(session.qs[i].id, Date.now()));
    setLastDone(null);
    relock();
  }

  function finishTimer() {
    if (!timer || locked) return; // 锁内不记成绩：刚开计时就「做完」必是误触，避免 0 秒假记录
    const r = chipTimerStop(timer, Date.now(), LIMIT_MS);
    const rec = { overtime: false, graduated: false };
    setStore((s) => {
      const draft = structuredClone(s);
      const { overtime, graduated } = recordChipAttempt(draft, r.qid, r.ms, LIMIT_MS);
      rec.overtime = overtime;
      rec.graduated = graduated;
      return draft;
    });
    setTimes((t) => t.map((x, idx) => (idx === i ? r.ms : x)));
    setTimer(null);
    setLastDone({ ms: r.ms, overtime: rec.overtime, graduated: rec.graduated });
    relock();
  }

  function abandonTimer() {
    if (!timer) return;
    setTimer(null);
    relock();
  }

  function endSession() {
    if (session.mode === "exam") {
      setStore((s) => ({
        ...s,
        exam_history: [...s.exam_history, {
          d: todayLabel(),
          qids: session.qs.map((x) => x.id),
          times_ms: times.map((t) => t ?? null),
        }].slice(-20),
      }));
    }
    setFinished(true);
    relock();
  }

  function next() {
    if (i + 1 >= session.qs.length) {
      endSession();
    } else {
      setI(i + 1);
      setLastDone(null);
      relock();
    }
  }

  // 声控：会话进行中监听；idle 听开始词，timing 听结束词
  useVoiceControl({
    enabled: store.mic_enabled,
    active: !finished,
    mode: timer ? "stop" : "start",
    onStart: startTimer,
    onStop: finishTimer,
  });

  if (finished) return session.mode === "exam"
    ? <ExamSummary session={session} times={times} locked={locked} onExit={onExit} onRestart={onRestart} />
    : <PracticeSummary session={session} times={times} locked={locked} onExit={onExit} />;

  const cat = CIRCUITS.categories.find((c) => c.id === q.category);
  const head = session.mode === "exam"
    ? `🏆 模拟考 · 第 ${i + 1} / ${session.qs.length} 题`
    : `✏️ 练习 · 第 ${i + 1} / ${session.qs.length} 题（${cat?.name ?? ""}）`;

  return (
    <div className="card">
      <h2 className="sec">{head} <MicButton /></h2>
      <div className="progress"><i style={{ width: `${(i / session.qs.length) * 100}%` }} /></div>
      <div className="q-meta">第 {q.no} 题 · {cat?.name}</div>
      <div className="q-text" style={{ fontSize: 19 }}>{q.text}</div>
      <div style={{ margin: "14px 0", textAlign: "center" }}><CircuitImage q={q} big /></div>

      {timer ? (
        <>
          <div className="score-hero" style={{ padding: "10px 0" }}>
            <div className={`num ${now - timer.startAt > LIMIT_MS ? "over" : ""}`}>{fmtMs(now - timer.startAt)}</div>
            <div style={{ fontSize: 15, color: "var(--ink-soft)" }}>目标 {LIMIT_S / 60} 分钟内完成，超时数字会变红</div>
          </div>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button className="btn warn" disabled={locked} onClick={finishTimer}>✅ 我做完了</button>
            <button className="btn ghost" disabled={locked} onClick={abandonTimer}>放弃（不计时间）</button>
          </div>
        </>
      ) : lastDone ? (
        <>
          <div className={`feedback ${lastDone.overtime ? "no" : "ok"}`} style={{ textAlign: "center" }}>
            {lastDone.overtime
              ? `⏰ 用时 ${fmtMs(lastDone.ms)}，超过 ${LIMIT_S / 60} 分钟，已进超时本`
              : `🎉 ${fmtMs(lastDone.ms)} 完成！`}
            {lastDone.graduated && <br />}
            {lastDone.graduated && "连续 2 次达标，这道题从超时本毕业啦 🎓"}
          </div>
          <div style={{ fontSize: 15, color: "var(--ink-soft)", textAlign: "center", marginTop: 8 }}>
            对照题目检查一下效果对不对，不对就再拼一次
          </div>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button className="btn" disabled={locked} onClick={next}>{i + 1 >= session.qs.length ? "看结果 📋" : "下一题 ➡️"}</button>
            <button className="btn ghost" disabled={locked} onClick={endSession}>🏁 结束{session.mode === "exam" ? "考试" : "练习"}</button>
          </div>
        </>
      ) : (
        <>
          <div className="score-hero" style={{ padding: "10px 0" }}>
            <div style={{ fontSize: 19, color: "var(--ink-soft)" }}>看懂电路图，准备好元件后开始计时</div>
          </div>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button className="btn warn" disabled={locked} onClick={startTimer}>▶️ 开始计时</button>
          </div>
        </>
      )}

      <button className="back" onClick={onExit}>⬅️ 退出{session.mode === "exam" ? "考试" : "练习"}</button>
    </div>
  );
}

function MicButton() {
  const { store, setStore } = useChipStore();
  if (!voiceSupported()) return null;
  const on = store.mic_enabled;
  return (
    <button className={`btn small ${on ? "" : "ghost"}`} onClick={() => setStore({ ...store, mic_enabled: !on })}>
      🎤 {on ? "语音已开（说「现在开始 / 我做完了」）" : "语音未开"}
    </button>
  );
}

export function CircuitImage({ q, big }: { q: CircuitQuestion; big?: boolean }) {
  if (!q.image) {
    return (
      <div className="empty" style={{ padding: "18px 8px", fontSize: 16 }}>
        <span className="big">📐</span>本题无独立电路图（按题意在前一题电路上改装）
      </div>
    );
  }
  return (
    <img src={q.image} alt={`第${q.no}题电路图`} loading="lazy"
      style={{ width: "100%", maxWidth: big ? 460 : 380, borderRadius: 12, border: "1.5px solid var(--line)", background: "#fff" }} />
  );
}

function ExamSummary({ session, times, locked, onExit, onRestart }: {
  session: ChipSession;
  times: (number | null)[];
  locked: boolean;
  onExit: () => void;
  onRestart: () => void;
}) {
  const done = times.filter((t): t is number => t != null);
  const over = done.filter((t) => t > LIMIT_MS).length;
  const passed = done.length - over; // 按时完成数：没计时/超时的都不算
  const total = done.reduce((s, t) => s + t, 0);
  return (
    <div className="card">
      <h2 className="sec">📋 模拟考成绩单 <small>按真实规则：完成数 + 用时</small></h2>
      <div className="score-hero">
        <span className="confetti">{passed === session.qs.length ? "🎉🎓🎊" : "💪"}</span>
        <div className={`num ${passed === session.qs.length ? "" : "fail"}`}>{passed}<span style={{ fontSize: 24 }}> / {session.qs.length} 题</span></div>
        <div className="verdict">总用时 {fmtMs(total)} · 超时 {over} 题{over ? "（已进超时本）" : ""}</div>
      </div>
      {session.qs.map((q, idx) => {
        const t = times[idx];
        const row = t == null ? "未完成" : `${fmtMs(t)}${t > LIMIT_MS ? " ⏰" : ""}`;
        return (
          <div className="study-q" key={q.id}>
            <div className="q-head"><span className="no">{q.no}</span>
              <div>{CIRCUITS.categories.find((c) => c.id === q.category)?.name} ·{" "}
                <b style={{ color: t != null && t <= LIMIT_MS ? "var(--green-deep)" : "var(--red)" }}>{row}</b>
              </div>
            </div>
          </div>
        );
      })}
      <div className="btn-row">
        <button className="btn" disabled={locked} onClick={onRestart}>🔁 再来一场</button>
        <button className="btn ghost" disabled={locked} onClick={onExit}>返回</button>
      </div>
    </div>
  );
}

function PracticeSummary({ session, times, locked, onExit }: { session: ChipSession; times: (number | null)[]; locked: boolean; onExit: () => void }) {
  const done = times.filter((t): t is number => t != null);
  const over = done.filter((t) => t > LIMIT_MS).length;
  return (
    <div className="card">
      <h2 className="sec">✏️ 本轮练习完成</h2>
      <div className="score-hero">
        <div className="num">{done.length}<span style={{ fontSize: 24 }}> / {session.qs.length} 题</span></div>
        <div className="verdict">{over ? `超时 ${over} 题，去超时本再战 💪` : done.length ? "全部达标 🎉" : ""}</div>
      </div>
      <div className="btn-row" style={{ justifyContent: "center" }}>
        <button className="btn" disabled={locked} onClick={onExit}>返回</button>
      </div>
    </div>
  );
}
