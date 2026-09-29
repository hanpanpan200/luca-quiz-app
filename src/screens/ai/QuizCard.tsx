import { LETTERS } from "../../data";
import { stat } from "../../domain/aiRecords";
import { useAiStore } from "./AiApp";
import type { Question } from "../../types";

export interface QuizSession {
  qs: Question[];
  i: number;
  picked: number | null;
  right: number;
  wrong: number;
  graduated: number;
}

interface Props {
  quiz: QuizSession;
  mode: "practice" | "wrong";
  onPick: (i: number) => void;
  onNext: () => void;
}

/** 练习与错题重刷共用的答题卡片 */
export default function QuizCard({ quiz, mode, onPick, onNext }: Props) {
  const { store } = useAiStore();

  if (quiz.i >= quiz.qs.length) {
    const acc = quiz.qs.length ? Math.round((quiz.right / quiz.qs.length) * 100) : 0;
    return (
      <div className="card">
        <div className="score-hero">
          <span className="confetti">{acc >= 80 ? "🎉🎊✨" : acc >= 60 ? "👍🌈" : "💪加油"}</span>
          <div className="verdict">本轮完成！对 {quiz.right} · 错 {quiz.wrong} · 正确率 {acc}%</div>
          {quiz.graduated ? <p style={{ marginTop: 8, fontSize: 18 }}>🎓 本轮有 {quiz.graduated} 道错题毕业啦！</p> : null}
        </div>
      </div>
    );
  }

  const q = quiz.qs[quiz.i];
  const picked = quiz.picked;
  const done = picked !== null;
  const isRight = done && LETTERS[picked] === q.answer;
  const s = stat(store, q.id);

  return (
    <div className="card">
      <div className="q-meta">第 {quiz.i + 1} / {quiz.qs.length} 题 · {q.bank} · {q.chapter}</div>
      <div className="progress"><i style={{ width: `${(quiz.i / quiz.qs.length) * 100}%` }} /></div>
      <div className="q-text">{q.text}</div>
      <div className="opts">
        {q.options.map((o, i) => {
          let cls = "";
          if (done) {
            if (LETTERS[i] === q.answer) cls = "correct";
            else if (i === picked) cls = "wrong";
          }
          return (
            <button key={i} className={`opt ${cls}`} disabled={done} onClick={() => onPick(i)}>
              <span className="letter">{LETTERS[i]}</span><span>{o}</span>
            </button>
          );
        })}
      </div>
      {done && (
        <>
          <div className={`feedback ${isRight ? "ok" : "no"}`}>
            {isRight ? "答对啦！你真棒 🎉" : `答错啦，正确答案是 ${q.answer}，记住它哦 💪`}
            {mode === "wrong" && isRight && s.streak < 2 && (
              <div style={{ fontSize: 15, fontWeight: 400, marginTop: 4 }}>再连对 {2 - s.streak} 次这道题就毕业啦</div>
            )}
            {mode === "wrong" && isRight && s.streak >= 2 && (
              <div style={{ fontSize: 15, fontWeight: 400, marginTop: 4 }}>🎓 这道题毕业啦！</div>
            )}
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={onNext}>{quiz.i + 1 >= quiz.qs.length ? "🏁 完成" : "下一题 ➡️"}</button>
          </div>
        </>
      )}
    </div>
  );
}
