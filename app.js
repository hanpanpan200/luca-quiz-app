/* 实物编程小课堂 · 单页应用
 * 数据：questions.json（由 tools/extract.py 生成）
 * 存储：localStorage "swcode_quiz_v1"
 * 规则：练习/模拟考答错 → 进错题本；错题重刷连对 2 次 → 毕业
 */
"use strict";

const STORE_KEY = "swcode_quiz_v1";
const TABS = [
  { id: "study", label: "📖 学习" },
  { id: "practice", label: "✏️ 练习" },
  { id: "exam", label: "🏆 模拟考" },
  { id: "wrong", label: "❌ 错题本" },
  { id: "stats", label: "📊 统计" },
];
const BANK_EMOJI = { 基础版: "🧱", 进阶版: "🚀", 高阶版: "👑" };
const LETTERS = ["A", "B", "C", "D"];
const EXAM_SIZE = 20;
const PASS_SCORE = 60;

let DATA = null;          // {banks:[{name,chapters,questions}]}
let store = null;         // 持久化状态
let view = { tab: "study" }; // 当前视图状态

/* ================= 存储层 ================= */

function freshStore() {
  return { answers: {}, wrongBook: [], graduated: [], examHistory: [], v: 1 };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshStore();
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object" || typeof s.answers !== "object" ||
      !Array.isArray(s.wrongBook) || !Array.isArray(s.examHistory)) {
      return freshStore();
    }
    return { ...freshStore(), ...s };
  } catch {
    return freshStore();
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function stat(qid) {
  return store.answers[qid] || { r: 0, w: 0, streak: 0, ts: 0 };
}

/** 练习/模拟考的记录：答错进错题本；答对只累计次数 */
function recordAnswer(qid, correct) {
  const s = stat(qid);
  if (correct) s.r += 1;
  else {
    s.w += 1;
    s.streak = 0;
    if (!store.wrongBook.includes(qid)) store.wrongBook.push(qid);
  }
  s.ts = Date.now();
  store.answers[qid] = s;
  save();
}

/** 错题重刷：连对 2 次毕业（从未活跃错题本移除）；答错重新计数 */
function recordWrongQuiz(qid, correct) {
  const s = stat(qid);
  if (correct) {
    s.streak += 1;
    s.r += 1;
    if (s.streak >= 2 && store.wrongBook.includes(qid)) {
      store.wrongBook = store.wrongBook.filter((x) => x !== qid);
      if (!store.graduated.includes(qid)) store.graduated.push(qid);
    }
  } else {
    s.streak = 0;
    s.w += 1;
  }
  s.ts = Date.now();
  store.answers[qid] = s;
  save();
}

/* ================= 工具 ================= */

const esc = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bank(idx) { return DATA.banks[idx]; }

/** 可答题池：排除待确认答案的题 */
function answerable(qs) { return qs.filter((q) => !q.needs_review); }

function findQ(qid) {
  for (const b of DATA.banks) {
    const q = b.questions.find((x) => x.id === qid);
    if (q) return q;
  }
  return null;
}

function chapterQs(b, chapter) {
  return b.questions.filter((q) => q.chapter === chapter);
}

function chapterStats(b, chapter) {
  let tried = 0, right = 0, wrong = 0, wrongActive = 0;
  for (const q of chapterQs(b, chapter)) {
    const s = store.answers[q.id];
    if (s && s.r + s.w > 0) { tried += 1; right += s.r; wrong += s.w; }
    if (store.wrongBook.includes(q.id)) wrongActive += 1;
  }
  const total = right + wrong;
  const acc = total ? Math.round((right / total) * 100) : 0;
  return { tried, acc, total, wrongActive };
}

function overall() {
  let r = 0, w = 0, tried = 0;
  for (const s of Object.values(store.answers)) {
    r += s.r; w += s.w;
    if (s.r + s.w > 0) tried += 1;
  }
  const total = r + w;
  return { tried, total, acc: total ? Math.round((r / total) * 100) : 0 };
}

/* ================= 渲染骨架 ================= */

function renderTabs() {
  const el = document.getElementById("tabs");
  el.innerHTML = TABS.map((t) => {
    const badge = t.id === "wrong" && store.wrongBook.length
      ? `<span class="badge">${store.wrongBook.length}</span>` : "";
    const cls = view.tab === t.id ? "on" : "";
    return `<button class="${cls}" onclick="go('${t.id}')">${t.label}${badge}</button>`;
  }).join("");
}

function renderHero() {
  const o = overall();
  const best = store.examHistory.length
    ? Math.max(...store.examHistory.map((h) => h.score)) : null;
  document.getElementById("heroChips").innerHTML = [
    `🗂 已刷 ${o.tried} 题`,
    `🎯 正确率 ${o.acc}%`,
    `❌ 错题 ${store.wrongBook.length} 题`,
    best !== null ? `🏅 模拟考最高 ${best} 分` : `🏅 还没考过试`,
  ].map((c) => `<span class="chip">${c}</span>`).join("");
}

function render() {
  renderTabs();
  renderHero();
  const app = document.getElementById("app");
  const fn = {
    study: renderStudy, practice: renderPractice, exam: renderExam,
    wrong: renderWrong, stats: renderStats,
  }[view.tab];
  app.innerHTML = fn();
  window.scrollTo(0, 0);
}

function go(tab) { view = { tab }; render(); }
function back(restore) { view = { ...restore }; render(); }

/* ================= 学习模式 ================= */

function renderStudy() {
  const v = view;
  if (v.bankIdx === undefined) {
    return `<div class="card"><h2 class="sec">📖 先当课本读一遍 <small>看题 + 记答案</small></h2>
      <div class="grid">${DATA.banks.map((b, i) => `
        <button class="tile" onclick="view.bankIdx=${i};render()">
          <span class="emoji">${BANK_EMOJI[b.name]}</span>
          <b>${esc(b.name)}</b>
          <div class="sub">${b.questions.length} 题 · ${esc(b.chapters.join(" / "))}</div>
        </button>`).join("")}
      </div></div>`;
  }
  const b = bank(v.bankIdx);
  if (v.chapterIdx === undefined) {
    return `<div class="card">
      <button class="back" onclick="back({tab:'study'})">⬅️ 返回选择题库</button>
      <h2 class="sec">${BANK_EMOJI[b.name]} ${esc(b.name)}</h2>
      <div class="grid">${b.chapters.map((c, i) => `
        <button class="tile" onclick="view.chapterIdx=${i};render()">
          <b>${esc(c)}</b>
          <div class="sub">${chapterQs(b, c).length} 题</div>
        </button>`).join("")}
      </div></div>`;
  }
  const chapter = b.chapters[v.chapterIdx];
  const qs = chapterQs(b, chapter);
  return `<div class="card">
    <button class="back" onclick="back({tab:'study',bankIdx:${v.bankIdx}})">⬅️ 返回章节</button>
    <h2 class="sec">📖 ${esc(chapter)} <small>${qs.length} 题 · 绿色为正确答案</small></h2>
    ${qs.map((q) => `
      <div class="study-q">
        <div class="q-head">
          <span class="no">${q.qno}.</span>
          <div><span class="q-text" style="font-size:19px">${esc(q.text)}</span>
          ${q.needs_review ? '<span class="tag-review">⚠️ 答案待家长确认</span>' : ""}</div>
        </div>
        <ul>${q.options.map((o, i) => `
          <li class="${!q.needs_review && q.answer === LETTERS[i] ? "correct" : ""}">
            ${LETTERS[i]}. ${esc(o)}${!q.needs_review && q.answer === LETTERS[i] ? " ✅" : ""}
          </li>`).join("")}
        </ul>
      </div>`).join("")}
  </div>`;
}

/* ================= 练习模式 ================= */

function renderPractice() {
  const v = view;
  if (v.bankIdx === undefined) {
    return `<div class="card"><h2 class="sec">✏️ 逐章刷题 <small>点击选项立刻知道对错</small></h2>
      <div class="grid">${DATA.banks.map((b, i) => `
        <button class="tile" onclick="view.bankIdx=${i};render()">
          <span class="emoji">${BANK_EMOJI[b.name]}</span><b>${esc(b.name)}</b>
          <div class="sub">${answerable(b.questions).length} 题可练</div>
        </button>`).join("")}
      </div></div>`;
  }
  const b = bank(v.bankIdx);
  if (v.chapterIdx === undefined) {
    return `<div class="card">
      <button class="back" onclick="back({tab:'practice'})">⬅️ 返回</button>
      <h2 class="sec">${BANK_EMOJI[b.name]} ${esc(b.name)}</h2>
      <div class="grid">${b.chapters.map((c, i) => {
        const st = chapterStats(b, c);
        const pct = st.tried ? Math.min(100, st.acc) : 0;
        return `<button class="tile" onclick="startPractice(${v.bankIdx},${i})">
          <b>${esc(c)}</b>
          <div class="sub">${chapterQs(b, c).length} 题 · 已刷 ${st.tried} · 正确率 ${st.acc}%${st.wrongActive ? ` · ❌${st.wrongActive}` : ""}</div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </button>`;
      }).join("")}
      </div></div>`;
  }
  // 答题进行中 / 结束页 由 startPractice 建立的 v.quiz 控制
  return renderQuizCard(v, "practice");
}

function startPractice(bankIdx, chapterIdx) {
  const b = bank(bankIdx);
  const qs = shuffle(answerable(chapterQs(b, b.chapters[chapterIdx])));
  view = { tab: "practice", bankIdx, chapterIdx, quiz: { qs, i: 0, picked: null, right: 0, wrong: 0 } };
  render();
}

/** 练习与错题重刷共用的答题卡片 */
function renderQuizCard(v, mode) {
  const quiz = v.quiz;
  if (quiz.i >= quiz.qs.length) {
    const acc = quiz.qs.length ? Math.round((quiz.right / quiz.qs.length) * 100) : 0;
    const grad = quiz.graduated || 0;
    return `<div class="card">
      <div class="score-hero">
        <span class="confetti">${acc >= 80 ? "🎉🎊✨" : acc >= 60 ? "👍🌈" : "💪加油"}</span>
        <div class="verdict">本轮完成！对 ${quiz.right} · 错 ${quiz.wrong} · 正确率 ${acc}%</div>
        ${grad ? `<p style="margin-top:8px;font-size:18px">🎓 本轮有 ${grad} 道错题毕业啦！</p>` : ""}
      </div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn" onclick="${mode === "practice" ? `startPractice(${v.bankIdx},${v.chapterIdx})` : "startWrongQuiz()"}">🔄 再来一轮</button>
        ${mode === "practice" ? `<button class="btn ghost" onclick="back({tab:'practice',bankIdx:${v.bankIdx}})">📚 换个章节</button>` : `<button class="btn ghost" onclick="go('wrong')">❌ 回错题本</button>`}
      </div>
    </div>`;
  }
  const q = quiz.qs[quiz.i];
  const picked = quiz.picked;
  const done = picked !== null;
  const isRight = done && LETTERS[picked] === q.answer;
  return `<div class="card">
    <div class="q-meta">第 ${quiz.i + 1} / ${quiz.qs.length} 题 · ${esc(q.bank)} · ${esc(q.chapter)}</div>
    <div class="progress"><i style="width:${((quiz.i) / quiz.qs.length) * 100}%"></i></div>
    <div class="q-text">${esc(q.text)}</div>
    <div class="opts">${q.options.map((o, i) => {
      let cls = "";
      if (done) {
        if (LETTERS[i] === q.answer) cls = "correct";
        else if (i === picked) cls = "wrong";
      }
      return `<button class="opt ${cls}" ${done ? "disabled" : ""}
        onclick="pick(${i})">
        <span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span>
      </button>`;
    }).join("")}
    </div>
    ${done ? `
      <div class="feedback ${isRight ? "ok" : "no"}">
        ${isRight ? "答对啦！你真棒 🎉" : `答错啦，正确答案是 ${q.answer}，记住它哦 💪`}
        ${mode === "wrong" && isRight && stat(q.id).streak < 2 ? `<div style="font-size:15px;font-weight:400;margin-top:4px">再连对 ${2 - stat(q.id).streak} 次这道题就毕业啦</div>` : ""}
        ${mode === "wrong" && isRight && stat(q.id).streak >= 2 ? `<div style="font-size:15px;font-weight:400;margin-top:4px">🎓 这道题毕业啦！</div>` : ""}
      </div>
      <div class="btn-row" style="justify-content:flex-end">
        <button class="btn" onclick="nextQ('${mode}')">${quiz.i + 1 >= quiz.qs.length ? "🏁 完成" : "下一题 ➡️"}</button>
      </div>` : ""}
  </div>`;
}

function pick(i) {
  const quiz = view.quiz;
  if (!quiz || quiz.picked !== null) return;
  const q = quiz.qs[quiz.i];
  const correct = LETTERS[i] === q.answer;
  quiz.picked = i;
  if (correct) quiz.right += 1; else quiz.wrong += 1;
  if (view.tab === "wrong") {
    recordWrongQuiz(q.id, correct);
    if (correct && stat(q.id).streak >= 2) quiz.graduated = (quiz.graduated || 0) + 1;
  } else {
    recordAnswer(q.id, correct);
  }
  render();
}

function nextQ() {
  const quiz = view.quiz;
  quiz.i += 1;
  quiz.picked = null;
  render();
}

/* ================= 模拟考 ================= */

function renderExam() {
  const v = view;
  if (!v.exam) {
    const hist = store.examHistory.slice(-5).reverse();
    return `<div class="card">
      <h2 class="sec">🏆 模拟考 <small>完全按真实规则</small></h2>
      <div style="font-size:18px;line-height:2">
        <div>📝 从三套题库随机抽 <b>20 题</b>，每题 <b>5 分</b>，满分 100</div>
        <div>⏱ 不限时，但要像真考试一样认真哦</div>
        <div>✅ <b>60 分</b> = 拿到市赛现场赛入场券</div>
        <div>❌ 答错的题会自动进错题本</div>
      </div>
      <div class="btn-row"><button class="btn warn" onclick="startExam()">🚀 开始考试</button></div>
      ${hist.length ? `<h2 class="sec" style="margin-top:22px">最近成绩</h2>${hist.map((h) => {
        const pct = h.score;
        const color = h.score >= PASS_SCORE ? "var(--green)" : "var(--orange)";
        return `<div class="exam-hist">
          <span class="d">${h.d}</span>
          <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
          <b style="color:${color}">${h.score} 分</b>
          <span>${h.score >= PASS_SCORE ? "✅晋级" : "💪继续"}</span>
        </div>`;
      }).join("")}` : ""}
    </div>`;
  }
  const exam = v.exam;
  if (exam.finished) return renderExamResult(exam);
  return renderExamPaper(exam);
}

function startExam() {
  const pool = answerable(DATA.banks.flatMap((b) => b.questions));
  const qs = shuffle(pool).slice(0, EXAM_SIZE);
  view = { tab: "exam", exam: { qs, i: 0, answers: Array(qs.length).fill(null), finished: false, submitted: false } };
  render();
}

function renderExamPaper(exam) {
  const q = exam.qs[exam.i];
  const picked = exam.answers[exam.i];
  const answered = exam.answers.filter((a) => a !== null).length;
  return `<div class="card">
    <div class="q-meta">📝 第 ${exam.i + 1} / ${exam.qs.length} 题 · 已答 ${answered} 题</div>
    <div class="dots">${exam.qs.map((_, i) =>
      `<button class="dot ${i === exam.i ? "cur" : exam.answers[i] !== null ? "done" : ""}"
        onclick="view.exam.i=${i};render()">${i + 1}</button>`).join("")}
    </div>
    <div class="q-text">${esc(q.text)}</div>
    <div class="opts">${q.options.map((o, i) =>
      `<button class="opt ${picked === i ? "picked" : ""}" onclick="examPick(${i})">
        <span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span>
      </button>`).join("")}
    </div>
    <div class="btn-row" style="justify-content:space-between">
      <button class="btn ghost" ${exam.i === 0 ? "disabled style='opacity:.4'" : ""} onclick="view.exam.i--;render()">⬅️ 上一题</button>
      ${exam.i + 1 < exam.qs.length
        ? `<button class="btn" onclick="view.exam.i++;render()">下一题 ➡️</button>`
        : `<button class="btn warn" onclick="submitExam()">🔔 交卷</button>`}
    </div>
  </div>`;
}

function examPick(i) {
  const exam = view.exam;
  exam.answers[exam.i] = i;
  if (exam.i + 1 < exam.qs.length) exam.i += 1; // 选完自动跳下一题
  render();
}

function submitExam() {
  const exam = view.exam;
  const blank = exam.answers.filter((a) => a === null).length;
  if (blank > 0 && !confirm(`还有 ${blank} 题没答，确定交卷吗？`)) return;
  let score = 0;
  exam.qs.forEach((q, i) => {
    const a = exam.answers[i];
    if (a === null) return; // 未作答不计入统计，也不给分
    const correct = LETTERS[a] === q.answer;
    if (correct) score += 5;
    recordAnswer(q.id, correct);
  });
  exam.finished = true;
  exam.score = score;
  store.examHistory.push({
    d: new Date().toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
    score, total: exam.qs.length,
  });
  if (store.examHistory.length > 50) store.examHistory = store.examHistory.slice(-50);
  save();
  render();
}

function renderExamResult(exam) {
  const pass = exam.score >= PASS_SCORE;
  const wrongQs = exam.qs.filter((q, i) => exam.answers[i] === null || LETTERS[exam.answers[i]] !== q.answer);
  return `<div class="card">
    <div class="score-hero">
      <span class="confetti">${pass ? "🎉🎓🎊" : "💪"}</span>
      <div class="num ${pass ? "" : "fail"}">${exam.score}<span style="font-size:30px"> 分</span></div>
      <div class="verdict">${pass ? "恭喜！拿到市赛现场赛入场券啦 🎫" : `还差 ${PASS_SCORE - exam.score} 分，刷刷错题再来一次！`}</div>
    </div>
    ${wrongQs.length ? `<h2 class="sec" style="margin-top:18px">❌ 这几题答错了（已进错题本）</h2>
      ${wrongQs.map((q) => `
        <div class="study-q">
          <div class="q-head"><span class="no">·</span>
            <div><div style="font-size:18px">${esc(q.text)}</div>
            <ul>${q.options.map((o, i) => `
              <li class="${LETTERS[i] === q.answer ? "correct" : ""}">${LETTERS[i]}. ${esc(o)}${LETTERS[i] === q.answer ? " ✅" : ""}</li>`).join("")}
            </ul></div>
          </div>
        </div>`).join("")}` : `<p style="text-align:center;font-size:19px;margin-top:10px">全对！你就是满分战神 🏆</p>`}
    <div class="btn-row" style="justify-content:center">
      <button class="btn warn" onclick="startExam()">🔄 再考一次</button>
      <button class="btn ghost" onclick="go('wrong')">❌ 去刷错题</button>
    </div>
  </div>`;
}

/* ================= 错题本 ================= */

function renderWrong() {
  if (view.quiz) return renderQuizCard(view, "wrong"); // 重刷进行中
  const active = store.wrongBook.map(findQ).filter(Boolean);
  const gradN = store.graduated.length;
  if (!active.length) {
    return `<div class="card"><div class="empty">
      <span class="big">🎉</span>错题本空空的，太棒了！<br>
      <span style="font-size:15px">${gradN ? `已经毕业了 ${gradN} 道题` : "练习和模拟考里答错的题会自动收进来"}</span>
    </div></div>`;
  }
  const byBank = DATA.banks.map((b) => ({
    b, qs: active.filter((q) => q.bank === b.name),
  })).filter((x) => x.qs.length);
  return `<div class="card">
    <h2 class="sec">❌ 错题本 <small>连对 2 次就毕业 🎓</small></h2>
    <div class="btn-row"><button class="btn" onclick="startWrongQuiz()">🩹 开始重刷（${active.length} 题）</button></div>
    ${byBank.map(({ b, qs }) => `
      <h2 class="sec" style="margin-top:18px;font-size:18px">${BANK_EMOJI[b.name]} ${esc(b.name)}</h2>
      ${qs.map((q) => `
        <div class="stat-row">
          <span class="name" style="flex:2;font-size:16px">${esc(q.text)}</span>
          <span class="val">❌错 ${stat(q.id).w} 次${stat(q.id).streak ? ` · 连对${stat(q.id).streak}` : ""}</span>
        </div>`).join("")}
    `).join("")}
  </div>`;
}

function startWrongQuiz() {
  const qs = shuffle(store.wrongBook.map(findQ).filter(Boolean));
  view = { tab: "wrong", quiz: { qs, i: 0, picked: null, right: 0, wrong: 0, graduated: 0 } };
  render();
}

/* ================= 统计 & 备份 ================= */

function renderStats() {
  const o = overall();
  const examRows = store.examHistory.slice(-10).reverse().map((h) => {
    const color = h.score >= PASS_SCORE ? "var(--green)" : "var(--orange)";
    return `<div class="exam-hist">
      <span class="d">${h.d}</span>
      <div class="bar"><i style="width:${h.score}%;background:${color}"></i></div>
      <b style="color:${color}">${h.score} 分</b>
    </div>`;
  }).join("");
  return `<div class="card">
    <h2 class="sec">📊 掌握度 <small>已刷 ${o.total} 题 · 总正确率 ${o.acc}%</small></h2>
    ${DATA.banks.map((b) => `
      <h2 class="sec" style="margin-top:16px;font-size:18px">${BANK_EMOJI[b.name]} ${esc(b.name)}</h2>
      ${b.chapters.map((c) => {
        const st = chapterStats(b, c);
        const n = chapterQs(b, c).length;
        return `<div class="stat-row">
          <span class="name">${esc(c)}</span>
          <div class="bar"><i style="width:${st.acc}%"></i></div>
          <span class="val">刷${st.tried}/${n} · ${st.acc}%${st.wrongActive ? `<span class="mini-badge">❌${st.wrongActive}</span>` : ""}</span>
        </div>`;
      }).join("")}`).join("")}
    ${examRows ? `<h2 class="sec" style="margin-top:20px">🏆 模拟考成绩</h2>${examRows}` : ""}
    <h2 class="sec" style="margin-top:20px">💾 备份</h2>
    <p style="font-size:15px;color:var(--ink-soft)">学习记录保存在浏览器里，清缓存会丢失。定期导出一个 JSON 文件存在安全的地方。</p>
    <div class="btn-row">
      <button class="btn ghost small" onclick="exportData()">⬇️ 导出备份</button>
      <button class="btn ghost small" onclick="document.getElementById('imp').click()">⬆️ 导入备份</button>
      <input type="file" id="imp" accept=".json" style="display:none" onchange="importData(this)">
      <button class="btn ghost small" style="color:var(--red);border-color:var(--red)" onclick="wipeData()">🗑 清空全部记录</button>
    </div>
  </div>`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `quiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(input) {
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (typeof s !== "object" || typeof s.answers !== "object" || !Array.isArray(s.wrongBook)) {
        throw new Error("bad shape");
      }
      store = { ...freshStore(), ...s };
      save();
      alert("导入成功 ✅");
      render();
    } catch {
      alert("这个文件不是有效的备份，导入失败 ❌");
    }
  };
  reader.readAsText(f);
}

function wipeData() {
  if (confirm("确定要清空全部学习记录吗？此操作不可恢复！") && confirm("真的确定吗？建议先导出备份！")) {
    store = freshStore();
    save();
    render();
  }
}

/* ================= 启动 ================= */

async function boot() {
  try {
    const res = await fetch("questions.json");
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
    store = loadStore();
    render();
  } catch {
    document.getElementById("app").innerHTML =
      `<div class="card empty"><span class="big">😵</span>题库加载失败<br>
      <span style="font-size:15px">请用本地服务器打开（如在项目目录运行 <b>python3 -m http.server</b> 后访问 http://localhost:8000），不要直接双击文件</span></div>`;
  }
}

boot();
