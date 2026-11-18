import { createContext, useContext } from "react";
import { LETTERS } from "../../data";
import { stat } from "../../domain/aiRecords";
import type { AiStore, ScienceQuestion } from "../../types";

export interface ScienceQuizSession {
  qs: ScienceQuestion[];
  i: number;
  picked: number | null;
  right: number;
  wrong: number;
  graduated: number;
}

/** 单元内的答题存储上下文（由 ScienceApp 的单元视图提供） */
export const ScienceStoreContext = createContext<{ store: AiStore; setStore: React.Dispatch<React.SetStateAction<AiStore>> } | null>(null);

export function useScienceStore() {
  const ctx = useContext(ScienceStoreContext);
  if (!ctx) throw new Error("useScienceStore 必须在科学单元视图内使用");
  return ctx;
}

interface Props {
  quiz: ScienceQuizSession;
  mode: "practice" | "wrong";
  onPick: (i: number) => void;
  onNext: () => void;
}

/** 练习与错题重刷共用的答题卡片：答完显示对错 + 知识点解析 */
export default function ScienceQuizCard({ quiz, mode, onPick, onNext }: Props) {
  const { store } = useScienceStore();

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
      <div className="q-meta">第 {quiz.i + 1} / {quiz.qs.length} 题 · {q.chapter}</div>
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
            {isRight ? "答对啦！你真棒 🎉" : `答错啦，正确答案是 ${q.answer} 💪`}
            {mode === "wrong" && isRight && s.streak < 2 && (
              <div style={{ fontSize: 15, fontWeight: 400, marginTop: 4 }}>再连对 {2 - s.streak} 次这道题就毕业啦</div>
            )}
            {mode === "wrong" && isRight && s.streak >= 2 && (
              <div style={{ fontSize: 15, fontWeight: 400, marginTop: 4 }}>🎓 这道题毕业啦！</div>
            )}
          </div>
          <div className="explain">💡 {q.explanation}</div>
          <div className="btn-row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={onNext}>{quiz.i + 1 >= quiz.qs.length ? "🏁 完成" : "下一题 ➡️"}</button>
          </div>
        </>
      )}
    </div>
  );
}
