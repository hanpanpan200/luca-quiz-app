/* 电子创芯赛模块核心逻辑测试：node tests/test_chip_module.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// —— 浏览器环境 stub：fetch 按 URL 分发真实数据 ——
const realQuestions = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "questions.json"), "utf8"));
const realCircuits = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "circuits.json"), "utf8"));
globalThis.document = { getElementById: () => ({ style: {}, innerHTML: "" }) };
globalThis.window = { scrollTo: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.fetch = (url) => {
  const data = String(url).includes("circuits") ? realCircuits : realQuestions;
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
};

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
vm.runInThisContext(
  src + "\n;globalThis.__app = {" +
  "  chipTimerStart, chipTimerStop, matchPhrase, sampleCircuitExam, recordChipAttempt, freshChipStore" +
  "};",
  { filename: "app.js" },
);
const app = globalThis.__app;
const LIMIT = realCircuits.time_limit_sec * 1000; // 180_000

let failed = 0;
async function t(name, fn) {
  try { await fn(); console.log(`✅ ${name}`); }
  catch (e) { failed++; console.error(`❌ ${name}\n   ${e.message}`); }
}
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg}：期望 ${b}，实际 ${a}`);
}

const bootDone = new Promise((r) => setImmediate(r));

(async () => {
  await bootDone;

  await t("计时状态机：开始→计时中→完成记录用时", () => {
    const st = app.chipTimerStart("c01", 1000);
    eq(st.phase, "timing", "开始后状态");
    const done = app.chipTimerStop(st, 61000);
    eq(done, { qid: "c01", ms: 60000, overtime: false }, "完成记录");
  });

  await t("超时判定：超过 180 秒记为 overtime", () => {
    const st = app.chipTimerStart("c18", 0);
    const done = app.chipTimerStop(st, LIMIT + 1);
    eq(done.overtime, true, "180秒+1ms 应超时");
    eq(app.chipTimerStop(app.chipTimerStart("c19", 0), LIMIT).overtime, false, "恰好180秒不算超时");
  });

  await t("语音匹配：去除空格标点后子串命中", () => {
    const START = ["现在开始", "开始计时", "开始"];
    if (!app.matchPhrase("现在 开始 ！", START)) throw new Error("「现在 开始！」应命中");
    if (!app.matchPhrase("我说开始计时了", START)) throw new Error("句中包含短语应命中");
    if (app.matchPhrase("还没准备好呢", START)) throw new Error("无关语句不应命中");
    const STOP = ["我做完了", "做完了", "完成"];
    if (!app.matchPhrase("我做完了。", STOP)) throw new Error("「我做完了。」应命中");
  });

  await t("模拟考抽样：抽 4 题不重复", () => {
    for (let k = 0; k < 100; k++) {
      const qs = app.sampleCircuitExam(realCircuits.questions, 4);
      eq(qs.length, 4, "题数");
      if (new Set(qs.map((q) => q.id)).size !== 4) throw new Error("出现重复题");
    }
  });

  await t("超时本：超时进本；连续2次达标毕业", () => {
    const s = app.freshChipStore();
    const r1 = app.recordChipAttempt(s, "c22", LIMIT + 5000); // 超时
    eq({ in: s.wrongBook.includes("c22"), o: r1.overtime }, { in: true, o: true }, "超时应进超时本");
    app.recordChipAttempt(s, "c22", 100000); // 达标1次
    eq(s.wrongBook.includes("c22"), true, "1次达标不应毕业");
    const r3 = app.recordChipAttempt(s, "c22", 120000); // 连续第2次达标
    eq({ out: !s.wrongBook.includes("c22"), g: r3.graduated }, { out: true, g: true }, "连续2次应毕业");
  });

  await t("超时本：达标后再超时重置连击", () => {
    const s = app.freshChipStore();
    app.recordChipAttempt(s, "c23", LIMIT + 1);
    app.recordChipAttempt(s, "c23", 100000);
    app.recordChipAttempt(s, "c23", LIMIT + 1); // 打断连击
    app.recordChipAttempt(s, "c23", 100000);    // 重新累计1次
    eq(s.wrongBook.includes("c23"), true, "中断后1次达标不应毕业");
  });

  await t("全 tab 渲染 + 完整练习/考试会话流冒烟", async () => {
    // 5 个 tab 逐个渲染
    for (const tab of ["chipStudy", "chipPractice", "chipExam", "chipWrong", "chipStats"]) {
      vm.runInThisContext(`go('${tab}')`);
    }
    // 学习页：进入每个考点详情渲染（覆盖全部 57 张题卡模板）
    for (const c of realCircuits.categories) {
      vm.runInThisContext(`view.chipCat='${c.id}';render()`);
    }
    // 完整练习会话：开始→计时→完成（超时）→下一题→结束
    vm.runInThisContext("startChipSession(CHIP_DATA.questions.slice(0,2),'practice')");
    vm.runInThisContext("chipStartTimer()");
    vm.runInThisContext("chipFinishTimer()");
    vm.runInThisContext("chipNext()");
    vm.runInThisContext("chipStartTimer()");
    vm.runInThisContext("chipFinishTimer()");
    vm.runInThisContext("chipNext()"); // → finished 简报
    // 模拟考完整流：4 题
    vm.runInThisContext("startChipExamAgain()");
    for (let i = 0; i < 4; i++) {
      vm.runInThisContext("chipStartTimer()");
      vm.runInThisContext("chipFinishTimer()");
      vm.runInThisContext("chipNext()");
    }
    // 超时本（此时应有超时题）与统计页渲染
    vm.runInThisContext("go('chipWrong')");
    vm.runInThisContext("go('chipStats')");
  });

  console.log(failed ? `\n${failed} 个测试失败` : "\n全部通过");
  process.exit(failed ? 1 : 0);
})();
