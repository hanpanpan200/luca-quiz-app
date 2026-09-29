import { Link, useNavigate } from "react-router-dom";
import { CIRCUITS } from "../../data";
import { useChipStore } from "./ChipApp";
import { CircuitImage } from "./ChipSessionScreen";

interface Props {
  cat?: string;
}

export default function ChipStudyScreen({ cat }: Props) {
  const navigate = useNavigate();
  const { store } = useChipStore();
  const category = CIRCUITS.categories.find((c) => c.id === cat);

  if (category) {
    const qs = CIRCUITS.questions.filter((q) => q.category === category.id);
    return (
      <div className="card">
        <Link className="back" to="/chip/chipStudy">⬅️ 返回考点列表</Link>
        <h2 className="sec">{category.emoji} {category.name} <small>{qs.length} 题</small></h2>
        {qs.map((q) => (
          <div className="study-q" key={q.id}>
            <div className="q-head">
              <span className="no">{q.no}</span>
              <div className="q-text" style={{ fontSize: 17 }}>{q.text}</div>
            </div>
            <div style={{ margin: "10px 0 4px 34px", textAlign: "left" }}><CircuitImage q={q} /></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="sec">📖 电路考点 <small>先看懂图，再记套路</small></h2>
      <div className="grid">
        {CIRCUITS.categories.map((c) => {
          const qs = CIRCUITS.questions.filter((q) => q.category === c.id);
          const tried = qs.filter((q) => store.attempts[q.id]).length;
          return (
            <button key={c.id} className="tile" onClick={() => navigate(`/chip/chipStudy/${c.id}`)}>
              <span className="emoji">{c.emoji}</span><b>{c.name}</b>
              <div className="sub">{qs.length} 题 · 已练 {tried} 题</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
