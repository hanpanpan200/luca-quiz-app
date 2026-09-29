# Luca 的比赛训练营

孩子的竞赛训练单页应用：**AI 实物编程**（题库闯关）+ **电子创芯赛**（电路拼装计时训练）。

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
  domain/       纯逻辑：分层抽样 / 计时状态机 / 语音匹配 / 错题本规则
  storage.ts    localStorage 读写（键：swcode_quiz_v1 / swcode_chip_v1）
  hooks/        useVoiceControl（Web Speech API 声控计时）
  components/   TabBar 等通用件
  screens/      HomeScreen + ai/*（5 屏）+ chip/*（5 屏）
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

## 数据更新（老师发新题库时）

```bash
python tools/extract.py            # AI 题库：raw/*.html → src/data/questions.json
python tools/extract_circuits.py   # 电路题库：PDF → public/assets/circuits/ + src/data/circuits.json
```

历史学习记录存在浏览器 localStorage（按域名隔离），换域名前记得在「统计」页导出备份。
