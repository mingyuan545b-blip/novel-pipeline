# docs/archive — 归档层（L4，禁止冷启动读取）

> **何时读**：只在需要追溯历史（某旧会话细节、旧决策、已废方案）时，按 `docs/SESSION-STATE.md` §二 会话索引的指引定向打开。
> **不要**：冷启动整目录读取；这些是冻结的历史快照，其中出现的旧 provider/agent/表数量都是"当时的事实"，不是当前状态。

## 内容

| 文件 | 说明 |
|------|------|
| `session-conclusions-archive.md` | 2026-08-27→10-11 逐会话结论全文（2026-10-11 从 SESSION-STATE §一 迁出，冻结） |
| `worklog/*.md` | 已完成且过时的任务工作日志（LM Studio 接入 / token-plan 接入 / 早期上下文修复） |
| `governance-v2-archive.md` | 项目治理手册 v2.0（已拆分为现在 sop/reference） |
| `startup-protocol-legacy.md` | 旧 session 启动协议（已合并进 `docs/sop/01-接手启动.md`） |
| `refactoring-protocol-legacy.md` | 旧重构协议（已精简进 `docs/sop/02-重构任务.md`） |
| `翻新清单.md` | PG 数据库统一改造清单（已完成） |

> `verifyDocFreshness.js` 等一致性脚本**跳过 archive 目录**，故归档内容不参与"文档与代码事实一致"校验。
