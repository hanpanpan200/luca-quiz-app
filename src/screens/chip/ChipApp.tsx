import { createContext, useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import TabBar from "../../components/TabBar";
import { loadChipStore, saveChipStore } from "../../storage";
import type { ChipStore } from "../../types";
import ChipExamScreen from "./ChipExamScreen";
import ChipPracticeScreen from "./ChipPracticeScreen";
import ChipStatsScreen from "./ChipStatsScreen";
import ChipStudyScreen from "./ChipStudyScreen";
import ChipWrongbookScreen from "./ChipWrongbookScreen";

const TABS = [
  { id: "chipStudy", label: "📖 学习" },
  { id: "chipPractice", label: "✏️ 练习" },
  { id: "chipExam", label: "🏆 模拟考" },
  { id: "chipWrong", label: "⏰ 超时本" },
  { id: "chipStats", label: "📊 统计" },
];

const ChipStoreContext = createContext<{ store: ChipStore; setStore: React.Dispatch<React.SetStateAction<ChipStore>> } | null>(null);

export function useChipStore() {
  const ctx = useContext(ChipStoreContext);
  if (!ctx) throw new Error("useChipStore 必须在 ChipApp 内使用");
  return ctx;
}

/** 电子创芯赛容器：tab 路由 + 存储上下文。路由形如 /chip/:tab[/study/:cat]。 */
export default function ChipApp() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [store, setStore] = useState<ChipStore>(() => loadChipStore());
  useEffect(() => { saveChipStore(store); }, [store]);

  const segs = pathname.replace(/^\/chip\/?/, "").split("/").filter(Boolean);
  const tab = TABS.some((t) => t.id === segs[0]) ? segs[0] : "chipStudy";
  const cat = segs[1];

  return (
    <ChipStoreContext.Provider value={{ store, setStore }}>
      <Link className="back" to="/" style={{ display: "inline-block", margin: "12px 0 0" }}>⬅️ 换个比赛</Link>
      <TabBar
        tabs={TABS.map((t) => (t.id === "chipWrong" ? { ...t, badge: store.wrongBook.length } : t))}
        active={tab}
        onSelect={(id) => navigate(`/chip/${id}`)}
      />
      {tab === "chipStudy" && <ChipStudyScreen cat={cat} />}
      {tab === "chipPractice" && <ChipPracticeScreen />}
      {tab === "chipExam" && <ChipExamScreen />}
      {tab === "chipWrong" && <ChipWrongbookScreen />}
      {tab === "chipStats" && <ChipStatsScreen />}
    </ChipStoreContext.Provider>
  );
}
