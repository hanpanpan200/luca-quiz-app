import { useState } from "react";
import { LETTERS } from "../../data";
import { recordWrongQuiz, stat } from "../../domain/aiRecords";
import { shuffle } from "../../domain/utils";
import type { ScienceUnit } from "../../types";
import ScienceQuizCard, { type ScienceQuizSession, useScienceStore } from "./ScienceQuizCard";

/** 单元错题本：答错自动收入，连对 2 次毕业 */
export default function ScienceWrong({ unit }: { unit: ScienceUnit }) {
  const { store, setStore } = useScienceStore();
  const [quiz, setQuiz] = useState<ScienceQuizSession | null>(null);

  if (quiz) {
    return (
      <ScienceQuizCard
        quiz={quiz}
        mode="wrong"
        onPick={(i) => {
          if (quiz.picked !== null) return;
          const q = quiz.qs[quiz.i];
          const correct = LETTERS[i] === q.answer;
          setStore((s) => recordWrongQuiz(s, q.id, correct));
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
    .map((id) => unit.questions.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q));
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
      {unit.chapters.map((c) => {
        const qs = active.filter((q) => q.chapter === c);
        if (!qs.length) return null;
        return (
          <div key={c}>
            <h2 className="sec" style={{ marginTop: 18, fontSize: 18 }}>📖 {c}</h2>
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
