import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BANK_EMOJI, LETTERS, QUESTIONS } from "../../data";
import { EXAM_QUOTA, EXAM_SIZE, PASS_SCORE, examScore, sampleExamQuestions } from "../../domain/aiExam";
import { recordAnswer } from "../../domain/aiRecords";
import { todayLabel } from "../../domain/utils";
import { useAiStore } from "./AiApp";
import type { Question } from "../../types";

interface ExamSession {
  qs: Question[];
  i: number;
  answers: (number | null)[];
  finished: boolean;
  score?: number;
}

export default function ExamScreen() {
  const navigate = useNavigate();
  const { store, setStore } = useAiStore();
  const [exam, setExam] = useState<ExamSession | null>(null);

  if (!exam) {
    const hist = store.examHistory.slice(-5).reverse();
    return (
      <div className="card">
        <h2 className="sec">🏆 模拟考 <small>完全按真实规则</small></h2>
        <div style={{ fontSize: 18, lineHeight: 2 }}>
          <div>📝 三套题库固定配额抽 <b>{EXAM_SIZE} 题</b>（{QUESTIONS.banks.map((b) => `${BANK_EMOJI[b.name] || ""}${b.name} ${EXAM_QUOTA[b.name] ?? 0}`).join(" · ")}），满分 100</div>
          <div>⏱ 不限时，但要像真考试一样认真哦</div>
          <div>✅ <b>60 分</b> = 拿到市赛现场赛入场券</div>
          <div>❌ 答错的题会自动进错题本</div>
        </div>
        <div className="btn-row">
          <button className="btn warn" onClick={startExam}>🚀 开始考试</button>
        </div>
        {hist.length > 0 && (
          <>
            <h2 className="sec" style={{ marginTop: 22 }}>最近成绩</h2>
            {hist.map((h, idx) => {
              const color = h.score >= PASS_SCORE ? "var(--green)" : "var(--orange)";
              return (
                <div className="exam-hist" key={idx}>
                  <span className="d">{h.d}</span>
                  <div className="bar"><i style={{ width: `${h.score}%`, background: color }} /></div>
                  <b style={{ color }}>{h.score} 分</b>
                  <span>{h.score >= PASS_SCORE ? "✅晋级" : "💪继续"}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  if (exam.finished) {
    const pass = (exam.score ?? 0) >= PASS_SCORE;
    const wrongQs = exam.qs.filter((q, i) => exam.answers[i] === null || LETTERS[exam.answers[i]!] !== q.answer);
    return (
      <div className="card">
        <div className="score-hero">
          <span className="confetti">{pass ? "🎉🎓🎊" : "💪"}</span>
          <div className={`num ${pass ? "" : "fail"}`}>{exam.score}<span style={{ fontSize: 30 }}> 分</span></div>
          <div className="verdict">{pass ? "恭喜！拿到市赛现场赛入场券啦 🎫" : `还差 ${PASS_SCORE - (exam.score ?? 0)} 分，刷刷错题再来一次！`}</div>
        </div>
        {wrongQs.length ? (
          <>
            <h2 className="sec" style={{ marginTop: 18 }}>❌ 这几题答错了（已进错题本）</h2>
            {wrongQs.map((q) => (
              <div className="study-q" key={q.id}>
                <div className="q-head"><span className="no">·</span>
                  <div>
                    <div style={{ fontSize: 18 }}>{q.text}</div>
                    <ul>
                      {q.options.map((o, i) => (
                        <li key={i} className={LETTERS[i] === q.answer ? "correct" : ""}>
                          {LETTERS[i]}. {o}{LETTERS[i] === q.answer ? " ✅" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <p style={{ textAlign: "center", fontSize: 19, marginTop: 10 }}>全对！你就是满分战神 🏆</p>
        )}
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <button className="btn warn" onClick={startExam}>🔄 再考一次</button>
          <button className="btn ghost" onClick={() => navigate("/ai/wrong")}>❌ 去刷错题</button>
        </div>
      </div>
    );
  }

  const q = exam.qs[exam.i];
  const picked = exam.answers[exam.i];
  const answered = exam.answers.filter((a) => a !== null).length;
  return (
    <div className="card">
      <div className="q-meta">📝 第 {exam.i + 1} / {exam.qs.length} 题 · 已答 {answered} 题</div>
      <div className="dots">
        {exam.qs.map((_, i) => (
          <button key={i}
            className={`dot ${exam.answers[i] !== null ? "done" : ""} ${i === exam.i ? "cur" : ""}`}
            onClick={() => setExam({ ...exam, i })}>{i + 1}</button>
        ))}
      </div>
      <div className="q-text">{q.text}</div>
      <div className="opts">
        {q.options.map((o, i) => (
          <button key={i} className={`opt ${picked === i ? "picked" : ""}`} onClick={() => pick(i)}>
            <span className="letter">{LETTERS[i]}</span><span>{o}</span>
          </button>
        ))}
      </div>
      <div className="btn-row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" disabled={exam.i === 0} style={exam.i === 0 ? { opacity: 0.4 } : undefined}
          onClick={() => setExam({ ...exam, i: exam.i - 1 })}>⬅️ 上一题</button>
        {exam.i + 1 < exam.qs.length
          ? <button className="btn" onClick={() => setExam({ ...exam, i: exam.i + 1 })}>下一题 ➡️</button>
          : <button className="btn warn" onClick={submit}>🔔 交卷</button>}
      </div>
    </div>
  );

  function pick(i: number) {
    if (!exam) return;
    setExam({ ...exam, answers: exam.answers.map((a, idx) => (idx === exam.i ? i : a)), i: Math.min(exam.i + 1, exam.qs.length - 1) });
  }

  function submit() {
    if (!exam) return;
    const blank = exam.answers.filter((a) => a === null).length;
    if (blank > 0 && !window.confirm(`还有 ${blank} 题没答，确定交卷吗？`)) return;
    let correctCount = 0;
    exam.qs.forEach((q, i) => {
      const a = exam.answers[i];
      if (a === null) return; // 未作答不计入统计，也不给分
      const correct = LETTERS[a] === q.answer;
      if (correct) correctCount += 1;
      setStore((s) => recordAnswer(s, q.id, correct));
    });
    const score = examScore(correctCount, exam.qs.length);
    setStore((s) => ({
      ...s,
      examHistory: [...s.examHistory, { d: todayLabel(), score, total: exam.qs.length }].slice(-50),
    }));
    setExam({ ...exam, finished: true, score });
  }

  function startExam() {
    const qs = sampleExamQuestions(QUESTIONS.banks, EXAM_QUOTA);
    setExam({ qs, i: 0, answers: Array(qs.length).fill(null), finished: false });
  }
}
