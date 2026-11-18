import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import TabBar from "../../components/TabBar";
import { SCIENCE_UNITS, findScienceUnit } from "../../data/science";
import { overall } from "../../domain/aiRecords";
import { loadScienceStore, saveScienceStore } from "../../storage";
import type { AiStore, ScienceUnit } from "../../types";
import ScienceExam from "./ScienceExam";
import SciencePractice from "./SciencePractice";
import { ScienceStoreContext } from "./ScienceQuizCard";
import ScienceWrong from "./ScienceWrong";

const TABS = [
  { id: "practice", label: "✏️ 练习" },
  { id: "exam", label: "🏆 模拟考" },
  { id: "wrong", label: "❌ 错题本" },
];

/** 校内科学容器：/science 是单元列表；/science/:unitId/:tab 进入某单元的练习/模拟考/错题本。
 *  每个单元独立的 localStorage（swcode_science_<unitId>_v1），新单元零改码接入。 */
export default function ScienceApp() {
  const { pathname } = useLocation();
  const segs = pathname.replace(/^\/science\/?/, "").split("/").filter(Boolean);
  const unit = findScienceUnit(segs[0]);
  if (!unit) return <UnitList />;
  return <UnitView key={unit.id} unit={unit} tab={segs[1]} />;
}

function UnitList() {
  const navigate = useNavigate();
  const totalQ = SCIENCE_UNITS.reduce((s, u) => s + u.questions.length, 0);
  return (
    <div className="card">
      <h2 className="sec">📖 科学复习 <small>一个单元一个关卡</small></h2>
      <div className="grid">
        {SCIENCE_UNITS.map((u) => (
          <button key={u.id} className="tile" onClick={() => navigate(`/science/${u.id}/practice`)}>
            <span className="emoji">{u.emoji}</span>
            <b>{u.name}</b>
            <div className="sub">{u.chapters.length} 课 · {u.questions.length} 题 · 练习 / 模拟考 / 错题本</div>
          </button>
        ))}
      </div>
      <p style={{ textAlign: "center", fontSize: 15, marginTop: 14 }}>
        共 {SCIENCE_UNITS.length} 个单元 · {totalQ} 题 · 新单元资料来了会出现在这里
      </p>
    </div>
  );
}

function UnitView({ unit, tab }: { unit: ScienceUnit; tab?: string }) {
  const navigate = useNavigate();
  const [store, setStore] = useState<AiStore>(() => loadScienceStore(unit.id));
  useEffect(() => { saveScienceStore(unit.id, store); }, [unit.id, store]);

  const active = TABS.some((t) => t.id === tab) ? tab! : "practice";
  const o = overall(store);
  const best = store.examHistory.length ? Math.max(...store.examHistory.map((h) => h.score)) : null;

  return (
    <ScienceStoreContext.Provider value={{ store, setStore }}>
      <div className="hero">
        <h1>{unit.emoji} {unit.name}</h1>
        <p>{unit.chapters.length} 课 · {unit.questions.length} 题 · 考前复习通关</p>
        <div className="chips">
          <span className="chip">🗂 已刷 {o.tried} 题</span>
          <span className="chip">🎯 正确率 {o.acc}%</span>
          <span className="chip">❌ 错题 {store.wrongBook.length} 题</span>
          <span className="chip">{best !== null ? `🏅 模拟考最高 ${best} 分` : "🏅 还没考过试"}</span>
        </div>
      </div>

      <Link className="back" to="/" style={{ display: "inline-block", margin: "12px 0 0" }}>⬅️ 返回首页</Link>

      <TabBar
        tabs={TABS.map((t) => (t.id === "wrong" ? { ...t, badge: store.wrongBook.length } : t))}
        active={active}
        onSelect={(id) => navigate(`/science/${unit.id}/${id}`)}
      />

      {active === "practice" && <SciencePractice unit={unit} />}
      {active === "exam" && <ScienceExam unit={unit} />}
      {active === "wrong" && <ScienceWrong unit={unit} />}
    </ScienceStoreContext.Provider>
  );
}
