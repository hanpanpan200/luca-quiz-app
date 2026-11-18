import { useNavigate } from "react-router-dom";
import { SCIENCE_UNITS } from "../data/science";

export default function HomeScreen() {
  const navigate = useNavigate();
  const scienceQ = SCIENCE_UNITS.reduce((s, u) => s + u.questions.length, 0);
  return (
    <div className="card">
      <h2 className="sec">🏆 今天练哪个比赛？</h2>

      <section>
        <h3 className="sec-sub">🚀 即将开始</h3>
        <div className="grid">
          <button className="tile" onClick={() => navigate("/ai")}>
            <span className="emoji">🤖</span>
            <b>AI 实物编程</b>
            <div className="sub">三套题库 174 题 · 学习 / 练习 / 模拟考</div>
          </button>
        </div>
      </section>

      <section>
        <h3 className="sec-sub">📖 校内复习</h3>
        <div className="grid">
          <button className="tile" onClick={() => navigate("/science")}>
            <span className="emoji">🌊</span>
            <b>科学</b>
            <div className="sub">{SCIENCE_UNITS.length} 个单元 · {scienceQ} 题 · 练习 / 模拟考 / 错题本</div>
          </button>
        </div>
      </section>

      <section>
        <h3 className="sec-sub">🏁 已结束</h3>
        <div className="grid">
          <button className="tile ended" onClick={() => navigate("/chip")}>
            <span className="emoji">⚡</span>
            <b>电子创芯赛 <span className="ended-tag">已结束</span></b>
            <div className="sub">电路创新设计 · 现场搭 4 个电路 · 题库仍可复习</div>
          </button>
        </div>
      </section>
    </div>
  );
}
