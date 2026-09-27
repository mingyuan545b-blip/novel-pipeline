# 文档索引（主引导文件）

> novel-pipeline 小说生产线 | Node.js + React + PostgreSQL | 后端3001 / 前端5173
> **接手AI必读本文档**，根据任务类型选择对应SOP，禁止凭记忆操作。

---

## 根级权威文档（必知）

| 文档 | 用途 | 维护原则 |
|------|------|----------|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | 系统架构唯一权威参考（§十五 藏经阁：PG存储/注入链/一键提取） | 任何架构变更必须同步 |
| [PROJECT_STANDARDS.md](../PROJECT_STANDARDS.md) | 开发规范与交付标准（被CI引用） | 代码规范变更必须同步 |
| [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) | PostgreSQL 20张表Schema | 数据库变更必须同步 |
| [AGENTS.md](../AGENTS.md) | AI Agent协作规范 | Agent行为变更必须同步 |
| [CLAUDE.md](../CLAUDE.md) | Claude Code协作规范 | 协作流程变更必须同步 |

> ⚠️ 历史文档（SYSTEM_ARCHITECTURE/HANDOVER/SYSTEM_REFERENCE/PROJECT_SPEC/RENOVATION_CHECKLIST/REFACTORING_CHECKLIST/EXECUTION_CHECKLIST）已于 2026-06-27 删除，内容已合并到上述权威文档或 docs/ 子目录。

---

## 接手必读（每次session开始）

| 序号 | 文件 | 用途 | 何时读 |
|------|------|------|--------|
| 0 | [AI-HANDOVER-PRD.md](AI-HANDOVER-PRD.md) | 接手AI总需求书+工作宪法（工作规范/文档分级/模块化契约/多Agent协作/调试/验收） | 新AI首次接手读§0-§3；做治理/多agent/大任务时按§0路由表选章节 |
| 1 | [sop/00-陷阱清单.md](sop/00-陷阱清单.md) | 已知陷阱+7条核心原则 | **任何任务开始前必读** |
| 2 | [sop/01-接手启动.md](sop/01-接手启动.md) | session启动协议+环境自检 | 新session第一次操作前 |
| 3 | [sop/10-上下文交接规范.md](sop/10-上下文交接规范.md) | 防失忆协议：状态落盘+恢复锚点 | 长任务开始前/上下文压缩提示时 |

---

## 按任务类型选择SOP

| 任务类型 | SOP文件 | 触发条件 |
|---------|---------|---------|
| 重构代码 | [sop/02-重构任务.md](sop/02-重构任务.md) | 文件>200行/拆分/迁移/Legacy清理 |
| 新功能开发 | [sop/03-新功能开发.md](sop/03-新功能开发.md) | 新增模块/API/组件/服务 |
| 修复bug | [sop/04-bug修复.md](sop/04-bug修复.md) | 任何bug修复/异常排查（含6.6-6.8约束失效类） |
| 数据库变更 | [sop/05-数据库变更.md](sop/05-数据库变更.md) | 新增表/字段/索引/迁移 |
| 题材插件 | [sop/06-题材插件.md](sop/06-题材插件.md) | 新增/修改题材Plugin |
| Pipeline变更 | [sop/07-Pipeline变更.md](sop/07-Pipeline变更.md) | step/契约/数据流/Agent变更 |
| 约束系统变更 | [sop/08-约束执行规范.md](sop/08-约束执行规范.md) | 约束词/审核/override/hardBlock/元约束M1-M5 |
| 新项目约束词设计 | [sop/09-新项目约束词设计SOP.md](sop/09-新项目约束词设计SOP.md) | 新建项目/更换题材/新增约束词（4步闭环：题材选择→约束词配置→冲突预检→端到端验证） |
| 长任务/上下文将压缩 | [sop/10-上下文交接规范.md](sop/10-上下文交接规范.md) | **任何预计超长的任务开始前必读**；收到上下文压缩提示时立即执行落盘 |

---

## 参考文档（按需读取，不强制接手时全读）

| 文档 | 路径 | 何时读 |
|------|------|--------|
| 项目身份与硬约束 | [reference/项目身份与硬约束.md](reference/项目身份与硬约束.md) | 需要确认架构规范/约束时 |
| 文件地图 | [reference/文件地图.md](reference/文件地图.md) | 需要定位某层某文件时 |
| 题材插件完整规范 | [reference/题材插件规范.md](reference/题材插件规范.md) | 开发题材Plugin时（配合sop/06） |
| 题材配置系统 | [reference/题材配置系统.md](reference/题材配置系统.md) | 题材检测/配置问题时 |
| 统一加载机制 | [reference/统一加载机制.md](reference/统一加载机制.md) | 加载顺序/缓存问题时 |

---

## 🔍 问题→文档反向索引（遇到问题第一时间查这里）

### 约束/审核/质量问题

| 症状 | 根因文档 | 检测代码 |
|------|---------|---------|
| AI味严重（仿佛/似乎/一抹泛滥） | [08 §二 M1](sop/08-约束执行规范.md) + [00 #42](sop/00-陷阱清单.md) | `detectors/detectMetaphorSubstitution.js` |
| 冲突套路重复（被动打脸连续） | [08 §二 M2](sop/08-约束执行规范.md) + [00 #42](sop/00-陷阱清单.md) | `detectors/detectConflictPatternRepeat.js` |
| 章节衔接断裂（开头与上章结尾不连贯） | [08 §二 M3](sop/08-约束执行规范.md) + [04 §6.8](sop/04-bug修复.md) + [00 #41](sop/00-陷阱清单.md) | `detectors/detectChapterCoherence.js` |
| 抽象抒情泛滥（时间静止/命运齿轮） | [08 §二 M4](sop/08-约束执行规范.md) | `detectors/detectAbstractSentiment.js` |
| 配角工具人化（只说"是/好的"） | [08 §二 M5](sop/08-约束执行规范.md) | `detectors/detectToolCharacter.js` |
| 审核发现问题但被override放行 | [08 §四](sop/08-约束执行规范.md) + [04 §6.7](sop/04-bug修复.md) + [00 #43](sop/00-陷阱清单.md) | `pipeline/overrideGovernance.js` |
| 约束词只写不查（prompt有但无效） | [08 §六](sop/08-约束执行规范.md) + [04 §6.6](sop/04-bug修复.md) + [00 #42](sop/00-陷阱清单.md) | `prompts/constraintDetectionRegistry.js` |
| hardBlock覆盖面不足 | [08 §六](sop/08-约束执行规范.md) + [00 #44](sop/00-陷阱清单.md) | `chapterAuditor/hardBlockChecks.js` |

### Pipeline生成问题

| 症状 | 根因文档 | 检测代码 |
|------|---------|---------|
| 新项目无法生成第一章 | [00 #25/#38](sop/00-陷阱清单.md) | `prompts/agentPromptAssembler.js`（knowledge slot降级） |
| intent-planner崩溃 | [00 #37](sop/00-陷阱清单.md) | `services/intentPromptBuilder.js`（extractProhibitionRules） |
| API响应格式不一致 | [00 #23](sop/00-陷阱清单.md) | POST返回{success,data}，GET返回数组 |
| 章节字数不达标 | [MAINTENANCE §一](MAINTENANCE.md) | `chapterAuditor/hardBlockChecks.js`（字数硬门禁） |
| 限流/配额耗尽 | [00 限流类](sop/00-陷阱清单.md) | `services/errorRecovery.js` |
| 本地模型(LM Studio)输出为空/思考吃光tokens | [00 #94](sop/00-陷阱清单.md) + ARCHITECTURE环境配置节 | `llmRequestBuilder.js`(noThinkMarker) / `providerDefs.js`(requestTimeoutMs) |
| 本地模型请求超时被取消 | [00 #94](sop/00-陷阱清单.md) | `llm.js`超时链：调用方>供应商级>LLM_DEFAULTS |
| 想知道 token 花在哪/哪一章烧钱 | [03 Token去向面板](sop/03-新功能开发.md) | `services/pipeline/tokenLedgerView.js` / 页面 `/token-ledger` |
| 提示词/素材被预算截断（规则失效） | [00 #42](sop/00-陷阱清单.md) | `tokenLedgerAlerts.js`（截断告警）+ `contextAssemblyRecorder.js` |

### 数据/配置问题

| 症状 | 根因文档 | 检测代码 |
|------|---------|---------|
| 项目删除后数据残留 | [00 #32 孤儿数据](sop/00-陷阱清单.md) | `scripts/audit-cascade-delete.js` |
| PG降级静默失败 | [00 PG降级类](sop/00-陷阱清单.md) | `store.js`（_backendStatus） |
| 字段缺失/默认值不一致 | [reference/项目身份与硬约束.md](reference/项目身份与硬约束.md) | `schemaIntegrityCheck.js` |
| 配置不同步测试 | [MAINTENANCE §三.2](MAINTENANCE.md) | `scripts/audit-config-test-sync.js` |
| 提交长正文被静默截断（提取/导入类接口） | [00 #115](sop/00-陷阱清单.md) + [03 一键提取](sop/03-新功能开发.md) | `middleware/inputSanitizer.js`（LONG_TEXT_ROUTES） |
| 题材检测错误 | [reference/题材配置系统.md](reference/题材配置系统.md) | `services/genreDetectorHelpers.js` |
| 功能报"需要专业版会员"但账号有权限 | [00 #116](sop/00-陷阱清单.md) | `GET /api/license/status`（看 `error: Machine mismatch` / `machineIdSource`） |

### 前端/路由问题

| 症状 | 根因文档 | 检测代码 |
|------|---------|---------|
| 页面空白/路由404 | [00 #21 通配符路由](sop/00-陷阱清单.md) | `client/src/App.jsx`（`<Route path="*">`） |
| 前端不显示项目数据 | [00 #23 API格式](sop/00-陷阱清单.md) | API响应解构 |
| 组件超200行/useState超5个 | [PROJECT_STANDARDS.md](../PROJECT_STANDARDS.md) | `scripts/audit-hardcode.js` |

---

## 文档状态总览

| 文档 | 状态 | 最后核对 | 备注 |
|------|------|---------|------|
| INDEX.md（本文件） | 🟢活跃 | 2026-09-21 | 新增陷阱#115反向索引 + 藏经阁PG化 |
| ARCHITECTURE.md | 🟢活跃 | 2026-09-21 | **新增§十五 藏经阁（PG存储 + 一键提取）** |
| DATABASE_SCHEMA.md | 🟢活跃 | 2026-09-21 | **新增#31 library_techniques 表** |
| AI-HANDOVER-PRD.md | 🟢活跃 | 2026-09-06 | **新增** 接手AI总需求书（工作宪法+文档分级+多Agent协作+方法论采纳决策） |
| MAINTENANCE.md | 🟢活跃 | 2026-06-27 | 覆盖率基线阶段十二S5 |
| sop/00-陷阱清单.md | 🟢活跃 | 2026-06-28 | 累计#44，含约束词失效类#42-44 |
| sop/01-接手启动.md | 🟢活跃 | 2026-06-27 | session启动协议 |
| sop/02-重构任务.md | 🟢活跃 | 2026-06-27 | 重构流程 |
| sop/03-新功能开发.md | 🟢活跃 | 2026-06-27 | 配置统一管理章节 |
| sop/04-bug修复.md | 🟢活跃 | 2026-06-28 | 新增6.6-6.8约束失效类排查路径 |
| sop/05-数据库变更.md | 🟢活跃 | 2026-06-27 | 含陷阱#32/#33 |
| sop/06-题材插件.md | 🟢活跃 | 2026-06-27 | 素材类型表sub-plane术语 |
| sop/07-Pipeline变更.md | 🟢活跃 | 2026-06-27 | 架构概览与代码一致 |
| sop/08-约束执行规范.md | 🟢活跃 | 2026-06-28 | **新增** CES元约束体系M1-M5 |
| sop/09-新项目约束词设计SOP.md | 🟢活跃 | 2026-06-29 | **新增** 4步闭环约束词设计流程 |
| sop/10-上下文交接规范.md | 🟢活跃 | 2026-08-27 | **新增** 防失忆协议（三层记忆架构+恢复锚点） |
| reference/项目身份与硬约束.md | 🟢活跃 | 2026-06-27 | 级联删除53个 |
| reference/文件地图.md | 🟢活跃 | 2026-06-27 | 技术债务P0/P1 |
| reference/题材插件规范.md | 🟢活跃 | 2026-06-27 | 模式表3→1种长篇 |
| reference/题材配置系统.md | 🟢活跃 | 2026-06-27 | 题材检测/配置 |
| reference/统一加载机制.md | 🟢活跃 | 2026-06-27 | 加载顺序/缓存 |
| archive/governance-v2-archive.md | 📦归档 | 2026-06-27 | 原governance v2.0，已拆分 |
| archive/startup-protocol-legacy.md | 📦归档 | 2026-06-27 | 原startup-protocol，已合并到sop/01 |
| archive/refactoring-protocol-legacy.md | 📦归档 | 2026-06-27 | 原refactoring-protocol，已精简到sop/02 |
| archive/翻新清单.md | 📦归档 | 2026-06-28 | PG改造全部✅完成，历史记录保留 |

**状态标识**：
- 🟢活跃 = 当前有效，可直接参考
- 🟡待核对 = 需人工确认与代码一致性
- 📦归档 = 历史记录，不主动读取，仅供追溯
- ❌废弃 = 已失效，待删除

---

## 使用规则

1. **任何任务开始前必读 `sop/00-陷阱清单.md`**，对照检查是否踩到已知坑
2. 根据任务类型选1个sop文件读取，不要全读（节约上下文）
3. **遇到问题先查"问题→文档反向索引"**（本文件上方），精准定位
4. reference/目录按需读取，接手时不必全读
5. archive/目录不主动读取，仅历史追溯时查阅
6. 发现新陷阱或成功路径，必须追加到对应sop文件（保持文档鲜活）

---

## 变更维护（强制）

**每次代码/数据/功能变更后必读 [MAINTENANCE.md](MAINTENANCE.md)**，对照同步矩阵确认需更新哪些文档。

| 检查点 | 命令 | 时机 |
|--------|------|------|
| 任务完成前 | 4个audit脚本并行运行（见下） | 每次变更后必做 |
| 提交前 | `audit-doc-sync.js --last 1` + `audit-config-test-sync.js --last 1` | git commit前 |
| 接手session时 | `audit-doc-sync.js --last 5` + `audit-config-test-sync.js --last 5` | 新session开始 |

**4个audit脚本**：
- `node scripts/audit-doc-sync.js` — 文档同步检查
- `node scripts/audit-config-test-sync.js` — 配置变更→测试同步检查
- `node scripts/audit-cascade-delete.js --ci` — 级联删除注册检查（CI模式）
- `node scripts/audit-hardcode.js` — 硬编码+文件行数审计

**反模式**：改代码不更新文档 / 更新到错误位置 / audit输出"需更新"但忽略 / 改配置不同步测试 / 新增表忘记注册级联删除

---

## 文档体系维护原则

1. **单一数据源**：每个知识点只在一个文档定义，其他文档引用
2. **反向索引优先**：新增文档必须在反向索引中添加"问题→文档"映射
3. **状态即时更新**：文档状态变更（活跃→归档）必须同步本文件
4. **归档不删除**：历史文档移到archive/，保留追溯能力
5. **重复即合并**：发现两文档内容>30%重叠，必须合并或明确分工
