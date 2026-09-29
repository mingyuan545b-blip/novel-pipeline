# Novel-Pipeline 系统架构文档

> **本文档是系统架构的唯一权威参考**。
> 最后更新：2026-06-27

---

## 一、系统概述

Novel-Pipeline 是一个AI驱动的长篇小说自动化创作系统，目标支持三五百万字长篇，适配各种题材类型。每个新项目只需题材约束和素材标准，其他功能模块自动适配。

**技术栈**：
- 前端：React 19 + Vite + Zustand
- 后端：Express 5 + PostgreSQL（better-sqlite3兼容层）
- AI：多供应商LLM统一调用（llm.js）

### 环境配置（.env文件）

**⚠️ 重要：.env文件位置必须牢记，每次部署/调试都需要确认**

| 文件 | 位置 | 说明 |
|------|------|------|
| 后端.env | `项目根目录/.env` | 包含LLM API密钥、REQUEST_SECRET、PORT等 |
| 前端.env | `client/.env` | 包含VITE_REQUEST_SECRET（需与后端REQUEST_SECRET一致） |
| 前端.env.local | `client/.env.local` | **优先级高于.env**，会覆盖.env中的同名变量 |

**⚠️ 关键：`client/.env.local`的优先级高于`client/.env`！如果两个文件都定义了`VITE_REQUEST_SECRET`，Vite会使用`.env.local`中的值。必须确保`.env.local`中的`VITE_REQUEST_SECRET`与后端`REQUEST_SECRET`一致，否则前端认证会403。**

**后端.env关键变量**：
```
LLM_PROVIDER=aliyunCoding          # 全局回退供应商（步骤级路由见下方说明）
ALIYUN_CODING_API_KEY=sk-sp-xxx    # 阿里云 Token Plan 网关密钥
ALIYUN_CODING_MODEL=qwen3.8-flash  # 阿里云模型
ALIYUN_CODING_BASE_URL=https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
DEEPSEEK_API_KEY=sk-xxx            # DeepSeek API密钥（备用通道；当前为占位符，实测401）
DEEPSEEK_BASE_URL=https://xxx/v1   # DeepSeek API地址
DEEPSEEK_MODEL=deepseek-v4-pro     # DeepSeek模型
USE_PG=true                        # 使用 PostgreSQL 后端
DATABASE_URL=postgresql://postgres@localhost:5432/novel_pipeline
REQUEST_SECRET=xxx                 # 认证密钥（必须与 client/.env.local 的 VITE_REQUEST_SECRET 一致）
PORT=3001                          # 后端端口
PG_DUMP_PATH=                      # 可选：pg_dump 绝对路径（不在PATH时用，见 sop/11）
```

**LLM步骤路由规则**（`server/config/providerDefs.js` 的 `DEFAULT_STEP_ASSIGNMENTS`）：
1. 项目级 `agentModelConfig`（每步指定 keyId/provider）优先
2. 步骤分配表按键顺序匹配（只匹配当前有效供应商；已弃用的 provider 不参与）
3. 都没有才用 `LLM_PROVIDER` 全局回退

**本地思考模型治理（历史记录：该方案已弃用停用）**：曾接入 llama.cpp 系本地服务。
这类服务不认 API 层 `enable_thinking` 参数，思考会吃光 `max_tokens` 导致正文为空。
当时的对策是 provider 声明 `noThinkMarker`（` /no_think`），由 `llmRequestBuilder.buildRequestPayload`
统一在末条 user 消息追加，详见陷阱 #94。因本地 27B 生成速度过慢（约 6 tok/s，单章 20-40 分钟），
已弃用为主力方案，当前全部走云端网关。

**前端.env关键变量**：
```
VITE_REQUEST_SECRET=novel-pipeline-2024-secure  # 需与后端REQUEST_SECRET一致
```

**启动方式**：
```bash
# 后端（从项目根目录）
node server/index.js

# 前端（从client目录）
cd client && npm run dev
```

---

## 二、核心架构原则

### 2.1 唯一数据入口 — DataContext

**所有Agent通过DataContext读取数据，禁止直接调用store。**

```
Agent (writer/review/intent-planner)
    ↓ 唯一入口
DataContext (server/services/dataContext.js)
    ↓ 委托
TimelineService / PowerGuard / ForeshadowGuard / CharacterArcGuard / ...
    ↓ 委托
entityCenter / knowledgeBase / store(PG)
```

**为什么**：之前writer/review/chapterIntent各自直接读store，导致：
- 同一数据多处读取逻辑不一致
- 修改数据结构时遗漏某个调用点
- 多处修改产生冲突

**如何使用**：
```javascript
const { getDataContext } = require('./dataContext');
const ctx = await getDataContext(projectId);
const project = await ctx.getProject();
const genre = await ctx.getGenre();
const events = await ctx.getTimelineEventsForChapter(chapterNumber);
```

DataContext有缓存机制，同一projectId只创建一个实例，内部查询结果缓存避免重复IO。

### 2.2 三层存储架构

```
素材库 (materials表)     → 持久化原文，素材的single source of truth
    ↓ 素材更新时同步
实体中心 (entities表)    → 状态缓存 + 预计算提示词(brief/summary/detail)
    ↓ 实体变化时写入
知识库 (多表)            → 关系/伏笔/叙事/一致性/时间线/状态历史
```

**数据流向**：素材库是源头，实体中心是缓存层，知识库是分析层。不反向写入。

### 2.3 题材插件体系

每个题材是一个genre插件（`server/services/genres/`目录），定义：

| 字段 | 说明 |
|------|------|
| `id` | 题材ID，如 `high-martial-comedy` |
| `name` | 显示名，如 `高武喜剧` |
| `constraints` | 写作约束规则 |
| `agentMaterialAccess` | 各Agent可见的素材类型和优先级 |
| `styleProfile` | 风格配置（materialFocus/reviewFocus/forbidden等） |
| `entitySchema` | 实体字段定义（genreStateKeys + entityFields + relationTypes） |
| `detectors` | 内容检测器（如科技术语/网络用语检测） |
| `interceptors` | 内容拦截器 |
| `reviewRules` | 审核规则 |

**genreEntitySchemas.js** 从所有genre插件的entitySchema动态生成，不再手写。

---

## 三、Pipeline流程

### 3.1 完整流程

```
outline → intent-planner → writer → first-review → (fast-review) → material-manager → second-review → approved
```

| 步骤 | 文件 | 说明 |
|------|------|------|
| outline | pipeline.js | 大纲生成 |
| intent-planner | chapterIntent.js | 章节意图规划，通过DataContext读取数据 |
| writer | pipeline/steps/writer.js | 执笔人，通过DataContext读取数据 |
| first-review | pipeline/steps/review.js | 初审，注入守卫检查结果 |
| fast-review | pipeline/steps/review.js | 快审（通过 reviewOverride 路由作为初审+复审的替代路径） |
| material-manager | pipeline/steps/materialManager.js | 素材更新 |
| second-review | pipeline/steps/review.js | 复审 |

### 3.2 Writer注入内容

writer的prompt按以下顺序拼接：

```
基础prompt + 角色引用 + 素材注入 + 风格注入 + 题材注入
+ 叙事断裂提醒 + 时间线摘要 + 伏笔提示 + 角色活跃度提醒
```

| 注入项 | 来源 | 说明 |
|--------|------|------|
| 角色引用 | entityCenter.getForWriter | 按token预算裁剪 |
| 素材注入 | ctx.getActiveMaterials | 按题材agentMaterialAccess过滤 |
| 风格注入 | ctx.getStyleProfile | 风格模板 |
| 题材注入 | genre.writerInjection | 题材特定写作指导 |
| 叙事断裂 | ctx.getNarrativeBridgeMaterials | 跳过章节的过渡提醒 |
| 时间线 | ctx.getTimelineSummary | 近5章时间线摘要 |
| 伏笔提示 | ctx.getForeshadowHint | 活跃伏笔+超期伏笔 |
| 角色活跃度 | ctx.getCharacterActivityHint | 久未出场角色提醒 |

### 3.3 Review注入内容

review的prompt注入守卫检查结果：

| 注入项 | 来源 | 说明 |
|--------|------|------|
| 时间线矛盾 | ctx.detectTimelineConflicts | 同一角色同时出现在不同地点 |
| 战力一致性 | ctx.getPowerCheckHint | 战力突变/倒退/碾压检测 |
| 伏笔一致性 | ctx.getForeshadowCheckHint | 伏笔超期检测 |
| 角色弧线 | ctx.getCharacterArcCheckHint | 角色消失/停滞/工具人化 |
| 全局审计 | ctx.runFullAudit | 每10章自动触发4维度审计 |

---

## 四、六大守卫服务

### 4.1 TimelineService — 时间轴模块

**文件**：`server/services/timelineService.js`

**PG表**：`timeline`（通过`timeline-events`别名路由）

| 方法 | 说明 |
|------|------|
| `addEvent(projectId, event)` | 添加时间事件 |
| `getEventsForChapter(projectId, ch)` | 获取章节事件 |
| `getEventsForRange(projectId, from, to)` | 获取范围事件 |
| `getRecentEvents(projectId, ch, lookback)` | 获取近N章事件 |
| `getCausalChain(projectId, eventId)` | 因果链回溯 |
| `generateTimelineSummary(projectId, ch)` | 生成writer注入文本 |
| `detectTimeConflicts(projectId, ch)` | 检测时间矛盾 |

**集成点**：
- materialUpdateProcessor：每章素材更新时自动提取时间事件写入timeline
- writer：注入近5章时间线摘要
- review：检测时间矛盾

### 4.2 PowerGuard — 战力一致性守卫

**文件**：`server/services/powerGuard.js`

| 方法 | 说明 |
|------|------|
| `checkPowerConsistency(projectId, ch)` | 检测战力突变/倒退/碾压 |
| `getPowerCurve(projectId, entityId)` | 获取战力成长曲线 |
| `generatePowerCheckHint(projectId, ch)` | 生成review注入文本 |

**检测逻辑**：
- 战力突变：单章变化>50%视为异常
- 战力倒退：不允许（除非题材允许）
- 主角碾压：主角战力不得低于配角70%

**战力提取**：优先从`combatPower`字段，其次从`genreState`的`cultivationStage/abilityLevel`等字段解析。

### 4.3 ForeshadowGuard — 伏笔回收守卫

**文件**：`server/services/foreshadowGuard.js`

| 方法 | 说明 |
|------|------|
| `getOverdueForeshadows(projectId, ch)` | 获取超期伏笔 |
| `getResolveStats(projectId)` | 回收率统计 |
| `generateForeshadowHint(projectId, ch)` | 生成writer注入文本 |
| `checkForeshadowConsistency(projectId, ch)` | 伏笔一致性检查 |

**超期阈值**：
- 普通伏笔：10章未推进视为超期
- 重要伏笔：5章未推进视为超期
- 30章未回收视为严重超期

### 4.4 CharacterArcGuard — 角色弧线守卫

**文件**：`server/services/characterArcGuard.js`

| 方法 | 说明 |
|------|------|
| `checkCharacterArcs(projectId, ch)` | 检测角色消失/停滞/工具人化 |
| `getCharacterActivityStats(projectId, ch)` | 角色活跃度统计 |
| `generateCharacterArcCheckHint(projectId, ch)` | 生成review注入文本 |
| `generateCharacterActivityHint(projectId, ch)` | 生成writer注入文本 |

**检测逻辑**：
- 角色消失：主角/主要角色8章未出现
- 弧线停滞：10章状态无变化
- 工具人化：出场5次以上但无内心描写

### 4.5 ConsistencyAuditService — 长线一致性检查点

**文件**：`server/services/consistencyAuditService.js`

| 方法 | 说明 |
|------|------|
| `runFullAudit(projectId, ch)` | 4维度全局审计 |
| `shouldRunAudit(ch)` | 是否到达检查点（每10章） |
| `formatAuditReport(report)` | 格式化审计报告 |
| `getAuditHistory(projectId)` | 历史审计记录 |

**4维度**：power + foreshadow + character_arc + timeline

**触发时机**：review步骤中，每10章自动触发一次全局审计。

### 4.6 MaterialLifecycleService — 素材库长线管理

**文件**：`server/services/materialLifecycleService.js`

| 方法 | 说明 |
|------|------|
| `getMaterialActivityAnalysis(projectId, ch)` | 素材活跃度分析 |
| `archiveStaleMaterials(projectId, ch)` | 归档超期素材 |
| `detectDuplicateMaterials(projectId)` | 检测重复素材 |
| `calculateTokenBudget(projectId, ch)` | 动态token预算 |
| `getHealthReport(projectId, ch)` | 素材库健康报告 |

**衰减阈值**：
- 15章未引用：降低优先级
- 30章未引用：归档候选

---

## 五、知识库模块

**文件**：`server/services/knowledgeBase.js`

| 模块 | 类 | 核心方法 |
|------|-----|---------|
| 伏笔账本 | ForeshadowLedger | plant/advance/resolve/abandon/getActive/getOverdue/getStats |
| 记忆金字塔 | MemoryPyramid | addFact/getFactsForPrompt/promoteFact/runDecayCycle |
| 叙事追踪 | NarrativeTracker | updateState/detectPhase |
| 一致性检查 | ConsistencyChecker | recordCheck/checkNameConsistency |

**PG表**：
- `foreshadow_ledger` — 伏笔记录
- `knowledge_facts` — 记忆金字塔事实
- `narrative_state` — 叙事状态
- `consistency_checks` — 一致性检查记录
- `entity_state_history` — 实体状态快照
- `entity_relations` — 实体关系
- `entity_binds` — 实体绑定
- `craft_materials` — 工艺素材
- `timeline` — 时间轴事件

---

## 六、实体中心

**文件**：`server/services/entityCenter.js`

实体中心是素材库的缓存层，将素材数据转换为Agent可用的格式。

| 方法 | 说明 |
|------|------|
| `getForWriter(projectId, ch, budget)` | 获取writer可见实体（按token预算裁剪） |
| `getForReviewer(projectId, ch)` | 获取reviewer可见实体 |
| `getForIntentPlanner(projectId, ch)` | 获取intent-planner可见实体 |
| `getEntitiesForProject(projectId, opts)` | 获取项目所有实体 |
| `findEntityByName(projectId, type, name)` | 按名称查找实体 |
| `syncFromMaterial(projectId, material)` | 从素材同步到实体 |
| `syncRelationshipFromMaterial(projectId, mat)` | 从素材同步关系 |
| `saveStateSnapshot(projectId, ch)` | 保存实体状态快照 |

**三级提示词**：每个实体有brief/summary/detail三级文本，按token预算选择级别。

---

## 七、数据库架构

### 7.1 PG存储层

**文件**：`server/db/store-pg.js`（store的PG实现）

**双存储模式**：专用列（SQL查询用）+ data JSON列（完整对象）

**表分类**：
- `DEDICATED_TABLES`：有专用列的表（projects, chapters, materials, entity_registry等）
- 知识库表：entity_relations, entity_binds, foreshadow_ledger, knowledge_facts, narrative_state, consistency_checks, craft_materials, entity_state_history, timeline
- `kv_store`：无专用表的数据类型

**路由别名**（TABLE_ALIASES）：
- `timeline-events` → `timeline`
- `character-states` → `character_states`
- 等等

### 7.2 Schema源文件

| 文件 | 内容 |
|------|------|
| `server/db/pgSchema.js` | 业务表DDL（20张，聚合 Core + Entity + Library） |
| `server/db/pgSchemaLibrary.js` | 藏经阁表DDL（library_techniques） |
| `server/db/knowledgeSchema.js` | 知识库表DDL（9张） |
| `server/db/database-pg.js` | DEDICATED_TABLES + TABLE_ALIASES + 初始化 |

---

## 八、题材插件列表

| 文件 | 题材ID | 名称 |
|------|--------|------|
| genres/high-martial-crossplane.js | high-martial-comedy | 高武喜剧 |
| genres/urban-fantasy.js | urban-fantasy | 都市异能 |
| genres/tomato-revenge.js | tomato-revenge | 番茄复仇 |
| genres/tomato-sweet.js | tomato-sweet | 番茄甜宠 |
| genres/tomato-mystery.js | tomato-mystery | 番茄悬疑 |
| genres/tomato-system.js | tomato-system | 番茄系统流 |
| genres/tomato-talisman.js | tomato-talisman | 番茄符咒收集流 |
| genres/baby.js | baby | 萌宝 |
| genres/sci-fi.js | sci-fi | 科幻 |

**题材检测**：`genreConfig.js`的`detectGenre(styleProfile)`根据styleProfile匹配题材。

---

## 九、API路由


### 库维护与运行时观测 API（`server/routes/maintenanceRoutes.js`，2026-09-21 新增）

| 路由 | 说明 |
|------|------|
| `GET /api/maintenance/orphans` | 孤儿数据扫描（projectId 已不存在的历史行，只读） |
| `POST /api/maintenance/orphans/clean` | 孤儿数据清理（可传 keepProjectIds 白名单） |
| `GET /api/maintenance/runtime` | 运行时预警快照：LLM 超时/慢请求/连续超时 + 卡死任务 |

配套模块：
- `server/services/orphanCleanup.js` — 扫描/清理实现（表清单由 information_schema 动态发现，避免硬编码漂移）
- `server/services/llmTimeoutTracker.js` — LLM 超时与慢请求计数（health 暴露为 `llm-latency`）
- `server/routes/pipeline/asyncTaskManager.js` — 任务看门狗，终止态统一由 `isTerminal()` 判定（health 暴露为 `pipeline-tasks`）
- `server/shared/runContext.js` — 流水线运行上下文（AsyncLocalStorage），承载 `startRound`/`isLastRound`，
  供 reviews 单点补 `runRound` 与审核链做"末轮宽限"判定

### 知识库API（`server/routes/knowledge.js`）

| 路由 | 说明 |
|------|------|
| `GET /knowledge/timeline/:projectId/events` | 时间轴事件 |
| `POST /knowledge/timeline/:projectId/events` | 创建时间事件 |
| `PUT /knowledge/timeline/:projectId/events/:eventId` | 更新事件 |
| `DELETE /knowledge/timeline/:projectId/events/:eventId` | 删除事件 |
| `GET /knowledge/timeline/:projectId/causal-chain/:eventId` | 因果链 |
| `GET /knowledge/timeline/:projectId/conflicts` | 时间矛盾 |
| `GET /knowledge/timeline/:projectId/stats` | 时间轴统计 |
| `GET /knowledge/power-guard/:projectId/check` | 战力检查 |
| `GET /knowledge/power-guard/:projectId/curve/:entityId` | 战力曲线 |
| `GET /knowledge/foreshadow-guard/:projectId/overdue` | 超期伏笔 |
| `GET /knowledge/foreshadow-guard/:projectId/stats` | 伏笔统计 |
| `GET /knowledge/character-arc-guard/:projectId/check` | 角色弧线检查 |
| `GET /knowledge/character-arc-guard/:projectId/activity` | 角色活跃度 |
| `POST /knowledge/consistency-audit/:projectId/run` | 执行全局审计 |
| `GET /knowledge/consistency-audit/:projectId/history` | 审计历史 |
| `GET /knowledge/material-lifecycle/:projectId/analysis` | 素材活跃度 |
| `POST /knowledge/material-lifecycle/:projectId/archive` | 归档素材 |
| `GET /knowledge/material-lifecycle/:projectId/duplicates` | 重复素材 |
| `GET /knowledge/material-lifecycle/:projectId/budget` | token预算 |
| `GET /knowledge/material-lifecycle/:projectId/health` | 健康报告 |

---

## 十、前端知识库页面

**文件**：`client/src/pages/KnowledgePage.jsx`

8个Tab：

| Tab | 组件 | 说明 |
|-----|------|------|
| 总览 | 内联 | 项目概览统计 |
| 记忆金字塔 | 内联 | 5层记忆管理 |
| 关系图谱 | 内联 | 角色关系图 |
| 战力追踪 | PowerTracker | 战力曲线可视化 |
| 时间轴 | TimelineKnowledgePanel | 时间事件管理 |
| 伏笔管理 | ForeshadowingPanel | 伏笔追踪 |
| 一致性校验 | 内联 | 一致性报告 |
| 状态快照 | 内联 | 角色状态快照 |

---

## 十一、关键文件索引

### 后端服务层

| 文件 | 职责 |
|------|------|
| `server/services/dataContext.js` | **统一数据入口**，所有Agent通过此读取数据 |
| `server/services/entityCenter.js` | 实体中心，素材缓存层 |
| `server/services/knowledgeBase.js` | 知识库（伏笔/记忆/叙事/一致性） |
| `server/services/timelineService.js` | 时间轴服务 |
| `server/services/powerGuard.js` | 战力一致性守卫 |
| `server/services/foreshadowGuard.js` | 伏笔回收守卫 |
| `server/services/characterArcGuard.js` | 角色弧线守卫 |
| `server/services/consistencyAuditService.js` | 长线一致性审计 |
| `server/services/materialLifecycleService.js` | 素材库长线管理 |
| `server/services/libraryStore.js` | 藏经阁技法库数据访问层（PG单一数据源） |
| `server/services/techIndex.js` | 藏经阁检索门面（PG→内存，同步API） |
| `server/services/techniqueExtraction.js` | 技法一键提取编排（采样→LLM→去重→落库） |
| `server/services/genreConfig.js` | 题材检测与注册 |
| `server/services/prompts/styleInjector.js` | 风格注入 |
| `server/config/genreEntitySchemas.js` | 题材实体Schema（动态生成） |

### Pipeline步骤

| 文件 | 职责 |
|------|------|
| `server/services/pipeline/steps/writer.js` | 执笔人 |
| `server/services/pipeline/steps/review.js` | 初审/快审/复审 |
| `server/services/pipeline/steps/materialManager.js` | 素材管理 |
| `server/services/pipeline/steps/materialUpdateProcessor.js` | 素材更新处理 |
| `server/services/chapterIntent.js` | 章节意图规划 |

### 数据库层

| 文件 | 职责 |
|------|------|
| `server/db/database-pg.js` | PG连接+表定义+初始化 |
| `server/db/store-pg.js` | store的PG实现 |
| `server/db/pgSchema.js` | 业务表DDL |
| `server/db/knowledgeSchema.js` | 知识库表DDL |
| `server/store.js` | store统一接口（自动路由到PG） |

### 验收脚本

| 文件 | 验收内容 |
|------|---------|
| `scripts/verify-t0.js` | DataContext统一数据入口（32项） |
| `scripts/verify-t1.js` | 时间轴模块（35项） |
| `scripts/verify-t2.js` | 战力一致性守卫（17项） |
| `scripts/verify-t3.js` | 伏笔回收守卫（20项） |
| `scripts/verify-t4.js` | 角色弧线守卫（16项） |
| `scripts/verify-t5.js` | 长线一致性检查点（15项） |
| `scripts/verify-t6.js` | 素材库长线管理（17项） |
| `scripts/verify-regression.js` | 全量回归（23项） |

---

## 十二、DataContext方法完整列表

```javascript
// 项目数据
ctx.getProject()
ctx.getStyleProfile()
ctx.getGenre()
ctx.getGenreId()
ctx.getGenreSchema()
ctx.getStyleTemplate()
ctx.getMode()
ctx.getWordConfig()

// 章节数据
ctx.getChapter(chapterId)
ctx.getChapters(filter)
ctx.getPreviousChapter(currentChapterNumber)
ctx.getSkippedChapters(beforeChapterNumber)

// 素材数据
ctx.getMaterials(filter)
ctx.getActiveMaterials(type)
ctx.getForeshadowingMaterials()
ctx.getCharacterMaterials()
ctx.getNarrativeBridgeMaterials()
ctx.getCoreSettingMaterials()

// 实体数据（委托entityCenter）
ctx.getEntitiesForWriter(chapterNumber, tokenBudget)
ctx.getEntitiesForReviewer(chapterNumber)
ctx.getEntitiesForIntentPlanner(chapterNumber)
ctx.getEntitiesForProject(options)
ctx.getEntityByName(entityType, name)
ctx.getEntityRelations()
ctx.getRelationTypes()
ctx.getRelationTypeKeywords()

// 题材数据
ctx.getAgentMaterialAccess(agentName)
ctx.getMaterialFocus()
ctx.getReviewRules()

// 时间轴（委托timelineService）
ctx.getTimelineEventsForChapter(chapterNumber)
ctx.getTimelineEventsForRange(fromChapter, toChapter)
ctx.getRecentTimelineEvents(currentChapter, lookback)
ctx.getTimelineCausalChain(eventId, maxDepth)
ctx.getTimelineSummary(currentChapter, lookback, tokenBudget)
ctx.getTimelineStats()
ctx.detectTimelineConflicts(chapterNumber)

// 战力守卫（委托powerGuard）
ctx.checkPowerConsistency(chapterNumber)
ctx.getPowerCurve(entityId, fromChapter, toChapter)
ctx.getPowerCheckHint(chapterNumber)

// 伏笔守卫（委托foreshadowGuard）
ctx.getOverdueForeshadows(currentChapter)
ctx.getForeshadowResolveStats()
ctx.getForeshadowHint(currentChapter)
ctx.getForeshadowCheckHint(chapterNumber)

// 角色弧线守卫（委托characterArcGuard）
ctx.checkCharacterArcs(chapterNumber)
ctx.getCharacterActivityStats(chapterNumber)
ctx.getCharacterArcCheckHint(chapterNumber)
ctx.getCharacterActivityHint(chapterNumber)

// 长线审计（委托consistencyAuditService）
ctx.runFullAudit(chapterNumber)
ctx.shouldRunAudit(chapterNumber)
ctx.getAuditHistory(limit)

// 素材长线管理（委托materialLifecycleService）
ctx.getMaterialActivityAnalysis(currentChapter)
ctx.archiveStaleMaterials(currentChapter)
ctx.detectDuplicateMaterials()
ctx.calculateTokenBudget(chapterNumber)
ctx.getMaterialHealthReport(currentChapter)
```

---

## 十三、数据流图

### 正常Pipeline数据流

```
用户启动流水线
  → pipeline.js: runFullPipeline(projectId, chapterId)
    → intent-planner (chapterIntent.js)
      → ctx.getProject() / ctx.getChapters() / ctx.getEntitiesForIntentPlanner()
    → writer (writer.js)
      → ctx.getProject() / ctx.getStyleProfile() / ctx.getGenre()
      → ctx.getEntitiesForWriter() / ctx.getActiveMaterials()
      → ctx.getAgentMaterialAccess('writer') / ctx.getMaterialFocus()
      → ctx.getNarrativeBridgeMaterials() / ctx.getSkippedChapters()
      → ctx.getTimelineSummary() / ctx.getForeshadowHint() / ctx.getCharacterActivityHint()
    → first-review (review.js)
      → ctx.getProject() / ctx.getChapters() / ctx.getForeshadowingMaterials()
      → ctx.getCharacterMaterials() / ctx.getStyleTemplate()
      → ctx.getEntitiesForReviewer()
      → ctx.detectTimelineConflicts() / ctx.getPowerCheckHint()
      → ctx.getForeshadowCheckHint() / ctx.getCharacterArcCheckHint()
      → ctx.shouldRunAudit() ? ctx.runFullAudit() : null
    → material-manager
      → 素材更新 + entityCenter同步 + timeline事件写入
    → second-review
      → 同first-review的守卫检查
```

### 素材更新数据流

```
materialUpdateProcessor.js:
  素材变更 → entityCenter.syncFromMaterial() → 实体更新
           → entityCenter.syncRelationshipFromMaterial() → 关系更新
           → foreshadowLedger.plant/advance/resolve() → 伏笔更新
           → timelineService.addEvent() → 时间事件写入
           → entityCenter.saveStateSnapshot() → 状态快照保存
```

---

## 十四、开发约定

1. **所有Agent通过DataContext读取数据**，禁止直接调用store.getItem/queryItems
2. **新守卫服务必须集成到DataContext**，提供getXxx/CheckXxx方法
3. **题材特定逻辑放genre插件**，不放核心代码
4. **验收脚本必须通过**，修改后运行对应的verify-tX.js
5. **store-pg.js的knowledge表handler**需要同步更新DDL和handler条件
6. **不硬编码**：所有阈值提取到CONFIG常量，所有题材特定逻辑放genre插件

---

## 十五、藏经阁（写作技法库）

> 2026-09-21 重构：数据源由 JSON 文件迁移到 PG，并新增「一键提取」能力。
> 历史形态：`server/data/library/*.json`（index.json + leaf/*.json + metadata/*.json）。

### 15.1 存储与访问

| 层 | 文件 | 说明 |
|----|------|------|
| 表 | `server/db/pgSchemaLibrary.js` | `library_techniques`（21列 + 6索引），一条记录=一个技法全文 |
| 写handler | `server/db/store-pg-writer-library.js` | 必须存在，否则写kv_store读专表（陷阱#31） |
| 数据访问 | `server/services/libraryStore.js` | CRUD/统计/导入/元数据，store类型 `library-techniques` |
| 检索门面 | `server/services/techIndex.js` | PG → 内存视图（启动预热），对外**同步**API |
| BM25 | `server/services/techIndexSearch.js` | 纯函数检索（中文双字切分 + IDF） |
| JSON兜底 | `server/services/techIndexJsonSeed.js` | PG不可用/为空时兜底，保证注入链不断 |
| 迁移 | `scripts/migrateLibraryToPg.js` | JSON → PG（幂等） |

**为什么内存视图**：注入链 `techniqueScheduler.scheduleTechniques()` 是同步调用，
而 PG 是异步IO。技法总量仅百级，启动时全量载入内存（`server/index.js` 在 `runStartupChecks` 后
调用 `techIndex.initFromPg()`），对外保持同步；提取/编辑后由 `techIndex.reload()` 刷新。

### 15.2 注入链（未变更）

```
techIndex.getTechniquesByInjectionPoint(agentType, mode)
  → techniqueScheduler 按 sceneTypes/phase/knowledgeContext/genre/feedbackRates 打分取Top5
  → formatTechniquesForPrompt() 拼进 writer/polisher prompt
  → 审核结果经 techniqueFeedback 回写 → validationEngine.recordTechniqueResult 更新成功率
```

### 15.3 一键提取（2026-09-21 新增）

**目标**：从任意小说文本提取**跨作品通用**的写作技法并直接入库（不是某一本书的专有设定）。

| 环节 | 文件 | 说明 |
|------|------|------|
| 维度定义（SSOT） | `server/config/libraryExtractDimensions.js` | 10个通用维度（节奏/宏大/压力/危机/人物/弧光/对白/世界观/情感/语言）× 部门白名单 |
| 提示词 | `server/services/libraryExtractPrompt.js` | 三重约束：技法名必须是"做法"、禁作品专有名词、规则必须可执行 |
| 解析规范化 | `server/services/libraryExtractParse.js` | 剥离think/代码块 → 字段裁剪 → 部门子类校验 → 生成ID |
| 编排 | `server/services/techniqueExtraction.js` | 章节切块 → 全书**等距采样**（必含首尾块）→ 逐维调用LLM → 去重 → 落库 → reload |
| 路由 | `server/routes/libraryExtractRoutes.js` | POST /extract（异步任务）、GET /extract/:taskId、GET /extract-dimensions、POST /techniques、DELETE /technique/:id |
| 前端 | `client/src/pages/library/ExtractDialog.jsx` + `useExtractState.js` | 藏经阁页「⬆ 一键提取」按钮：上传txt/粘贴 → 选维度 → 进度 → 结果 |

**端点**：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/library/extract` | POST | 提交提取（body: text/novelName/dimensions），返回 taskId |
| `/api/library/extract/:taskId` | GET | 轮询进度（status/progress/step/terminal/result） |
| `/api/library/extract-dimensions` | GET | 维度清单（前端勾选） |
| `/api/library/techniques` | POST | 手动新增技法 |
| `/api/library/technique/:id` | DELETE | 删除技法 |

**关键约束与坑**：
- 长文本接口：`/api/library/extract` 的 `text` 字段走 `LIBRARY_EXTRACT.MAX_TEXT_CHARS`(300万字符)，
  否则被 inputSanitizer 默认上限静默截断（陷阱#115）。
- 任务超时：异步任务表看门狗 30 分钟（`routes/pipeline/asyncTaskManager.js`），
  单次LLM超时 `LIBRARY_EXTRACT.REQUEST_TIMEOUT_MS`(10分钟)。
- 去重：库内已有技法名 + 本批已产出名，包含关系即判重，避免换后缀重复入库。
- 产出必须通用：技法名含书名号/引号等专有名词特征直接判废（`libraryExtractParse`）。

---

## 十六、成本总闸与数据灾备（2026-09-30 新增）

> 背景：外部评审指出"单个四五百万字项目 ≈ 1700 章 / 1.7 亿 tokens"，而系统此前
> **数据库零备份**、**无项目级费用上限**，且所有长程机制只在 20 章尺度验证过。

### 16.1 项目预算熔断

| 层 | 文件 | 说明 |
|----|------|------|
| 配置（SSOT） | `server/config/systemConfigBudget.js` | `PROJECT_BUDGET`：开关/硬停/告警比例/默认上限/单价表 |
| 累计账 | kv `project-spend`（`dataStoreRegistry` 已注册） | 每项目一条；`store.updateItem` 进程内写锁自增（并发章节不丢更新） |
| 实现 | `server/services/pipeline/projectBudget.js` | 记账/体检/断言；`BudgetExceededError`（`code=BUDGET_EXCEEDED`） |
| 闸门 | `server/services/pipeline/llmBudgetGuard.js` | 接入 `services/llm.js` 的 `chat()`，**所有 LLM 调用必经** |
| 停机 | `server/services/pipeline/infinite/stopConditions.js` | 章节边界查预算，超限优雅停机并写日志 |
| 端点 | `routes/maintenanceRoutes.js` | GET/PUT `/api/maintenance/budget/:projectId` |
| 回填 | `scripts/backfillProjectSpend.js` | 从 token-ledger 补历史累计（默认干跑） |

```
llm.chat → llmBudgetGuard.begin(options)
             ├─ resolveProjectId：options.projectId > runContext(ALS).projectId
             └─ assertProjectBudget：超限抛 BudgetExceededError
         → 成功 → llmBudgetGuard.record(...) → project-spend 累加
```

**为什么闸门在 llm.chat 而不是 agentRunner**：实测把限额设为 1 token 后
`POST /api/pipeline/generate-materials` 仍跑通——`outlineGenerator` 直连 `llm.chat`，绕过 agentRunner。
单点出口才能覆盖全部调用方。

**为什么不复用 token-ledger 求和**：`tokenLedger.pruneOldLedger` 只保留最近 200 章，
求和会随项目推进越来越低估；故另开 `project-spend`（永不过期、锁保护自增）。

**预算与上下文预算的分工**：`config/budgetPolicy.js` 管单次调用的上下文怎么分（微观）；
`systemConfigBudget` 管项目累计到多少就熔断（宏观）。

### 16.2 数据备份与恢复

| 文件 | 作用 |
|------|------|
| `scripts/pgBackup.js` | 备份 / 校验（sha256）/ 恢复演练 / 保留策略 |
| `scripts/lib/pgBackupCore.js` | 核心逻辑（pg_dump 自动发现、导出、manifest、保留、恢复） |
| `scripts/pgBackupTask.bat` + `registerBackupTask.ps1` | Windows 计划任务外壳（需用户显式注册） |
| `backups/pg/backup-<时间戳>/` | `dump.pgc`（-Fc 自定义格式）+ `manifest.json`（sha256 + 各表行数基线） |

- **只备份不演练 = 没备份**：`--restore-test` 真建临时库恢复并逐表比对行数。
- 口令只经 `PGPASSWORD` 传递，绝不进命令行；一律 `-w` 避免卡在交互式口令提示。
- pg_dump 不在 PATH 时自动扫描标准安装目录（实测本机 `C:/Program Files/PostgreSQL/17/bin`），
  可用 `PG_DUMP_PATH` / `PG_RESTORE_PATH` 显式指定。
- 完整说明见 [docs/sop/11-数据备份与恢复.md](docs/sop/11-数据备份与恢复.md)。
