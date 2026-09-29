import { useRef } from "react";
import { BANK_EMOJI, QUESTIONS } from "../../data";
import { PASS_SCORE } from "../../domain/aiExam";
import { chapterStats, overall } from "../../domain/aiRecords";
import { freshAiStore } from "../../storage";
import { useAiStore } from "./AiApp";
import type { AiStore } from "../../types";

export default function StatsScreen() {
  const { store, setStore } = useAiStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const o = overall(store);
  const examRows = store.examHistory.slice(-10).reverse();

  function exportData() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(String(reader.result)) as AiStore;
        if (typeof s !== "object" || typeof s.answers !== "object" || !Array.isArray(s.wrongBook)) {
          throw new Error("bad shape");
        }
        setStore({ ...freshAiStore(), ...s });
        alert("导入成功 ✅");
      } catch {
        alert("这个文件不是有效的备份，导入失败 ❌");
      }
    };
    reader.readAsText(file);
  }

  function wipeData() {
    if (window.confirm("确定要清空全部学习记录吗？此操作不可恢复！") && window.confirm("真的确定吗？建议先导出备份！")) {
      setStore(freshAiStore());
    }
  }

  return (
    <div className="card">
      <h2 className="sec">📊 掌握度 <small>已刷 {o.total} 题 · 总正确率 {o.acc}%</small></h2>
      {QUESTIONS.banks.map((b) => (
        <div key={b.name}>
          <h2 className="sec" style={{ marginTop: 16, fontSize: 18 }}>{BANK_EMOJI[b.name]} {b.name}</h2>
          {b.chapters.map((c) => {
            const qs = b.questions.filter((q) => q.chapter === c);
            const st = chapterStats(store, qs);
            return (
              <div className="stat-row" key={c}>
                <span className="name">{c}</span>
                <div className="bar"><i style={{ width: `${st.acc}%` }} /></div>
                <span className="val">刷{st.tried}/{qs.length} · {st.acc}%{st.wrongActive ? <span className="mini-badge">❌{st.wrongActive}</span> : null}</span>
              </div>
            );
          })}
        </div>
      ))}
      {examRows.length > 0 && (
        <>
          <h2 className="sec" style={{ marginTop: 20 }}>🏆 模拟考成绩</h2>
          {examRows.map((h, i) => {
            const color = h.score >= PASS_SCORE ? "var(--green)" : "var(--orange)";
            return (
              <div className="exam-hist" key={i}>
                <span className="d">{h.d}</span>
                <div className="bar"><i style={{ width: `${h.score}%`, background: color }} /></div>
                <b style={{ color }}>{h.score} 分</b>
              </div>
            );
          })}
        </>
      )}
      <h2 className="sec" style={{ marginTop: 20 }}>💾 备份</h2>
      <p style={{ fontSize: 15, color: "var(--ink-soft)" }}>学习记录保存在浏览器里，清缓存会丢失。定期导出一个 JSON 文件存在安全的地方。</p>
      <div className="btn-row">
        <button className="btn ghost small" onClick={exportData}>⬇️ 导出备份</button>
        <button className="btn ghost small" onClick={() => fileRef.current?.click()}>⬆️ 导入备份</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
        <button className="btn ghost small" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={wipeData}>🗑 清空全部记录</button>
      </div>
    </div>
  );
}
