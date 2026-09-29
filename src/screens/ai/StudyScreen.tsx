import { Link, useNavigate } from "react-router-dom";
import { BANK_EMOJI, LETTERS, QUESTIONS } from "../../data";

interface Props {
  bank?: string;
  chapter?: string;
}

export default function StudyScreen({ bank: bankIdxS, chapter: chapterIdxS }: Props) {
  const navigate = useNavigate();
  const bankIdx = bankIdxS !== undefined && QUESTIONS.banks[Number(bankIdxS)] ? Number(bankIdxS) : undefined;
  const chapterIdx = bankIdx !== undefined && chapterIdxS !== undefined && QUESTIONS.banks[bankIdx].chapters[Number(chapterIdxS)]
    ? Number(chapterIdxS) : undefined;

  if (bankIdx === undefined) {
    return (
      <div className="card">
        <h2 className="sec">📖 先当课本读一遍 <small>看题 + 记答案</small></h2>
        <div className="grid">
          {QUESTIONS.banks.map((b, i) => (
            <button key={b.name} className="tile" onClick={() => navigate(`/ai/study/${i}`)}>
              <span className="emoji">{BANK_EMOJI[b.name]}</span>
              <b>{b.name}</b>
              <div className="sub">{b.questions.length} 题 · {b.chapters.join(" / ")}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const b = QUESTIONS.banks[bankIdx];

  if (chapterIdx === undefined) {
    return (
      <div className="card">
        <Link className="back" to="/ai/study">⬅️ 返回选择题库</Link>
        <h2 className="sec">{BANK_EMOJI[b.name]} {b.name}</h2>
        <div className="grid">
          {b.chapters.map((c, i) => (
            <button key={c} className="tile" onClick={() => navigate(`/ai/study/${bankIdx}/${i}`)}>
              <b>{c}</b>
              <div className="sub">{b.questions.filter((q) => q.chapter === c).length} 题</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const chapter = b.chapters[chapterIdx];
  const qs = b.questions.filter((q) => q.chapter === chapter);
  return (
    <div className="card">
      <Link className="back" to={`/ai/study/${bankIdx}`}>⬅️ 返回章节</Link>
      <h2 className="sec">📖 {chapter} <small>{qs.length} 题 · 绿色为正确答案</small></h2>
      {qs.map((q) => (
        <div className="study-q" key={q.id}>
          <div className="q-head">
            <span className="no">{q.qno}.</span>
            <div>
              <span className="q-text" style={{ fontSize: 19 }}>{q.text}</span>
              {q.needs_review && <span className="tag-review">⚠️ 答案待家长确认</span>}
            </div>
          </div>
          <ul>
            {q.options.map((o, i) => (
              <li key={i} className={!q.needs_review && q.answer === LETTERS[i] ? "correct" : ""}>
                {LETTERS[i]}. {o}{!q.needs_review && q.answer === LETTERS[i] ? " ✅" : ""}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
