# Novel-Pipeline · Trae 规则入口（薄指针，勿在此堆细节）

> 本文件只做**指针**。细节一律放权威文档，避免"双头维护 → 漂移"。
> 旧的完整交接文档已冻结到 `docs/archive/trae-project-rules-legacy.md`（内容过时，勿直接参考）。

## 接手 AI 必读顺序（按需，不要全读）
1. `docs/SESSION-STATE.md` — 当前状态 + 会话索引（2 分钟）。
2. `docs/INDEX.md` — 任务路由表 + "问题→文档反向索引"，按任务选 1 个 SOP。
3. `docs/sop/00-陷阱清单.md` — 任何任务开始前对照已知坑。
4. 长任务：`docs/sop/10-上下文交接规范.md`（状态落盘，防压缩失忆）。

## 唯一权威源（冲突时以这些 + 代码实测为准）
- 架构：`ARCHITECTURE.md` ｜ 规范：`PROJECT_STANDARDS.md` ｜ 数据库：`DATABASE_SCHEMA.md`
- Agent 协作：`AGENTS.md` / `CLAUDE.md`

## 当前事实速记（会变，以代码为准）
- 后端 Express + PostgreSQL（:3001）；前端 React + Vite（:5173）。
- LLM 默认 `aliyunCoding`（见 `server/services/providerDefs.js`）。
- 铁律唯一定义源：`scripts/lib/ironLawRules.js`；改规则前 `node scripts/audit-iron-law.js --self-check`。
- 提交走 pre-commit 五关门禁；被拦修根因，禁止绕过。

## 协作约定
- 删文件 / 改全局配置 / 破坏性 git 操作：**先确认**。回答用中文，命令优先 cmd。
