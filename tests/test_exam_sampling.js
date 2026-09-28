/* 模拟考分层抽样测试：node tests/test_exam_sampling.js（无 npm 依赖）
 * stub 掉浏览器全局对象后加载 app.js，验证按题库配额抽题的逻辑。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// —— 浏览器环境 stub（只覆盖顶层执行路径：boot() 的 fetch 失败分支）——
globalThis.document = { getElementById: () => ({}) };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.fetch = () => Promise.reject(new Error("node 环境无 fetch"));

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
vm.runInThisContext(
  src + "\n;globalThis.__app = { EXAM_QUOTA, EXAM_SIZE, sampleExamQuestions };",
  { filename: "app.js" },
);
const { EXAM_QUOTA, EXAM_SIZE, sampleExamQuestions } = globalThis.__app;

// —— 测试数据 ——
const REAL_SIZES = { 基础版: 93, 进阶版: 36, 高阶版: 45 };

/** 按给定规模构造假题库；reviewFirst=每库前 N 题标记 needs_review */
function fakeBanks(sizes, reviewFirst = 0) {
  return Object.entries(sizes).map(([name, n]) => ({
    name,
    questions: Array.from({ length: n }, (_, i) => ({
      id: `${name}-${i}`, text: `${name}第${i}题`, needs_review: i < reviewFirst,
    })),
  }));
}

function countByBank(qs) {
  const m = {};
  for (const q of qs) {
    const bank = q.id.split("-")[0];
    m[bank] = (m[bank] || 0) + 1;
  }
  return m;
}

let failed = 0;
function t(name, fn) {
  try { fn(); console.log(`✅ ${name}`); }
  catch (e) { failed++; console.error(`❌ ${name}\n   ${e.message}`); }
}
function eq(actual, expected, msg) {
  const norm = (v) => (v && typeof v === "object" && !Array.isArray(v))
    ? Object.keys(v).sort().map((k) => [k, v[k]]) // 对象按键排序，忽略插入顺序
    : v;
  const a = JSON.stringify(norm(actual)), b = JSON.stringify(norm(expected));
  if (a !== b) throw new Error(`${msg}：期望 ${b}，实际 ${a}`);
}

t("配额总和 = EXAM_SIZE", () => {
  eq(Object.values(EXAM_QUOTA).reduce((s, n) => s + n, 0), EXAM_SIZE, "配额总和");
});

t("三库各按配额精确抽取（重复200次）", () => {
  for (let k = 0; k < 200; k++) {
    eq(countByBank(sampleExamQuestions(fakeBanks(REAL_SIZES), EXAM_QUOTA)), EXAM_QUOTA, "各库数量");
  }
});

t("抽题顺序随机（两次序列不同）", () => {
  const ids = () => sampleExamQuestions(fakeBanks(REAL_SIZES), EXAM_QUOTA).map((q) => q.id).join(",");
  if (ids() === ids()) throw new Error("两次抽样序列完全相同，怀疑未洗牌");
});

t("needs_review 的题不进试卷", () => {
  const qs = sampleExamQuestions(fakeBanks(REAL_SIZES, /*reviewFirst=*/5), EXAM_QUOTA);
  if (qs.some((q) => q.needs_review)) throw new Error("抽到了 needs_review 的题");
});

t("某库可用题不足配额时从其余题补齐总数", () => {
  const qs = sampleExamQuestions(fakeBanks({ 基础版: 93, 进阶版: 2, 高阶版: 45 }), EXAM_QUOTA);
  eq(qs.length, EXAM_SIZE, "总题数");
  eq(qs.filter((q) => q.id.startsWith("进阶版")).length, 2, "进阶版最多只有2题");
});

t("配额键与题库名不匹配时 console.warn 告警", () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (m) => warns.push(String(m));
  try {
    sampleExamQuestions(fakeBanks(REAL_SIZES), { 基础版: 10, 进阶版: 6, 不存在的库: 4 });
  } finally { console.warn = orig; }
  if (!warns.some((w) => w.includes("高阶版"))) throw new Error(`未对缺失的题库告警，实际告警：${warns}`);
});

console.log(failed ? `\n${failed} 个测试失败` : "\n全部通过");
process.exit(failed ? 1 : 0);
