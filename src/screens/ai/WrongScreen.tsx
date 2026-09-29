import { useState } from "react";
import { BANK_EMOJI, LETTERS, QUESTIONS, findQuestion } from "../../data";
import type { Question } from "../../types";
import { recordWrongQuiz, stat } from "../../domain/aiRecords";
import { shuffle } from "../../domain/utils";
import { useAiStore } from "./AiApp";
import QuizCard, { type QuizSession } from "./QuizCard";

export default function WrongScreen() {
  const { store, setStore } = useAiStore();
  const [quiz, setQuiz] = useState<QuizSession | null>(null);

  if (quiz) {
    return (
      <QuizCard
        quiz={quiz}
        mode="wrong"
        onPick={(i) => {
          if (quiz.picked !== null) return;
          const q = quiz.qs[quiz.i];
          const correct = LETTERS[i] === q.answer;
          setStore((s) => {
            const next = recordWrongQuiz(s, q.id, correct);
            return next;
          });
          // 毕业判定基于更新后的 streak
          const streakAfter = stat(store, q.id).streak + (correct ? 1 : 0);
          const graduatedNow = correct && streakAfter >= 2 && store.wrongBook.includes(q.id);
          setQuiz({
            ...quiz, picked: i,
            right: quiz.right + (correct ? 1 : 0), wrong: quiz.wrong + (correct ? 0 : 1),
            graduated: quiz.graduated + (graduatedNow ? 1 : 0),
          });
        }}
        onNext={() => setQuiz({ ...quiz, i: quiz.i + 1, picked: null })}
      />
    );
  }

  const active = store.wrongBook
    .map((id) => findQuestion(id))
    .filter((q): q is Question => Boolean(q));
  const gradN = store.graduated.length;

  if (!active.length) {
    return (
      <div className="card"><div className="empty">
        <span className="big">🎉</span>错题本空空的，太棒了！<br />
        <span style={{ fontSize: 15 }}>{gradN ? `已经毕业了 ${gradN} 道题` : "练习和模拟考里答错的题会自动收进来"}</span>
      </div></div>
    );
  }

  return (
    <div className="card">
      <h2 className="sec">❌ 错题本 <small>连对 2 次就毕业 🎓</small></h2>
      <div className="btn-row">
        <button className="btn" onClick={() => setQuiz({ qs: shuffle(active), i: 0, picked: null, right: 0, wrong: 0, graduated: 0 })}>
          🩹 开始重刷（{active.length} 题）
        </button>
      </div>
      {QUESTIONS.banks.map((b) => {
        const qs = active.filter((q) => q.bank === b.name);
        if (!qs.length) return null;
        return (
          <div key={b.name}>
            <h2 className="sec" style={{ marginTop: 18, fontSize: 18 }}>{BANK_EMOJI[b.name]} {b.name}</h2>
            {qs.map((q) => (
              <div className="stat-row" key={q.id}>
                <span className="name" style={{ flex: 2, fontSize: 16 }}>{q.text}</span>
                <span className="val">❌错 {stat(store, q.id).w} 次{stat(store, q.id).streak ? ` · 连对${stat(store, q.id).streak}` : ""}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
