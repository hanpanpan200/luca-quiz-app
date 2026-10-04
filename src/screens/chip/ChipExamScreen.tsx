import { useState } from "react";
import { CIRCUITS } from "../../data";
import { sampleCircuitExam } from "../../domain/chipRules";
import ChipSessionScreen, { type ChipSession } from "./ChipSessionScreen";

export default function ChipExamScreen() {
  const [session, setSession] = useState<ChipSession | null>(null);
  const [seed, setSeed] = useState(0);

  function start() {
    setSeed((s) => s + 1); // 换 key 重挂会话组件：「再来一场」要清空进度/计时状态
    setSession({ mode: "exam", qs: sampleCircuitExam(CIRCUITS.questions, 4) });
  }

  if (session) {
    return <ChipSessionScreen key={seed} session={session} onExit={() => setSession(null)} onRestart={start} />;
  }

  return (
    <div className="card">
      <h2 className="sec">🏆 模拟考 <small>完全按真实赛制</small></h2>
      <div style={{ fontSize: 18, lineHeight: 2 }}>
        <div>📝 从 60 题随机抽 <b>4 题</b>，逐题计时</div>
        <div>⏱ 每题目标 <b>3 分钟</b>，超时会进超时本</div>
        <div>🏆 真实排名规则：<b>完成数 + 总用时</b></div>
        <div>✅ 拼完自己对照题目检查效果，点「我做完了」结束计时</div>
      </div>
      <div className="btn-row">
        <button className="btn warn" onClick={start}>🚀 开始考试</button>
      </div>
    </div>
  );
}
