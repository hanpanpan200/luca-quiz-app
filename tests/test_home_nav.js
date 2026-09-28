/* 主页比赛选择层测试：node tests/test_home_nav.js（无 npm 依赖） */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// —— 浏览器环境 stub：fetch 返回真实题库，忠实还原 boot() 成功路径 ——
globalThis.document = { getElementById: () => ({ style: {}, innerHTML: "" }) };
globalThis.window = { scrollTo: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const realData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "questions.json"), "utf8"));
const realCircuits = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "circuits.json"), "utf8"));
globalThis.fetch = (url) => {
  const data = String(url).includes("circuits") ? realCircuits : realData;
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
};

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
vm.runInThisContext(
  src + "\n;globalThis.__app = { get view() { return view; }, enterCompetition, goHome, renderHome, renderChipStudy };",
  { filename: "app.js" },
);
const app = globalThis.__app;

const bootDone = new Promise((r) => setImmediate(r)); // 等 boot() 的异步链走完
let failed = 0;
async function t(name, fn) {
  try { await fn(); console.log(`✅ ${name}`); }
  catch (e) { failed++; console.error(`❌ ${name}\n   ${e.message}`); }
}

(async () => {
  await bootDone;

  await t("初始视图是比赛选择主页（screen=home）", () => {
    if (app.view.screen !== "home") throw new Error(`期望 screen=home，实际 ${JSON.stringify(app.view)}`);
  });

  await t("主页包含电子创芯赛和 AI 实物编程两个入口", () => {
    const html = app.renderHome();
    if (!html.includes("电子创芯赛")) throw new Error("缺少电子创芯赛入口");
    if (!html.includes("AI 实物编程")) throw new Error("缺少 AI 实物编程入口");
  });

  await t("选择 AI 实物编程后进入应用（screen=ai, tab=study）", () => {
    app.enterCompetition("ai");
    if (app.view.screen !== "ai" || app.view.tab !== "study") {
      throw new Error(`期望 {screen:ai, tab:study}，实际 ${JSON.stringify(app.view)}`);
    }
  });

  await t("应用内切换 tab 不丢失 screen", () => {
    app.enterCompetition("ai");
    vm.runInThisContext("go('exam')");
    if (app.view.screen !== "ai") throw new Error(`切 tab 后 screen 丢失：${JSON.stringify(app.view)}`);
    if (app.view.tab !== "exam") throw new Error(`tab 未切换：${JSON.stringify(app.view)}`);
  });

  await t("goHome 从应用返回选择主页", () => {
    app.enterCompetition("ai");
    app.goHome();
    if (app.view.screen !== "home") throw new Error(`期望 screen=home，实际 ${JSON.stringify(app.view)}`);
  });

  await t("电子创芯赛页进入学习tab，只含电路创新设计考点", () => {
    app.enterCompetition("chip");
    if (app.view.screen !== "chip") throw new Error(`期望 screen=chip，实际 ${JSON.stringify(app.view)}`);
    if (app.view.tab !== "chipStudy") throw new Error(`期望 tab=chipStudy，实际 ${JSON.stringify(app.view)}`);
    const html = app.renderChipStudy();
    if (!html.includes("考点")) throw new Error("缺少考点列表");
    for (const banned of ["程控电路设计", "未来遗迹探测"]) {
      if (html.includes(banned)) throw new Error(`不应出现子赛项「${banned}」`);
    }
  });

  console.log(failed ? `\n${failed} 个测试失败` : "\n全部通过");
  process.exit(failed ? 1 : 0);
})();
