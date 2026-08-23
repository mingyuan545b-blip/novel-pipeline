# 规范文档 Part 5: 功能模块使用方式 + 长篇/短篇差异

> 本文档定义每个功能模块的作用、使用方式，以及长篇(500万字)与短篇(番茄30章5-6万字)的差异配置。

---

## 1. 功能模块总览

### 1.1 模块依赖关系

```
┌──────────────────────────────────────────────────┐
│                   Pipeline 编排器                  │
│  orchestrator.js → steps/writer → steps/review   │
│                  → steps/reviser → steps/editor   │
├──────────────────────────────────────────────────┤
│                  DataContext 统一数据入口           │
│  dataContext.js → 委托所有子模块                    │
├──────────┬──────────┬──────────┬─────────────────┤
│ 实体中心  │ 知识库   │ 时间轴   │ 守卫系统         │
│entityCenter│knowledgeBase│timeline│powerGuard      │
│          │          │          │foreshadowGuard  │
│          │          │          │characterArcGuard│
├──────────┴──────────┴──────────┴─────────────────┤
│              配置系统 (config/index.js)             │
│  genreDefaults → unifiedConfig → resolveConfig    │
├──────────────────────────────────────────────────┤
│              存储层 (store.js)                      │
│  PostgreSQL → SQLite → JSON File (三级降级)        │
└──────────────────────────────────────────────────┘
```

### 1.2 模块清单

| 模块 | 文件 | 作用 |
|------|------|------|
| Pipeline编排器 | core/pipeline/orchestrator.js | 管理步骤执行、熔断、重试 |
| 大纲生成器 | services/pipeline/outlineGenerator.js | 生成素材+大纲+实体+伏笔 |
| 写作Agent | services/pipeline/steps/writer.js | 生成章节正文 |
| 审核Agent | services/pipeline/steps/review.js | 初审/快审/复审 |
| 返修Agent | services/pipeline/steps/reviser.js | 根据反馈修改正文 |
| 定稿Agent | services/pipeline/steps/finalEditor.js | 最终判定+保存+快照 |
| ~~调整员~~ | ~~services/pipeline/steps/adjuster.js~~ | 已移除（原追加规则+微调素材功能由 reviser 处理） |
| 实体中心 | services/entityCenter.js | 实体CRUD+去重+关系+快照 |
| 实体注册表 | services/entityRegistry.js | 去重缓存（兼容旧API） |
| 知识库 | services/knowledgeBase.js | 伏笔账本+记忆金字塔+叙事追踪+一致性 |
| 时间轴 | services/timelineService.js | 事件管理+因果链+矛盾检测 |
| 伏笔守卫 | services/foreshadowGuard.js | 超期检测+回收率+注入 |
| 角色弧线守卫 | services/characterArcGuard.js | 消失/停滞/工具人化检测 |
| 战力守卫 | services/powerGuard.js | 战力突变/倒退/碾压检测 |
| Hook预算 | services/hookBudget.js | 伏笔容量管理+agenda生成 |
| DataContext | services/dataContext.js | Agent统一数据入口+缓存 |
| 配置系统 | config/index.js | resolveConfig统一入口 |
| 素材类型 | config/materialTypes.js | 31种类型+必检标准+层级规则 |
| 角色状态Schema | config/characterStateSchemas.js | 题材状态字段+追踪策略 |
| 题材实体Schema | config/genreEntitySchemas.js | 题材关系类型+里程碑+叙事阶段 |

---

## 2. 各模块使用方式

### 2.1 实体中心使用方式

```javascript
const entityCenter = require('./services/entityCenter');

// 创建/获取实体（唯一入口）
const entity = await entityCenter.getOrCreateEntity(
  projectId, 'character', '林晚晴',
  { roleLevel: 'protagonist', genreState: { cultivationStage: '练气' } }
);

// 更新实体
await entityCenter.updateEntity(entity.id, {
  hp: 80,
  genreState: { cultivationStage: '筑基' }
});

// 记录出场
await entityCenter.recordAppearance(entity.id, chapterNumber);

// 保存状态快照（定稿后自动调用）
await entityCenter.saveStateSnapshot(entity.id, chapterNumber, delta, changedFields);

// 获取Writer用实体列表（含Token预算控制）
const entities = await entityCenter.getForWriter(projectId, chapterNumber, 3000);

// 获取Reviewer用实体列表（完整详情）
const entities = await entityCenter.getForReviewer(projectId, chapterNumber);

// 添加关系
await entityCenter.addRelation(projectId, fromId, toId, 'ally', '青梅竹马', {
  strength: 80, startChapter: 1
});

// 从关系素材同步
await entityCenter.syncRelationshipFromMaterial(projectId, '林晚晴与顾深：青梅竹马', content, ch);

// 归档实体
await entityCenter.archiveEntity(entityId, 'retire');

// 获取统计
const stats = await entityCenter.getEntityStats(projectId);
```

### 2.2 知识库使用方式

```javascript
const { foreshadowLedger, memoryPyramid, narrativeTracker, consistencyChecker } = require('./services/knowledgeBase');

// 伏笔操作
await foreshadowLedger.plant(projectId, '身世之谜', '主角身世未明', {
  plantChapter: 1, importance: 'critical', expectedResolveWindow: '20章内'
});
await foreshadowLedger.advance(projectId, '身世之谜', 5, '发现旧照片');
await foreshadowLedger.resolve(projectId, '身世之谜', 20, '真相大白');
const active = await foreshadowLedger.getActive(projectId);
const overdue = await foreshadowLedger.getOverdue(projectId, currentChapter);

// 记忆金字塔
await memoryPyramid.addFact(projectId, 'L0', 'worldview', '灵气上限为九品', {
  entityId: null, chapterNumber: 1, importance: 100
});
const facts = await memoryPyramid.getFactsForPrompt(projectId, chapterNumber, 2000);
await memoryPyramid.runDecayCycle(projectId, currentChapter);

// 叙事追踪
await narrativeTracker.updateState(projectId, chapterNumber, {
  phase: 'rising', tension: 70, pacing: 'fast'
});
const state = await narrativeTracker.getState(projectId, chapterNumber);
const phase = await narrativeTracker.detectPhase(projectId, chapterNumber, genreId);

// 一致性校验
await consistencyChecker.recordCheck(projectId, chapterNumber, 'name', '主角称呼不一致', {
  severity: 'warning', entityId: entity.id
});
const unresolved = await consistencyChecker.getUnresolved(projectId);
```

### 2.3 时间轴使用方式

```javascript
const { timelineService } = require('./services/timelineService');

// 添加事件
await timelineService.addEvent(projectId, {
  chapterNumber: 5,
  eventTime: '第三天清晨',
  eventType: 'battle',
  actorIds: [protagonistId, antagonistId],
  locationId: locationId,
  description: '主角与反派首次对峙',
  precedingEventIds: [previousEventId],
  significance: 'major'
});

// 获取Writer注入文本
const summary = await timelineService.generateTimelineSummary(projectId, chapterNumber, 5, 800);

// 检测时间矛盾
const conflicts = await timelineService.detectTimeConflicts(projectId, chapterNumber);

// 因果链回溯
const chain = await timelineService.getCausalChain(projectId, eventId, 10);
```

### 2.4 伏笔守卫使用方式

```javascript
const { foreshadowGuard } = require('./services/foreshadowGuard');

// 获取超期伏笔
const overdue = await foreshadowGuard.getOverdueForeshadows(projectId, currentChapter);

// 获取回收率统计
const stats = await foreshadowGuard.getResolveStats(projectId);
// stats: { total, planted, advanced, resolved, abandoned, active, resolveRate, abandonRate, meetsTarget }

// 生成Writer注入文本
const hint = await foreshadowGuard.generateForeshadowHint(projectId, currentChapter);

// 生成Review注入文本
const checkHint = await foreshadowGuard.generateForeshadowCheckHint(projectId, chapterNumber);
```

### 2.5 Hook预算使用方式

```javascript
const { getHookBudgetForProject } = require('./services/hookBudget');
const hookBudget = getHookBudgetForProject(projectId);

// 注册新伏笔
const hook = await hookBudget.registerHook({
  type: '身份悬念',
  startChapter: 1,
  notes: '主角真实身份未揭示',
  payoffTiming: 'slow-burn'
});

// 推进伏笔
await hookBudget.advanceHook(hookId, chapterNumber);

// 回收伏笔
await hookBudget.resolveHook(hookId, chapterNumber, '真相大白');

// 获取预算状态
const status = await hookBudget.getBudgetStatus(currentChapter);

// 获取Agenda（注入Writer）
const agenda = await hookBudget.generateHookAgenda(currentChapter);
const agendaText = await hookBudget.formatHookAgendaForPrompt(currentChapter);

// 从素材库同步伏笔
const imported = await hookBudget.syncFromForeshadowingMaterials();
```

### 2.6 角色弧线守卫使用方式

```javascript
const { characterArcGuard } = require('./services/characterArcGuard');

// 检查角色弧线
const issues = await characterArcGuard.checkCharacterArcs(projectId, chapterNumber);
// issue types: character_disappeared, arc_stalled, tool_character

// 获取角色活跃度统计
const stats = await characterArcGuard.getCharacterActivityStats(projectId, chapterNumber);

// 生成Review注入文本
const hint = await characterArcGuard.generateCharacterArcCheckHint(projectId, chapterNumber);

// 生成Writer注入文本
const activityHint = await characterArcGuard.generateCharacterActivityHint(projectId, chapterNumber);
```

### 2.7 战力守卫使用方式

```javascript
const { powerGuard } = require('./services/powerGuard');

// 检查战力一致性
const issues = await powerGuard.checkPowerConsistency(projectId, chapterNumber);
// issue types: sudden_rise, sudden_drop, power_regression, protagonist_overshadowed

// 获取战力成长曲线
const curve = await powerGuard.getPowerCurve(projectId, entityId, fromChapter, toChapter);

// 生成Review注入文本
const hint = await powerGuard.generatePowerCheckHint(projectId, chapterNumber);
```

---

## 3. 长篇模式（统一）

> 说明：系统已统一为长篇模式（novel），原番茄短篇(tomato-short)和爽文(shuangwen)模式已移除。

### 3.1 规模

| 维度 | 长篇 (novel) |
|------|-------------|
| 总章数 | 100-2000+ |
| 总字数 | 20万-500万字 |
| 单章字数 | 2200-2800 |
| 角色数量 | 20-100+ |
| 伏笔数量 | 30-100+ |
| 卷数 | 5-20+ |

### 3.2 记忆金字塔差异

| 维度 | 长篇 | 短篇 |
|------|------|------|
| L0核心设定 | 世界观铁律+角色核心 | 同左 |
| L1近期关键 | 5章内 | 3章内（节奏更快） |
| L2中期参考 | 15章内 | 8章内 |
| L3远期存档 | 50章内 | 全篇（30章以内都是"远期"） |
| 衰减周期 | 慢（30章才过期） | 快（8章就过期） |
| Token预算 | 2000 | 1500（总篇幅短，预算更紧凑） |

### 3.3 伏笔管理差异

| 维度 | 长篇 | 短篇 |
|------|------|------|
| 最大活跃伏笔 | 12 | 12（相同上限） |
| 过期阈值 | 30章 | 8章 |
| 紧急阈值 | 5章 | 2章 |
| rangeScale | 1.0 | 0.35 |
| 回收窗口 | 50-80章(slow-burn) | 17-28章(slow-burn×0.35) |
| 自动通过轮次 | 无 | round>=2无critical即通过 |

### 3.4 审核流程差异

| 维度 | 长篇 | 短篇 |
|------|------|------|
| 审核层级 | 初审+复审+定稿 | 快审+定稿 |
| 最大返修轮次 | 7 | 5 |
| 章末钩子 | 可选 | 必须(requireCliffhanger=true) |
| 热梗注入 | 不需要 | 必须(requireTrendingMemes=true) |
| 对话比例上限 | 28% | 35%（短篇对话更密集） |
| 开篇钩子范围 | 100字 | 80字（更短的开篇就要抓住读者） |

### 3.5 实体管理差异

| 维度 | 长篇 | 短篇 |
|------|------|------|
| 角色出场追踪 | 8章未出现=消失 | 5章未出现=消失 |
| 弧线停滞阈值 | 10章无变化 | 5章无变化 |
| 工具人化阈值 | 5次出场无内心 | 3次出场无内心 |
| 主角内心独白间隔 | 每3章 | 每2章 |
| 状态快照频率 | 每章（定稿后） | 每章（定稿后） |

### 3.6 素材注入差异

| 维度 | 长篇 | 短篇 |
|------|------|------|
| 素材总预算 | 8000字符 | 8000字符（相同） |
| 角色详情预算 | 4000字符 | 3000字符（角色少，单角色可更详细） |
| 时间线回看 | 5章 | 3章 |
| 伏笔注入 | 活跃+超期 | 仅活跃（短篇不太会有超期） |
| 次位面 | 多次位面+跨位面 | 通常1个次位面或无 |

### 3.7 调整员差异

| 维度 | 长篇 | 短篇 |
|------|------|------|
| 最大Writer规则 | 3 | 2 |
| 最大Review规则 | 2 | 1 |
| 最大素材修改 | 2 | 1 |
| 规则上限 | 15条/类 | 15条/类（相同） |

---

## 4. 三后端自动降级架构

### 4.1 降级链

```
PostgreSQL (USE_PG=true) → SQLite (USE_SQLITE=true) → JSON File (默认)
```

### 4.2 环境变量

| 变量 | 作用 | 默认值 |
|------|------|--------|
| USE_PG | 启用PostgreSQL | false |
| USE_SQLITE | 启用SQLite | false |
| PG_CONNECTION_STRING | PG连接串 | - |
| REQUEST_SECRET | API认证密钥 | - |

### 4.3 注意事项

- 前端 `.env.local` 和后端 `.env` 必须有匹配的 `REQUEST_SECRET`
- SQLite 的 `database.js` 不能使用 `stmt.finalize()`（better-sqlite3不支持）
- JSON File 模式下所有数据存储在 `data/` 目录

---

## 5. 一致性审计系统

### 5.1 长线一致性审计

定期运行全量一致性检查（由 `consistencyAuditService` 管理）：

```javascript
const ctx = await getDataContext(projectId);

// 检查是否应该运行审计
if (ctx.shouldRunAudit(chapterNumber)) {
  const report = await ctx.runFullAudit(chapterNumber);
  // report包含：实体一致性、伏笔回收率、角色活跃度、战力曲线、时间线矛盾
}
```

### 5.2 审计报告格式

```javascript
{
  summary: {
    passed: boolean,
    totalChecks: number,
    passedChecks: number,
    failedChecks: number
  },
  entityConsistency: [{ entityId, issues }],
  foreshadowHealth: { resolveRate, overdueCount },
  characterActivity: [{ entityId, gap, isActive }],
  powerCurve: [{ entityId, anomalies }],
  timelineConflicts: [{ description, events }]
}
```

---

## 6. 完整数据流

### 6.1 单章Pipeline数据流

```
1. outlineGenerator.generateChapterOutlines
   → 生成大纲 + 创建素材 + 创建实体 + 创建伏笔 + 创建时间轴事件

2. chapterIntent (意图规划)
   → 读取实体+伏笔+时间线 → 生成章节意图

3. hookBudget.generateHookAgenda
   → 读取活跃伏笔 → 生成伏笔agenda

4. writer (写作)
   → 读取: 大纲+素材+实体状态+时间线+伏笔+角色活跃度+风格模板+题材注入
   → 输出: 章节正文

5. first-review/fast-review (审核)
   → 读取: 正文+实体状态+伏笔状态+题材规则
   → 检测: 俚语/视角/术语/泄露/重复/敏感词/字数
   → 输出: 审核结果(JSON)

6. reviser (返修，审核未通过时)
   → 读取: 正文+审核反馈+核心设定+题材规则
   → 输出: 修改后正文

7. final-editor (定稿)
   → 读取: 正文+初审+复审结果
   → 输出: approved/reject
   → approved后: 保存正文+实体快照+IP时间轴

8. ~~adjuster~~ (已移除，原调整功能由 reviser 处理)
   → 读取: 阅读者评审+当前规则+写作手法素材
   → 输出: 追加规则+素材微调（已废弃）
```

### 6.2 跨章数据流

```
每章定稿后:
  → entityCenter.saveStateSnapshot (所有活跃角色)
  → memoryPyramid.runDecayCycle (知识衰减)
  → hookBudget.updateHooksFromContent (伏笔自动推进/回收)
  → consistencyChecker.recordCheck (记录一致性问题)
  → narrativeTracker.updateState (更新叙事状态)
```

---

## 7. 验收检查清单

### 7.1 文档完整性

- [ ] Part1: 项目创建规范+三种模式配置差异 — 已完成
- [ ] Part2: Agent模块规范（职责/权限/输入/输出） — 已完成
- [ ] Part3: 素材库+知识库+实体中心规范 — 已完成
- [ ] Part4: 时间轴+伏笔回收+PG映射规范 — 已完成
- [ ] Part5: 功能模块使用方式+长篇/短篇差异 — 已完成

### 7.2 规范一致性

- [ ] 所有配置值来源于 config/index.js，无硬编码
- [ ] 所有实体创建通过 entityCenter.getOrCreateEntity
- [ ] 所有Agent数据获取通过 DataContext
- [ ] 所有伏笔操作通过 foreshadowLedger
- [ ] 所有时间轴操作通过 timelineService
- [ ] PG Schema 与 Store Type 映射一致
- [ ] 三种模式差异完整记录

### 7.3 格式规范

- [ ] 每个文件不超过200行（本文档为规范文档，允许超限）
- [ ] JSON格式统一使用双引号
- [ ] 表格对齐
- [ ] 代码示例可执行
