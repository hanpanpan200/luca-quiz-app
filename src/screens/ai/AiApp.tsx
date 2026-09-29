import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SectionToggle from "../../components/SectionToggle";
import TabBar from "../../components/TabBar";
import { overall } from "../../domain/aiRecords";
import { loadAiStore, saveAiStore } from "../../storage";
import type { AiStore } from "../../types";
import ExamScreen from "./ExamScreen";
import PracticeScreen from "./PracticeScreen";
import { ProgExam, ProgPractice, ProgTaskBrowser, ProgWrongBook } from "./ProgrammingScreen";
import StatsScreen from "./StatsScreen";
import StudyScreen from "./StudyScreen";
import WrongScreen from "./WrongScreen";
import { ProgProvider } from "./progStore";

const TABS = [
  { id: "study", label: "📖 学习" },
  { id: "practice", label: "✏️ 练习" },
  { id: "exam", label: "🏆 模拟考" },
  { id: "wrong", label: "❌ 错题本" },
  { id: "stats", label: "📊 统计" },
];

const AiStoreContext = createContext<{ store: AiStore; setStore: React.Dispatch<React.SetStateAction<AiStore>> } | null>(null);

export function useAiStore() {
  const ctx = useContext(AiStoreContext);
  if (!ctx) throw new Error("useAiStore 必须在 AiApp 内使用");
  return ctx;
}

/** AI 模块容器：顶部横幅 + tab 路由 + 存储上下文。
 * 学习/练习/模拟考/错题本四个 tab 内各有「选择题 / 编程题」子模块切换。
 * 路由形如 /ai/:tab[/study/:bank/:chapter | /practice/:bank]。 */
const SECTIONS = [
  { id: "quiz", label: "📘 选择题" },
  { id: "prog", label: "💻 编程题" },
] as const;

export default function AiApp() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [store, setStore] = useState<AiStore>(() => loadAiStore());
  const [section, setSection] = useState<"quiz" | "prog">("quiz");
  useEffect(() => { saveAiStore(store); }, [store]);

  const segs = pathname.replace(/^\/ai\/?/, "").split("/").filter(Boolean);
  const tab = TABS.some((t) => t.id === segs[0]) ? segs[0] : "study";
  const bank = segs[1]; // study/practice 都用第二段作题库
  const chapter = segs[2];

  // 切换 tab 时回到选择题子模块
  const prevTab = useRef(tab);
  useEffect(() => {
    if (prevTab.current !== tab) {
      prevTab.current = tab;
      setSection("quiz");
    }
  }, [tab]);

  const hasProg = tab !== "stats"; // 统计页不分子模块
  const active = hasProg ? section : "quiz" as const;

  const o = overall(store);
  const best = store.examHistory.length ? Math.max(...store.examHistory.map((h) => h.score)) : null;

  const progView = {
    study: <ProgTaskBrowser />,
    practice: <ProgPractice />,
    exam: <ProgExam />,
    wrong: <ProgWrongBook />,
  }[tab];

  return (
    <AiStoreContext.Provider value={{ store, setStore }}>
      <ProgProvider>
      <div className="hero">
        <h1>🌱 实物编程小课堂</h1>
        <p>Luca 的市赛入场券闯关 · 三套题库 174 题</p>
        <div className="chips">
          <span className="chip">🗂 已刷 {o.tried} 题</span>
          <span className="chip">🎯 正确率 {o.acc}%</span>
          <span className="chip">❌ 错题 {store.wrongBook.length} 题</span>
          <span className="chip">{best !== null ? `🏅 模拟考最高 ${best} 分` : "🏅 还没考过试"}</span>
        </div>
      </div>

      <Link className="back" to="/" style={{ display: "inline-block", margin: "12px 0 0" }}>⬅️ 换个比赛</Link>

      <TabBar
        tabs={TABS.map((t) => (t.id === "wrong" ? { ...t, badge: store.wrongBook.length } : t))}
        active={tab}
        onSelect={(id) => navigate(`/ai/${id}`)}
      />

      {hasProg && <SectionToggle options={SECTIONS} value={active} onChange={(id) => setSection(id as "quiz" | "prog")} />}

      {active === "prog" && progView}
      {active === "quiz" && (
        <>
          {tab === "study" && <StudyScreen bank={bank} chapter={chapter} />}
          {tab === "practice" && <PracticeScreen bank={bank} />}
          {tab === "exam" && <ExamScreen />}
          {tab === "wrong" && <WrongScreen />}
          {tab === "stats" && <StatsScreen />}
        </>
      )}
      </ProgProvider>
    </AiStoreContext.Provider>
  );
}
