import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LETTERS } from "../../data";
import { recordAnswer } from "../../domain/aiRecords";
import { SCIENCE_PASS_SCORE, sampleScienceExam } from "../../domain/science";
import { examScore } from "../../domain/aiExam";
import { todayLabel } from "../../domain/utils";
import type { ScienceQuestion, ScienceUnit } from "../../types";
import { useScienceStore } from "./ScienceQuizCard";

interface ExamSession {
  qs: ScienceQuestion[];
  i: number;
  answers: (number | null)[];
  finished: boolean;
  score?: number;
}

/** 单元模拟考：题库全部题目乱序组卷，交卷出分、错题带解析 */
export default function ScienceExam({ unit }: { unit: ScienceUnit }) {
  const navigate = useNavigate();
  const { store, setStore } = useScienceStore();
  const [exam, setExam] = useState<ExamSession | null>(null);

  if (!exam) {
    const hist = store.examHistory.slice(-5).reverse();
    return (
      <div className="card">
        <h2 className="sec">🏆 单元模拟考 <small>{unit.name}</small></h2>
        <div style={{ fontSize: 18, lineHeight: 2 }}>
          <div>📝 题库全部题目都考到，共 <b>{unit.questions.length} 题</b>，满分 100</div>
          <div>⏱ 不限时，认真读题，像真的考试一样</div>
          <div>💡 交卷后每道错题都附知识点解析</div>
          <div>✅ <b>{SCIENCE_PASS_SCORE} 分</b>过关 · ❌ 答错的题自动进错题本</div>
        </div>
        <div className="btn-row">
          <button className="btn warn" onClick={startExam}>🚀 开始考试</button>
        </div>
        {hist.length > 0 && (
          <>
            <h2 className="sec" style={{ marginTop: 22 }}>最近成绩</h2>
            {hist.map((h, idx) => {
              const color = h.score >= SCIENCE_PASS_SCORE ? "var(--green)" : "var(--orange)";
              return (
                <div className="exam-hist" key={idx}>
                  <span className="d">{h.d}</span>
                  <div className="bar"><i style={{ width: `${h.score}%`, background: color }} /></div>
                  <b style={{ color }}>{h.score} 分</b>
                  <span>{h.score >= SCIENCE_PASS_SCORE ? "✅过关" : "💪再练"}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  if (exam.finished) {
    const pass = (exam.score ?? 0) >= SCIENCE_PASS_SCORE;
    const wrongQs = exam.qs
      .map((q, i) => ({ q, picked: exam.answers[i] }))
      .filter(({ q, picked }) => picked === null || LETTERS[picked] !== q.answer);
    return (
      <div className="card">
        <div className="score-hero">
          <span className="confetti">{pass ? "🎉🎓🎊" : "💪"}</span>
          <div className={`num ${pass ? "" : "fail"}`}>{exam.score}<span style={{ fontSize: 30 }}> 分</span></div>
          <div className="verdict">{pass ? "这个单元掌握得很棒！" : `还差 ${SCIENCE_PASS_SCORE - (exam.score ?? 0)} 分，刷刷错题再来一次！`}</div>
        </div>
        {wrongQs.length ? (
          <>
            <h2 className="sec" style={{ marginTop: 18 }}>❌ 这几题答错了（已进错题本）</h2>
            {wrongQs.map(({ q, picked }) => (
              <div className="study-q" key={q.id}>
                <div className="q-head"><span className="no">·</span>
                  <div>
                    <div style={{ fontSize: 18 }}>
                      {q.text}
                      {picked === null && <span className="mini-badge">未作答</span>}
                    </div>
                    <ul>
                      {q.options.map((o, i) => {
                        const isAns = LETTERS[i] === q.answer;
                        const isPicked = picked !== null && i === picked;
                        return (
                          <li key={i} className={isAns ? "correct" : isPicked ? "wrong" : ""}>
                            {LETTERS[i]}. {o}{isAns ? " ✅" : isPicked ? " ❌ 你选的" : ""}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="explain" style={{ marginTop: 6 }}>💡 {q.explanation}</div>
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
          <button className="btn ghost" onClick={() => navigate(`/science/${unit.id}/wrong`)}>❌ 去刷错题</button>
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
    const qs = sampleScienceExam(unit.questions, unit.questions.length); // 全部题目，仅乱序
    setExam({ qs, i: 0, answers: Array(qs.length).fill(null), finished: false });
  }
}
