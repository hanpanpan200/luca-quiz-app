import { Navigate, Route, Routes } from "react-router-dom";
import HomeScreen from "./screens/HomeScreen";
import AiApp from "./screens/ai/AiApp";
import ChipApp from "./screens/chip/ChipApp";

export default function App() {
  return (
    <div className="wrap">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/ai/*" element={<AiApp />} />
        <Route path="/chip/*" element={<ChipApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer>数据存在这台电脑的浏览器里 · 记得在「统计」页定期导出备份哦</footer>
    </div>
  );
}
