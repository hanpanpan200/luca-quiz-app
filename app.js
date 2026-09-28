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
/* 模拟考分层配额：各题库抽题数（按竞赛难度金字塔 5:3:2 配置；改这里即可，计分自动适配满分 100） */
const EXAM_QUOTA = { "基础版": 10, "进阶版": 6, "高阶版": 4 };
const EXAM_SIZE = Object.values(EXAM_QUOTA).reduce((s, n) => s + n, 0);
const PASS_SCORE = 60;

let DATA = null;          // {banks:[{name,chapters,questions}]}
let CHIP_DATA = null;     // {time_limit_sec, categories, questions}
let store = null;         // 持久化状态
let chipStore = null;     // 电子创芯赛持久化状态（独立键）
let view = { screen: "home" }; // 当前视图状态：screen = home | ai | chip

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
  if (view.screen === "chip") {
    el.innerHTML = CHIP_TABS.map((t) => {
      const badge = t.id === "chipWrong" && chipStore && chipStore.wrongBook.length
        ? `<span class="badge">${chipStore.wrongBook.length}</span>` : "";
      const cls = view.tab === t.id ? "on" : "";
      return `<button class="${cls}" onclick="go('${t.id}')">${t.label}${badge}</button>`;
    }).join("");
    return;
  }
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
  const app = document.getElementById("app");
  const inAiApp = view.screen === "ai";
  const inChip = view.screen === "chip";
  document.getElementById("hero").style.display = inAiApp ? "" : "none";
  document.getElementById("homeBtn").style.display = inAiApp || inChip ? "" : "none";
  if (inAiApp) {
    renderTabs();
    renderHero();
    const fn = {
      study: renderStudy, practice: renderPractice, exam: renderExam,
      wrong: renderWrong, stats: renderStats,
    }[view.tab];
    app.innerHTML = fn();
  } else if (inChip) {
    renderTabs();
    const fn = {
      chipStudy: renderChipStudy, chipPractice: renderChipPractice,
      chipExam: renderChipExam, chipWrong: renderChipWrong, chipStats: renderChipStats,
    }[view.tab] || renderChipStudy;
    app.innerHTML = CHIP_DATA ? fn() : renderChipLoading();
    chipRenderSideEffects();
  } else {
    document.getElementById("tabs").innerHTML = "";
    app.innerHTML = renderHome();
  }
  window.scrollTo(0, 0);
}

/* ================= 比赛选择层 ================= */

function enterCompetition(id) {
  view = id === "ai" ? { screen: "ai", tab: "study" }
    : id === "chip" ? { screen: "chip", tab: "chipStudy" }
    : { screen: id };
  render();
}

function goHome() {
  view = { screen: "home" };
  render();
}

function renderHome() {
  return `<div class="card">
    <h2 class="sec">🏆 今天练哪个比赛？</h2>
    <div class="grid">
      <button class="tile" onclick="enterCompetition('chip')">
        <span class="emoji">⚡</span>
        <b>电子创芯赛</b>
        <div class="sub">电路创新设计 · 现场搭 4 个电路</div>
        <div class="sub"><span class="tag-review">建设中</span></div>
      </button>
      <button class="tile" onclick="enterCompetition('ai')">
        <span class="emoji">🤖</span>
        <b>AI 实物编程</b>
        <div class="sub">三套题库 174 题 · 学习 / 练习 / 模拟考</div>
      </button>
    </div>
  </div>`;
}

/* ================= 电子创芯赛模块 ================= */

const CHIP_TABS = [
  { id: "chipStudy", label: "📖 学习" },
  { id: "chipPractice", label: "✏️ 练习" },
  { id: "chipExam", label: "🏆 模拟考" },
  { id: "chipWrong", label: "⏰ 超时本" },
  { id: "chipStats", label: "📊 统计" },
];

const CHIP_STORE_KEY = "swcode_chip_v1";

function freshChipStore() {
  return { v: 1, attempts: {}, wrongBook: [], mic_enabled: false, exam_history: [] };
}

function loadChipStore() {
  try {
    const raw = localStorage.getItem(CHIP_STORE_KEY);
    if (!raw) return freshChipStore();
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object" || typeof s.attempts !== "object" || !Array.isArray(s.wrongBook)) {
      return freshChipStore();
    }
    return { ...freshChipStore(), ...s };
  } catch { return freshChipStore(); }
}

function saveChip() { localStorage.setItem(CHIP_STORE_KEY, JSON.stringify(chipStore)); }

/* ---- 纯逻辑（可测试） ---- */

function chipLimitMs() { return ((CHIP_DATA && CHIP_DATA.time_limit_sec) || 180) * 1000; }

function chipTimerStart(qid, now) {
  return { qid, phase: "timing", startAt: now, elapsedMs: 0 };
}

function chipTimerStop(st, now) {
  const ms = Math.max(0, now - st.startAt);
  return { qid: st.qid, ms, overtime: ms > chipLimitMs() };
}

/** 语音触发词匹配：忽略空格与常见标点后做子串命中 */
function matchPhrase(transcript, phrases) {
  const norm = (s) => String(s).replace(/[\s，。！？!?.,、]/g, "");
  const t = norm(transcript);
  return phrases.some((p) => t.includes(norm(p)));
}

function sampleCircuitExam(qs, n) { return shuffle(qs).slice(0, n); }

/** 记录一次练习：超时进超时本；连续 2 次达标毕业 */
function recordChipAttempt(s, qid, ms) {
  const overtime = ms > chipLimitMs();
  const a = s.attempts[qid] || (s.attempts[qid] = { best_ms: null, count: 0, streak: 0 });
  a.count += 1;
  if (a.best_ms === null || ms < a.best_ms) a.best_ms = ms;
  let graduated = false;
  if (overtime) {
    a.streak = 0;
    if (!s.wrongBook.includes(qid)) s.wrongBook.push(qid);
  } else {
    a.streak += 1;
    if (a.streak >= 2 && s.wrongBook.includes(qid)) {
      s.wrongBook = s.wrongBook.filter((x) => x !== qid);
      graduated = true;
    }
  }
  return { overtime, graduated };
}

/* ---- 语音控制（Web Speech API，按钮永远可用） ---- */

const VOICE_START = ["现在开始", "开始计时", "开始"];
const VOICE_STOP = ["我做完了", "做完了", "完成", "结束"];
let chipVoice = { rec: null, on: false, mode: "start", lastFire: 0, fails: 0 };

function voiceSupported() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function voiceToggle() {
  if (!voiceSupported()) { alert("这个浏览器不支持语音识别，用按钮也很好用哦 🙂"); return; }
  chipStore.mic_enabled = !chipStore.mic_enabled;
  saveChip();
  if (!chipStore.mic_enabled) voiceHalt();
  render();
}

function voiceHalt() {
  chipVoice.on = false;
  if (chipVoice.rec) {
    try { chipVoice.rec.onend = null; chipVoice.rec.stop(); } catch { /* 已停止 */ }
  }
  chipVoice.rec = null;
}

function voiceArm() {
  const ses = view.chipSes;
  const want = chipStore.mic_enabled && voiceSupported() && view.screen === "chip" && ses && !ses.finished;
  if (!want) { if (chipVoice.on) voiceHalt(); return; }
  chipVoice.mode = ses.timer ? "stop" : "start";
  if (chipVoice.on) return;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Ctor();
  rec.lang = "zh-CN"; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (e) => {
    const phrases = chipVoice.mode === "stop" ? VOICE_STOP : VOICE_START;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (matchPhrase(e.results[i][0].transcript, phrases)) {
        if (Date.now() - chipVoice.lastFire > 1500) { // 一句话只触发一次
          chipVoice.lastFire = Date.now();
          chipVoice.mode === "stop" ? chipFinishTimer() : chipStartTimer();
        }
        return;
      }
    }
  };
  rec.onend = () => { // 浏览器静音会自动停，重启续听
    chipVoice.on = false;
    if (chipStore.mic_enabled && view.chipSes && !view.chipSes.finished) setTimeout(voiceArm, 300);
  };
  rec.onerror = () => { if (++chipVoice.fails >= 5) { voiceHalt(); chipStore.mic_enabled = false; saveChip(); render(); } };
  try { rec.start(); chipVoice.on = true; chipVoice.fails = 0; } catch { /* 端口占用等 */ }
}

/* ---- 计时运行时 ---- */

let chipClockId = null;

function chipClockRun() {
  clearInterval(chipClockId);
  chipClockId = setInterval(() => {
    const el = document.getElementById("chipClock");
    const ses = view.chipSes;
    if (!el || !ses || !ses.timer) { clearInterval(chipClockId); return; }
    const ms = Date.now() - ses.timer.startAt;
    el.textContent = fmtChipMs(ms);
    el.classList.toggle("over", ms > chipLimitMs());
  }, 200);
}

/** 每次 chip 渲染后调用：挂语音、挂时钟 */
function chipRenderSideEffects() {
  if (view.chipSes && view.chipSes.timer) chipClockRun();
  else clearInterval(chipClockId);
  voiceArm();
}

function chipStartTimer() {
  const ses = view.chipSes;
  if (!ses || ses.timer || ses.finished) return;
  ses.timer = chipTimerStart(ses.qs[ses.i].id, Date.now());
  ses.lastDone = null;
  render();
}

function chipFinishTimer() {
  const ses = view.chipSes;
  if (!ses || !ses.timer) return;
  const q = ses.qs[ses.i];
  const r = chipTimerStop(ses.timer, Date.now());
  const rec = recordChipAttempt(chipStore, q.id, r.ms);
  saveChip();
  ses.times[ses.i] = r.ms;
  ses.timer = null;
  ses.lastDone = { ms: r.ms, overtime: r.overtime, graduated: rec.graduated };
  render();
}

function chipAbandonTimer() {
  const ses = view.chipSes;
  if (!ses || !ses.timer) return;
  ses.timer = null;
  render();
}

function chipNext() {
  const ses = view.chipSes;
  if (!ses) return;
  if (ses.i + 1 >= ses.qs.length) {
    if (ses.mode === "exam") {
      chipStore.exam_history.push({
        d: new Date().toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
        qids: ses.qs.map((q) => q.id),
        times_ms: ses.times.map((t) => t ?? null),
      });
      if (chipStore.exam_history.length > 20) chipStore.exam_history = chipStore.exam_history.slice(-20);
      saveChip();
    }
    ses.finished = true;
    voiceHalt();
  } else {
    ses.i += 1;
    ses.lastDone = null;
  }
  render();
}

function chipExitSession() { voiceHalt(); view = { screen: "chip", tab: "chipPractice" }; render(); }

function startChipSession(questions, mode) {
  view = {
    screen: "chip", tab: mode === "exam" ? "chipExam" : "chipPractice",
    chipSes: { mode, qs: questions, i: 0, times: [], timer: null, lastDone: null, finished: false },
  };
  render();
}

/* ---- 渲染 ---- */

function renderChipLoading() {
  return `<div class="card empty"><span class="big">⏳</span>电路题库加载中…<br>
    <span style="font-size:15px">若一直加载失败，请检查 circuits.json 与 assets/circuits/ 是否部署</span></div>`;
}

function chipCat(id) { return CHIP_DATA.categories.find((c) => c.id === id) || { name: id, emoji: "❓" }; }

function chipQ(qid) { return CHIP_DATA.questions.find((q) => q.id === qid); }

function fmtChipMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function chipImage(q, big) {
  if (q.image) {
    return `<img src="${q.image}" alt="第${q.no}题电路图" loading="lazy"
      style="width:100%;max-width:${big ? 460 : 380}px;border-radius:12px;border:1.5px solid var(--line);background:#fff">`;
  }
  return `<div class="empty" style="padding:18px 8px;font-size:16px"><span class="big">📐</span>本题无独立电路图（按题意在前一题电路上改装）</div>`;
}

function chipMicBtn() {
  if (!voiceSupported()) return "";
  const on = chipStore.mic_enabled;
  return `<button class="btn small ${on ? "" : "ghost"}" onclick="voiceToggle()">
    🎤 ${on ? "语音已开（说「现在开始 / 我做完了」）" : "语音未开"}
  </button>`;
}

function chipSessionCard() {
  const ses = view.chipSes;
  const q = ses.qs[ses.i];
  const limitS = chipLimitMs() / 1000;
  const head = ses.mode === "exam"
    ? `🏆 模拟考 · 第 ${ses.i + 1} / ${ses.qs.length} 题`
    : `✏️ 练习 · 第 ${ses.i + 1} / ${ses.qs.length} 题（${esc(chipCat(q.category).name)}）`;
  let body;
  if (ses.timer) {
    body = `
      <div class="score-hero" style="padding:10px 0">
        <div class="num" id="chipClock">0:00</div>
        <div style="font-size:15px;color:var(--ink-soft)">目标 ${limitS / 60} 分钟内完成，超时数字会变红</div>
      </div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn warn" onclick="chipFinishTimer()">✅ 我做完了</button>
        <button class="btn ghost" onclick="chipAbandonTimer()">放弃（不计时间）</button>
      </div>`;
  } else if (ses.lastDone) {
    const d = ses.lastDone;
    body = `
      <div class="feedback ${d.overtime ? "no" : "ok"}" style="text-align:center">
        ${d.overtime ? `⏰ 用时 ${fmtChipMs(d.ms)}，超过 ${limitS / 60} 分钟，已进超时本` : `🎉 ${fmtChipMs(d.ms)} 完成！`}
        ${d.graduated ? "<br>连续 2 次达标，这道题从超时本毕业啦 🎓" : ""}
      </div>
      <div style="font-size:15px;color:var(--ink-soft);text-align:center;margin-top:8px">
        对照题目检查一下效果对不对，不对就再拼一次
      </div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn" onclick="chipNext()">${ses.i + 1 >= ses.qs.length ? "看结果 📋" : "下一题 ➡️"}</button>
      </div>`;
  } else {
    body = `
      <div class="score-hero" style="padding:10px 0">
        <div style="font-size:19px;color:var(--ink-soft)">看懂电路图，准备好元件后开始计时</div>
      </div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn warn" onclick="chipStartTimer()">▶️ 开始计时</button>
      </div>`;
  }
  return `<div class="card">
    <h2 class="sec">${head} ${chipMicBtn()}</h2>
    <div class="progress"><i style="width:${(ses.i / ses.qs.length) * 100}%"></i></div>
    <div class="q-meta">第 ${q.no} 题 · ${esc(chipCat(q.category).name)}</div>
    <div class="q-text" style="font-size:19px">${esc(q.text)}</div>
    <div style="margin:14px 0;text-align:center">${chipImage(q, true)}</div>
    ${body}
    <button class="back" onclick="chipExitSession()">⬅️ 退出${ses.mode === "exam" ? "考试" : "练习"}</button>
  </div>`;
}

function chipExamSummary() {
  const ses = view.chipSes;
  const done = ses.times.filter((t) => t != null);
  const over = ses.times.filter((t) => t != null && t > chipLimitMs()).length;
  const total = done.reduce((s, t) => s + t, 0);
  return `<div class="card">
    <h2 class="sec">📋 模拟考成绩单 <small>按真实规则：完成数 + 用时</small></h2>
    <div class="score-hero">
      <span class="confetti">${over === 0 ? "🎉🎓🎊" : "💪"}</span>
      <div class="num ${over === 0 ? "" : "fail"}">${ses.qs.length - over}<span style="font-size:24px"> / ${ses.qs.length} 题</span></div>
      <div class="verdict">总用时 ${fmtChipMs(total)} · 超时 ${over} 题${over ? "（已进超时本）" : ""}</div>
    </div>
    ${ses.qs.map((q, i) => {
      const t = ses.times[i];
      const row = t == null ? "未完成" : `${fmtChipMs(t)}${t > chipLimitMs() ? " ⏰" : ""}`;
      return `<div class="study-q"><div class="q-head"><span class="no">${q.no}</span>
        <div>${esc(chipCat(q.category).name)} · <b style="color:${t != null && t <= chipLimitMs() ? "var(--green-deep)" : "var(--red)"}">${row}</b></div>
      </div></div>`;
    }).join("")}
    <div class="btn-row">
      <button class="btn" onclick="startChipExamAgain()">🔁 再来一场</button>
      <button class="btn ghost" onclick="chipExitSession()">返回</button>
    </div>
  </div>`;
}

function startChipExamAgain() {
  startChipSession(sampleCircuitExam(CHIP_DATA.questions, 4), "exam");
}

function renderChipExam() {
  const ses = view.chipSes;
  if (ses && ses.mode === "exam") return ses.finished ? chipExamSummary() : chipSessionCard();
  return `<div class="card">
    <h2 class="sec">🏆 模拟考 <small>完全按真实赛制</small></h2>
    <div style="font-size:18px;line-height:2">
      <div>📝 从 60 题随机抽 <b>4 题</b>，逐题计时</div>
      <div>⏱ 每题目标 <b>3 分钟</b>，超时会进超时本</div>
      <div>🏆 真实排名规则：<b>完成数 + 总用时</b></div>
      <div>✅ 拼完自己对照题目检查效果，点「我做完了」结束计时</div>
    </div>
    <div class="btn-row"><button class="btn warn" onclick="startChipExamAgain()">🚀 开始考试</button></div>
  </div>`;
}

function renderChipStudy() {
  if (view.chipCat) {
    const qs = CHIP_DATA.questions.filter((q) => q.category === view.chipCat);
    const cat = chipCat(view.chipCat);
    return `<div class="card">
      <h2 class="sec">${cat.emoji} ${esc(cat.name)} <small>${qs.length} 题</small></h2>
      ${qs.map((q) => `
        <div class="study-q">
          <div class="q-head"><span class="no">${q.no}</span>
            <div class="q-text" style="font-size:17px">${esc(q.text)}</div>
          </div>
          <div style="margin:10px 0 4px 34px;text-align:left">${chipImage(q)}</div>
        </div>`).join("")}
      <button class="back" onclick="back({tab:'chipStudy'})">⬅️ 返回考点列表</button>
    </div>`;
  }
  return `<div class="card">
    <h2 class="sec">📖 电路考点 <small>先看懂图，再记套路</small></h2>
    <div class="grid">
      ${CHIP_DATA.categories.map((c) => {
        const qs = CHIP_DATA.questions.filter((q) => q.category === c.id);
        const tried = qs.filter((q) => chipStore.attempts[q.id]).length;
        return `<button class="tile" onclick="view.chipCat='${c.id}';render()">
          <span class="emoji">${c.emoji}</span><b>${esc(c.name)}</b>
          <div class="sub">${qs.length} 题 · 已练 ${tried} 题</div>
        </button>`;
      }).join("")}
    </div>
  </div>`;
}

function renderChipPractice() {
  const ses = view.chipSes;
  if (ses && ses.mode === "practice") {
    if (ses.finished) {
      const done = ses.times.filter((t) => t != null);
      const over = ses.times.filter((t) => t != null && t > chipLimitMs()).length;
      return `<div class="card">
        <h2 class="sec">✏️ 本轮练习完成</h2>
        <div class="score-hero"><div class="num">${done.length}<span style="font-size:24px"> / ${ses.qs.length} 题</span></div>
          <div class="verdict">超时 ${over} 题${over ? "，去超时本再战 💪" : "，全部达标 🎉"}</div></div>
        <div class="btn-row" style="justify-content:center">
          <button class="btn" onclick="chipExitSession()">返回</button>
        </div>
      </div>`;
    }
    return chipSessionCard();
  }
  return `<div class="card">
    <h2 class="sec">✏️ 练习 <small>选一个考点开练</small></h2>
    <div class="grid">
      ${CHIP_DATA.categories.map((c) => {
        const qs = CHIP_DATA.questions.filter((q) => q.category === c.id);
        const wrong = qs.filter((q) => chipStore.wrongBook.includes(q.id)).length;
        return `<button class="tile" onclick="startChipSession(shuffle(CHIP_QS('${c.id}')),'practice')">
          <span class="emoji">${c.emoji}</span><b>${esc(c.name)}</b>
          <div class="sub">${qs.length} 题${wrong ? ` · ⏰${wrong} 题超时中` : ""}</div>
        </button>`;
      }).join("")}
    </div>
    <div style="font-size:15px;color:var(--ink-soft);margin-top:12px">
      每题 3 分钟内拼完并演示；超时自动进超时本，可反复练到达标毕业
    </div>
  </div>`;
}

/** 全局 helper：onclick 内联字符串里拿考点题目（避免模板串里拼数组） */
function CHIP_QS(catId) { return CHIP_DATA.questions.filter((q) => q.category === catId); }

function renderChipWrong() {
  const qs = chipStore.wrongBook.map(chipQ).filter(Boolean);
  if (!qs.length) {
    return `<div class="card empty"><span class="big">🎉</span>超时本是空的！<br>
      <span style="font-size:16px">练习和模拟考里超时的题会自动收进来，连对 2 次就能毕业</span></div>`;
  }
  return `<div class="card">
    <h2 class="sec">⏰ 超时本 <small>${qs.length} 题待征服</small></h2>
    ${qs.map((q) => {
      const a = chipStore.attempts[q.id];
      return `<div class="study-q"><div class="q-head"><span class="no">${q.no}</span>
        <div>${esc(chipCat(q.category).name)} · ${a && a.best_ms != null ? `最快 ${fmtChipMs(a.best_ms)}` : "还没完成过"}
          <span class="mini-badge">连击 ${a ? a.streak : 0}/2</span></div>
      </div>
      <div style="margin:6px 0 4px 34px;font-size:16px;color:var(--ink-soft)">${esc(q.text.slice(0, 50))}…</div></div>`;
    }).join("")}
    <div class="btn-row"><button class="btn warn" onclick="startChipSession(shuffle(CHIP_QS_W()),'practice')">💪 开练这 ${qs.length} 题</button></div>
  </div>`;
}

function CHIP_QS_W() { return chipStore.wrongBook.map(chipQ).filter(Boolean); }

function renderChipStats() {
  const rows = CHIP_DATA.categories.map((c) => {
    const qs = CHIP_DATA.questions.filter((q) => q.category === c.id);
    const tried = qs.filter((q) => chipStore.attempts[q.id]);
    const bests = tried.map((q) => chipStore.attempts[q.id].best_ms).filter((t) => t != null);
    const avg = bests.length ? bests.reduce((s, t) => s + t, 0) / bests.length : null;
    const wrong = qs.filter((q) => chipStore.wrongBook.includes(q.id)).length;
    return `<div class="stat-row">
      <span class="name">${c.emoji} ${esc(c.name)}</span>
      <span class="bar"><i style="width:${(tried.length / qs.length) * 100}%"></i></span>
      <span class="val">${tried.length}/${qs.length} 题 · ${avg ? `平均最快 ${fmtChipMs(avg)}` : "未练"}${wrong ? ` · ⏰${wrong}` : ""}</span>
    </div>`;
  }).join("");
  const hist = chipStore.exam_history.slice(-5).reverse().map((h) => {
    const done = h.times_ms.filter((t) => t != null);
    const over = h.times_ms.filter((t) => t != null && t > chipLimitMs()).length;
    const total = done.reduce((s, t) => s + t, 0);
    const pct = Math.round(((h.qids.length - over) / h.qids.length) * 100);
    const color = over === 0 ? "var(--green)" : "var(--orange)";
    return `<div class="exam-hist"><span class="d">${h.d}</span>
      <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
      <b style="color:${color}">${h.qids.length - over}/${h.qids.length} 达标</b>
      <span>${fmtChipMs(total)}</span></div>`;
  }).join("");
  return `<div class="card">
    <h2 class="sec">📊 各考点进度</h2>${rows}
    ${hist ? `<h2 class="sec" style="margin-top:20px">🏆 最近模拟考</h2>${hist}` : ""}
  </div>`;
}

function go(tab) { view = { screen: view.screen, tab }; render(); }
function back(restore) { view = { screen: view.screen, ...restore }; render(); }

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
        <div>📝 三套题库固定配额抽 <b>${EXAM_SIZE} 题</b>（${DATA.banks.map((b) => `${BANK_EMOJI[b.name] || ""}${b.name} ${EXAM_QUOTA[b.name] ?? 0}`).join(" · ")}），满分 100</div>
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

/** 分层抽题：每库各抽配额数；某库可用题不足时从全局剩余题补齐，整体洗牌出卷 */
function sampleExamQuestions(banks, quota) {
  const unknown = Object.keys(quota).filter((k) => !banks.some((b) => b.name === k));
  const missing = banks.filter((b) => quota[b.name] === undefined).map((b) => b.name);
  if (unknown.length || missing.length) {
    console.warn(`[模拟考] 配额键与题库名不匹配：多余 ${JSON.stringify(unknown)}，缺少 ${JSON.stringify(missing)}`);
  }
  const picked = [];
  const rest = [];
  for (const b of banks) {
    const pool = shuffle(answerable(b.questions));
    const n = quota[b.name] ?? 0;
    picked.push(...pool.slice(0, n));
    rest.push(...pool.slice(n));
  }
  return shuffle([...picked, ...shuffle(rest).slice(0, EXAM_SIZE - picked.length)]);
}

function startExam() {
  const qs = sampleExamQuestions(DATA.banks, EXAM_QUOTA);
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
  let correctCount = 0;
  exam.qs.forEach((q, i) => {
    const a = exam.answers[i];
    if (a === null) return; // 未作答不计入统计，也不给分
    const correct = LETTERS[a] === q.answer;
    if (correct) correctCount += 1;
    recordAnswer(q.id, correct);
  });
  const score = Math.round((correctCount * 100) / exam.qs.length); // 满分恒为 100，与配额总题数解耦
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
    const [res, chipRes] = await Promise.all([
      fetch("questions.json"),
      fetch("circuits.json").catch(() => null), // 电子创芯赛数据缺失不影响 AI 应用
    ]);
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
    if (chipRes && chipRes.ok) CHIP_DATA = await chipRes.json();
    store = loadStore();
    chipStore = loadChipStore();
    render();
  } catch {
    document.getElementById("app").innerHTML =
      `<div class="card empty"><span class="big">😵</span>题库加载失败<br>
      <span style="font-size:15px">请用本地服务器打开（如在项目目录运行 <b>python3 -m http.server</b> 后访问 http://localhost:8000），不要直接双击文件</span></div>`;
  }
}

boot();
