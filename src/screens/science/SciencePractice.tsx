import { useState } from "react";
import { LETTERS } from "../../data";
import { chapterStats, recordAnswer } from "../../domain/aiRecords";
import { shuffle } from "../../domain/utils";
import type { ScienceUnit } from "../../types";
import ScienceQuizCard, { type ScienceQuizSession, useScienceStore } from "./ScienceQuizCard";

/** 按课刷题：章节列表 → 逐题作答（即时反馈 + 解析） */
export default function SciencePractice({ unit }: { unit: ScienceUnit }) {
  const { store, setStore } = useScienceStore();
  const [quiz, setQuiz] = useState<ScienceQuizSession | null>(null);

  if (quiz) {
    return (
      <ScienceQuizCard
        quiz={quiz}
        mode="practice"
        onPick={(i) => {
          if (quiz.picked !== null) return;
          const q = quiz.qs[quiz.i];
          const correct = LETTERS[i] === q.answer;
          setStore((s) => recordAnswer(s, q.id, correct));
          setQuiz({ ...quiz, picked: i, right: quiz.right + (correct ? 1 : 0), wrong: quiz.wrong + (correct ? 0 : 1) });
        }}
        onNext={() => setQuiz({ ...quiz, i: quiz.i + 1, picked: null })}
      />
    );
  }

  return (
    <div className="card">
      <h2 className="sec">✏️ 按课刷题 <small>点击选项立刻知道对错</small></h2>
      <div className="grid">
        {unit.chapters.map((c) => {
          const qs = unit.questions.filter((q) => q.chapter === c);
          const st = chapterStats(store, qs);
          return (
            <button key={c} className="tile" onClick={() => setQuiz({ qs: shuffle(qs), i: 0, picked: null, right: 0, wrong: 0, graduated: 0 })}>
              <b>{c}</b>
              <div className="sub">{qs.length} 题 · 已刷 {st.tried} · 正确率 {st.acc}%{st.wrongActive ? ` · ❌${st.wrongActive}` : ""}</div>
              <div className="bar"><i style={{ width: `${st.tried ? Math.min(100, st.acc) : 0}%` }} /></div>
            </button>
          );
        })}
      </div>
      <div className="btn-row" style={{ justifyContent: "center", marginTop: 14 }}>
        <button className="btn" onClick={() => setQuiz({ qs: shuffle(unit.questions), i: 0, picked: null, right: 0, wrong: 0, graduated: 0 })}>
          🎲 整个单元混着刷（{unit.questions.length} 题）
        </button>
      </div>
    </div>
  );
}
