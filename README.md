# Luca 的比赛训练营

孩子的竞赛训练单页应用：**AI 实物编程**（题库闯关）+ **电子创芯赛**（电路拼装计时训练）+ **校内复习**（科学单元选择题）。

## 技术栈

Vite + React 19 + TypeScript + react-router（HashRouter）+ Vitest + @testing-library/react

## 开发

```bash
npm install
npm run dev        # 本地开发
npm test           # 单元测试（18 个：领域逻辑 + 组件交互流）
npm run typecheck  # 类型检查
npm run build      # 产出 dist/
```

## 目录结构

```
src/
  data/         题库 JSON（构建期 import；由 tools/extract*.py 生成）
  data/science/ 校内科学·一个单元一个 JSON（g3a-u2.json = 三上第二单元《水》）
  domain/       纯逻辑：分层抽样 / 计时状态机 / 语音匹配 / 错题本规则
  storage.ts    localStorage 读写（键：swcode_quiz_v1 / swcode_chip_v1 / swcode_science_<unitId>_v1）
  hooks/        useVoiceControl（Web Speech API 声控计时）
  components/   TabBar 等通用件
  screens/      HomeScreen + ai/*（5 屏）+ chip/*（5 屏）+ science/*（单元列表 + 3 屏）
public/assets/circuits/   60 题电路图（tools/extract_circuits.py 从 PDF 提取）
raw/            题库 HTML 源数据（提取流水线输入）
```

## 部署

纯静态产物，所有平台都从 `main` 分支自动部署：

| 平台 | 构建命令 | 输出目录 |
|---|---|---|
| Vercel | 自动识别 Vite（零配置） | 自动 |
| Cloudflare Pages | `npm run build` | `dist` |
| EdgeOne Pages | `npm run build` | `dist` |

## 本地通过CLI部署到EdgeOne Pages

```bash
npm install -g edgeone
edgeone login          # 浏览器扫码登录
edgeone pages deploy ./dist --name luca-quiz-app
```
然后访问：https://luca-quiz-app-dpjrbhmd1t72.edgeone.cool

## 数据更新（老师发新题库时）

```bash
python tools/extract.py            # AI 题库：raw/*.html → src/data/questions.json
python tools/extract_circuits.py   # 电路题库：PDF → public/assets/circuits/ + src/data/circuits.json
```

**科学新单元**（老师发新 PDF 时）：按 `src/data/science/g3a-u2.json` 的格式出题写一个新 JSON
（id 规则 `g{年级}{a上/b下}-u{单元号}`，题目带 `explanation` 解析），在 `src/data/science/index.ts`
注册一行即可——界面、进度、错题本、模拟考全部自动出现，各单元进度存独立的
`swcode_science_<unitId>_v1`，互不影响。

历史学习记录存在浏览器 localStorage（按域名隔离），换域名前记得在「统计」页导出备份。
