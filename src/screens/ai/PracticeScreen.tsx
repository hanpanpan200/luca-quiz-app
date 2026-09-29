import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BANK_EMOJI, LETTERS, QUESTIONS } from "../../data";
import { recordAnswer } from "../../domain/aiRecords";
import { answerable, shuffle } from "../../domain/utils";
import QuizCard, { type QuizSession } from "./QuizCard";
import { useAiStore } from "./AiApp";
import { chapterStats } from "../../domain/aiRecords";

interface Props {
  bank?: string;
}

export default function PracticeScreen({ bank: bankIdxS }: Props) {
  const navigate = useNavigate();
  const { store, setStore } = useAiStore();
  const [quiz, setQuiz] = useState<QuizSession | null>(null);
  const bankIdx = bankIdxS !== undefined && QUESTIONS.banks[Number(bankIdxS)] ? Number(bankIdxS) : undefined;

  if (quiz) {
    return (
      <QuizCard
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

  if (bankIdx === undefined) {
    return (
      <div className="card">
        <h2 className="sec">✏️ 逐章刷题 <small>点击选项立刻知道对错</small></h2>
        <div className="grid">
          {QUESTIONS.banks.map((b, i) => (
            <button key={b.name} className="tile" onClick={() => navigate(`/ai/practice/${i}`)}>
              <span className="emoji">{BANK_EMOJI[b.name]}</span><b>{b.name}</b>
              <div className="sub">{answerable(b.questions).length} 题可练</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const b = QUESTIONS.banks[bankIdx];
  return (
    <div className="card">
      <Link className="back" to="/ai/practice">⬅️ 返回</Link>
      <h2 className="sec">{BANK_EMOJI[b.name]} {b.name}</h2>
      <div className="grid">
        {b.chapters.map((c, i) => {
          const qs = b.questions.filter((q) => q.chapter === c);
          const st = chapterStats(store, qs);
          return (
            <button key={c} className="tile" onClick={() => startChapter(i)}>
              <b>{c}</b>
              <div className="sub">{qs.length} 题 · 已刷 {st.tried} · 正确率 {st.acc}%{st.wrongActive ? ` · ❌${st.wrongActive}` : ""}</div>
              <div className="bar"><i style={{ width: `${st.tried ? Math.min(100, st.acc) : 0}%` }} /></div>
            </button>
          );
        })}
      </div>
    </div>
  );

  function startChapter(chapterIdx: number) {
    const bank = QUESTIONS.banks[bankIdx!];
    const qs = shuffle(answerable(bank.questions.filter((q) => q.chapter === bank.chapters[chapterIdx])));
    setQuiz({ qs, i: 0, picked: null, right: 0, wrong: 0, graduated: 0 });
  }
}
