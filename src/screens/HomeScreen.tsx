import { useNavigate } from "react-router-dom";

export default function HomeScreen() {
  const navigate = useNavigate();
  return (
    <div className="card">
      <h2 className="sec">🏆 今天练哪个比赛？</h2>
      <div className="grid">
        <button className="tile" onClick={() => navigate("/chip")}>
          <span className="emoji">⚡</span>
          <b>电子创芯赛</b>
          <div className="sub">电路创新设计 · 现场搭 4 个电路</div>
        </button>
        <button className="tile" onClick={() => navigate("/ai")}>
          <span className="emoji">🤖</span>
          <b>AI 实物编程</b>
          <div className="sub">三套题库 174 题 · 学习 / 练习 / 模拟考</div>
        </button>
      </div>
    </div>
  );
}
