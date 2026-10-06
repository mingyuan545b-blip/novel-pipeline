# 字段单一源与 Agent 协作闭环 —— 完整性体检 + 计划书

> 建档：2026-10-07 | 状态：**待施工（交给下个窗口）**
> 承接：`docs/worklog/2026-10-06-勘定交接问题修复与复建压测.md`、`docs/worklog/2026-10-05-勘定压测问题汇总（交接给下个窗口）.md`
> 触发：用户反馈"实体中心角色字段缺少 / PG 映射表没发给 agent / 每章第一轮字数少 / 素材登记老未通过 / 每个 agent 都失败"，要求**根治**而非再打补丁。
> 结论一句话：**上面 5 个现象是同一个结构性缺陷的 5 种外显——全系统有 10+ 套各自为政的"字段/类型/状态"词汇表，没有唯一真相源，也没有任何一致性闸门校验它们。每次只修消费端 → 陷阱编号 +1 → 换个字段名复发。**

---

## 〇、证据取得方式（本报告全部实测，不是推断）

- 只读查询复建项目 `7d3e3e66-9e8b-4135-8053-d6ddb8b645d8`（kanding / 7 世界 / full+full）的 PG `materials` / `entities` 表；
- 直接调用 `validateMaterialDepth` 实跑深度校验；
- 阅读 `_kanding_server.log` / `output/restart6|7|9|10.log` 真实运行日志；
- 代码走读取证（下列每条带 `文件:行`）。
- **未修改任何代码/数据**（临时诊断脚本已删除）。

---

## 一、总览：一张根因图

```
                ┌──────────────────────────────────────────────┐
   生成端        │ genres/*/schemaConfig.protagonistTags          │  ← agent 看到的字段名
   (agent prompt)│ genres/*/materialTemplates.requiredFields      │  ← 又一套（还硬编码角色名"沈渡"）
                └──────────────────────────────────────────────┘
                                │  LLM 产出【身份】【欲望】【方言/语感】【关键行为】…
                                ▼
   校验端        materialDepthSpec.FIELD_SPECS / DEPTH_REQUIREMENTS  ← 字面精确匹配【身份/职位】
   (阻断)        materialTypes.requiredFields + 正则同义词
                materialContentPolicy
                characterFieldSpec（含 producers/consumers）
                                │  ✗ 对不上 → missing → 登记未通过
                                ▼
   提取端        characterStateLabeledFields.LABELED_PATTERNS        ← 宽容正则（身份|职位）
   (映射)                        │  ✗ 与校验端不同口径
                                ▼
   落库端        outlineEntitySync（手写固定字段表）
   (投影)        entityCRUD.mergeExistingEntity（真值覆盖）
                entityBehaviorRules.mergeableFields（第三套清单）
                fieldRegistryCharacter（PG 列，第四套）
                                │  ✗ 只在创建时同步一次
                                ▼
   消费端        contracts/*.yml stateJson.anyOf（7 份重复）          ← 又一套键名
   (契约)        agentMaterialHelpers.buildStateJson（不产出那些键）

   状态端        client STATUS_ORDER（含 first-reviewed/second-reviewed）
   (状态机)      server chapterStatus（不含 → 非法状态 → 门槛死锁）
```

**同一病症的 4 个实例：字段词汇表 / 素材类型词汇表 / 章节状态词汇表 / 契约键词汇表，全部无单一源、无闸门。**

---

## 二、问题清单（按严重度）

### P0-A　章节状态机前后端漂移 → 门槛活锁 / 永久砖（最高优先，用户可见"卡住"）

**现象**：`_kanding_server.log` 反复出现
```
[ERROR] [materialGate] 第2章被门槛拦下：第2章等待：第1章素材未归档（状态second-reviewed）
[ERROR] [materialGate] 第3章被门槛拦下：…第1章素材未归档（状态second-reviewed），共2章缺口
```

**根因取证**：
- `server/core/pipeline/orchestratorStepHandlers.js:69 / 92 / 129` 把审核通过后的状态写成
  `statusMap = { 'first-review': 'first-reviewed', 'second-review': 'second-reviewed' }`。
- 但 `server/services/chapterStatus.js` 的 `ALL_STATUSES` **根本没有** `first-reviewed` / `second-reviewed`（只有 `first-reviewing` / `second-reviewing`）。→ `isValidStatus()` 恒 false、`getStatusCategory()` 返回 UNKNOWN。
- `STUCK_STATUSES = IN_PROGRESS - approved`，不含这两个值 → `chapterScheduler.fixStuckChapters` **永远不会把它们重置回 outlined**。
- `selectNextChapter` 只挑 `outlined/draft` → 卡在 `second-reviewed` 的章**再也不会被选中**。
- `materialGate.findGaps` 要求前序章 `status===material-updated`，且补跑路径
  `materialGate.js:47 repairExhausted` **只认 `status===APPROVED`** → `second-reviewed` 既不可补跑、又不可重置。
- 结果：`batchExecutor.enforceChapterGate` 每轮 `continue + waitWithStop`，直到 30 分钟 `stuckTooLong` 才"带债放行"；而卡住的第 1 章**永久留在 second-reviewed**，数据半成品。

**为什么测试没拦住**：`tests/unit/chapterStatus*.test.js` 只断言 `outlined/written/approved/nonexistent`，**没有任何断言覆盖 handleReviewResult 写出的状态是否合法**；前端 `client/src/pages/pipeline/pipelineConstants.js:107` 的 `STATUS_ORDER` 却把这两个非法值当成正常状态显示 → 前端"认得"，后端状态机"不认得"，两边各自维护。

---

### P0-B　字段词汇表 10 套并存（"实体中心角色字段缺少 / 登记未通过 / 契约失败"的总根因）

**实测（复建项目，10/10 角色 `valid=false`）**：
```
岑野: missing ["身份/职位","说话语气","标志性细节","成长弧光","标志性动作"]
林婉: missing ["身份/职位","说话语气","标志性细节","核心欲望","行为模式"]
老鬼: missing ["身份/职位","说话语气","标志性细节"]
```
素材正文其实**内容齐全**，只是标签名不同：

| 校验端要求（materialDepthSpec） | 素材实际产出 | 提取正则认 | 结论 |
|---|---|---|---|
| `【身份/职位】` | `【身份】` | 认（`身份\|职位`） | 校验端最严 |
| `【核心欲望】` | `【欲望】` | 认 | — |
| `【说话语气】` | `【方言/语感】` | 认 | — |
| `【行为模式】` | `【关键行为】`/`【性格表现】` | **不认** | 直接丢 |
| `【标志性细节】` | 生成 prompt 只给 `【标志性动作】` | 半认（同映射到 signatureDetail） | 校验端要的字面标签从不出现 |

**具体取证**：
- 校验端字面匹配：`server/config/materialDepthSpec.js:109` `new RegExp('【'+fieldLabel+'】...')`。
- 提取端宽容正则：`server/services/pipeline/characterStateLabeledFields.js:7-14`。
- 生成端少字段：`server/services/genres/high-martial-crossplane/schemaConfig.js:49` 的 protagonistTags **没有 `【标志性细节】`**，而 `materialDepthRequirements.js:29-38` 的 character/deep `requiredFields` **每个层级都要 `【标志性细节】`** → agent 从未被要求写，校验永远缺。
- 还有一套只在题材模板里、且硬编码角色名：`server/services/genres/high-martial-crossplane/materialTemplates.js:16` `requiredFields:["身份","性格","微表情习惯","立场逻辑","与沈渡关系","禁忌"]`（"沈渡"是另一部作品的角色名）。

**汇总——字段词汇表定义点（≥10 处，互不引用）**：

| # | 文件 | 角色 |
|---|---|---|
| 1 | `server/db/fieldRegistryCharacter.js` | PG 列名 |
| 2 | `server/config/characterFieldSpec.js` | 字段+生产者/消费者 |
| 3 | `server/config/materialDepthSpec.js` | 校验 FIELD_SPECS |
| 4 | `server/config/materialDepthRequirements.js` | 校验 requiredFields |
| 5 | `server/config/materialTypes.js` | type+requiredFields+同义词正则 |
| 6 | `server/config/materialContentPolicy.js` | 内容策略字段清单 |
| 7 | `server/services/genres/*/schemaConfig.js` | 生成 prompt 标签 |
| 8 | `server/services/genres/*/materialTemplates.js` | 生成模板（硬编码） |
| 9 | `server/services/pipeline/characterStateLabeledFields.js` | 提取正则→内部键 |
| 10 | `server/services/pipeline/outlineEntitySync.js` + `entityBehaviorRules.mergeableFields` | 素材→实体映射 |
| 11 | `contracts/*.yml` `stateJson.anyOf` | 契约键 |

**关键：`fieldRegistry*`（PG 映射表）只被 `server/db/*` 消费，全项目没有任何一处把它注入 prompt**（grep 证实）→ 用户"PG 映射表没发给 agent"的判断**成立**，而且是"存储层/校验层/生成层"三条平行线。

---

### P0-C　契约层三重设计缺陷（"每个 agent 都失败"的直接原因）

1. **WARN/HIGH 被当成致命**：`server/services/pipeline/pipelineStepRunner.js:72-84` —— `if (inputCheck.warnings.length > 0) { … return 失败 }`，注释写着"WARN也阻断（用户要求）"。于是 `MM-IN-002 materials应可获取(HIGH)`、`RV-IN-002 project(HIGH)` 等**软规则**也会把 agent 打成失败。severity 分级形同虚设。
2. **同一个键依赖，手写在 7 份 YAML**：`WR-IN-004 / FR-IN-003 / SR-IN-004 / FA-IN-003 / FE-IN-004 / RV-IN-003 / PO-IN-003` 全部要求 `stateJson.anyOf:[innerConflict, independentStance, fateArc, (protagonistMirror/personality)]`。
3. **这个键根本产不出来**：`server/services/pipeline/agentMaterialHelpers.js:buildStateJson` 只产出 `name/roleLevel/lifecycleState/position/personality/speakingTone + genreState + KV动态键`，**从不产出** innerConflict/independentStance/fateArc/protagonistMirror；且 `contractValidator.js:66` 要求值非空。只有在 material-organizer 恰好输出了 `innerConflictNote/independentStanceNote/fateArcNote` 时（`characterFieldSpec.js:141-155`）才能间接满足。→ CH2+ 只要该章没有主角内在矛盾/配角独立立场的记录，**7 个 agent 一起被同一个键卡死**。

**为什么"修过还犯"**：`server/services/pipeline/contractMaterialEnricher.js` 是**消费端合并补丁**（项目自己的原则1把它列为"现行违规项"）——按**名字精确 join** `materials ↔ entities`，join 不上就原样返回、`stateJson` 仍空 → 契约照旧失败。它治的是症状，没治"生产者不产出键"。

---

### P1-A　单点装配名不副实（P1-4c 未闭环）

- 声明有素材需求的 agent：writer / 3×review / reviser / polisher / intent-planner / final-editor / reader / material-manager（`agentDeclarations*.js`）。
- 实际走 `materialStateAssembler`：writer / final-editor / polisher / reader / review / reviser。
- **完全绕过装配入口**：`material-manager` / `material-organizer` / `material-registrar` / `intent-planner` / `outline-generator` / `knowledge-extractor` / `consistency-constraint`（`material-organizer.js`、`materialManager.js` 里 0 处调用）。
- **审计是盲区**：`scripts/verifyMaterialAssemblyEntry.js` 只 grep 直接调用 `scheduleMaterials(` 的文件，**不检查 agent 是否走了装配入口** → 打印"✅ 所有 agent 均通过 assembly"是假阳性。这正是它文档里警告的"装配图缺记录 + 缺口无人报警"。

---

### P1-B　素材类型词汇表漂移 + 强归属校验 → 章节级新建素材被拒

- `materialTypes.js:68-80` 要求 `faction.parentPlane`、`institution.parentPlane`、`location.parentPlane`、`character.parentFaction` **必填**。
- 章节级新建走 `materialItemProcessor.js:65 validateMaterial` → `!valid` → `errors.push`（第 67 行）→ 登记失败。
- 已知历史：`materialItemProcessor.js:52-57` 对白名单外类型降级为 `other` 也会 `errors.push`（第 56 行，本是兜底好事却计成错误）。

---

### P1-C　registrar 把"告警"当"失败"（"素材登记老未通过"）

`server/services/pipeline/steps/materialRegistrar.js:86/128` `passed = errors.length === 0`，但 24 处 `errors.push` 里大量是告警级：
- `materialItemProcessor.js:92` 深度校验缺字段（P0-B 导致**必缺**）；
- `materialItemProcessor.js:56` 未知类型降级保留；
- `materialCharacterProcessor.js:94` `Character X not found in materials, skipping`（名字对不上，跳过即可）；
- `materialCharacterProcessor.js:68/81` lifecycle 实体/转移未找到。
→ 只要有任意一条，登记 step 就 `passed:false` 并显示给用户。

---

### P1-D　实体中心是"创建时快照"，且会被垃圾覆盖（"角色字段缺少"）

实测实体字段：
```
林婉 ： tone="无 | 无"        sig=""   craftStyle=""
苏青禾： tone="无 | 无"        sig=""
清界集团灰衣探员/清界猎犬小队： pos="" pers="" tone="" sig=""（全空）
```
- `outlineEntitySync.syncCharacterToEntityCenter` **只在初始生成时调用**（`materialGenerator.js:43/48`、`materialDepthEnforcer.js:138`）；章节级特质更新只写 `stateKVIndex`（`materialCharacterProcessor.js:118` / `processTraitNotes:165`），**不回写实体中心** → 实体永远是大纲那一刻的快照。
- `entityCenter/entityBehaviorRules.js:105` `mergeExistingEntity` 用 `if (defaults[field] && defaults[field] !== existing[field])` → `"无 | 无"` 是真值，会**覆盖**初始好数据。
- `outlineEntitySync.js:42-52` 的 craft 字段是**手写固定清单**；`entityCRUD.js:46-53` 又是另一份；`mergeableFields` 第三份。任何漏项 → 字段空。

---

### P1-E　门槛 / 补跑 / 旁路的因果链缺陷

- `materialGate.js:47 repairExhausted` 只认 `status===APPROVED` → 非 approved 的缺口（如 `second-reviewed`、`first-reviewed`）无法补跑，只能等 30 分钟债务。
- `batchExecutor.enforceChapterGate` 拦截后 `continue` 重选同一章 → **活锁**（配合 P0-A 成为永久砖）。
- `pipelinePostApproval._runMaterialManager` 三次失败 → `matManagerSucceeded=false` → **静默跳过 organizer/registrar/knowledge/depth**，但状态不置 `material-updated` → 下一章被门槛拦（日志实证）。
- `pipelineReaderCheck.js:88-108`：reader 发现硬伤后**直接**对受影响章跑 `reviser → final-editor → material-manager`，**绕过 orchestrator 主循环、字数门禁、且不跑 material-organizer/registrar** → 被改章的状态 KV/实体中心不更新（状态不一致），且可能对当前章**二次** material-manager。
- `dataFlowSpec.js` 已失真：`material-manager.downstream=['writer']`（应为 registrar）、**完全没有 material-organizer/knowledge-extractor/depth-drift/reader 回环** → 该"数据流规范"无人校验、已漂移。

---

### P1-F　每章第一轮字数少（承接上一轮结论，此处并入）

- 第 1 轮 writer 只注入软总量指令（`writerPromptBuilder.js:41 buildLengthInstruction`）；**量化扩写指令只在 `round>1` 注入**（`writerPromptBuilder.js:155-175` → `expansionInstructionBuilder`）。而该构建器自述"flash/27B 级模型对含糊指令不扩足"。
- 项目 `wordConfig={minWords:2500,targetWords:3000,rejectMin:2500}` → `rejectMin==targetMin`，**可救区宽度为 0**。
- 实证：`output/restart6.log` `2264/2264/2264`、`restart10.log` `1618/1618/2213`（长度先验 + 同 prompt 同补全）。

---

### P2-A　元问题：没有一致性闸门 + 陷阱清单在膨胀

- `docs/sop/00-陷阱清单.md` 的**核心原则1**已明确"单一数据源、禁止消费端堵漏"，并自列 3 个现行违规项（`findCharacterMaterial` fallback、`contractMaterialEnricher` 合并 KV、`processChapterDepth` 反向提取）——**原则写在纸上，没有机器执行**。
- 代码里 `陷阱#` 编号已到 **95**（`grep -roh` 去重 38 个），说明"点状修复"是当前默认工作方式。
- 无任何测试/CI 校验：① 生成 prompt 标签 ⊆ 校验 requiredFields；② 校验 label 能被提取正则命中；③ registry.key ↔ PG 列 ↔ entity 键 ↔ 契约键三方一致；④ 代码写出的 status ⊆ chapterStatus.ALL_STATUSES。

---

## 三、Agent 间协作矩阵（输入/输出/实际键/断点）

| 步 | 声明需求 | 装配入口 | 实际输入键 | 输出键 | 断点 |
|---|---|---|---|---|---|
| outline-generator | ✗未声明 | ✗绕过 | project/genre/genre插件 | 素材+大纲 | 生成标签 ≠ 校验标签（P0-B） |
| intent-planner | ✓ | ✗绕过 | outline | chapterIntent | 深度字段来源不明 |
| writer | ✓ | ✓ | materials[].stateJson | chapter.content | 契约 WR-IN-004 深度键缺失（P0-C） |
| first-review | ✓ | ✓(reviewShared) | chapter.content + stateJson | firstReviewOutput | FR-IN-003 同键缺失 |
| second-review | ✓ | ✓ | content+firstReviewOutput | secondReviewOutput | SR-IN-004 同键缺失 |
| final-editor | ✓ | ✓ | content+firstReviewOutput | status | FE-IN-004 同键缺失 |
| reviser | ✓ | ✓ | content+reviewFeedback | content | RV-IN-003 同键缺失 |
| polisher | ✓ | ✓ | content | polisherOutput | PO-IN-003 同键缺失 |
| material-manager | ✓ | ✗绕过 | materials+chapter | materialUpdates | WARN(HIGH) 也阻断（P0-C） |
| material-organizer | ✗未声明 | ✗绕过 | chapter.content+kvSummary | organizingPlan | organizer 输出决定深度键是否产生 |
| material-registrar | ✗未声明 | ✗绕过 | organizingPlan | operations/errors | passed=errors.length===0（P1-C） |
| reader | ✓ | ✓ | recentChapters | readerOutput | 返修旁路（P1-E） |

**共性断点**：① 一半 agent 绕过装配入口 → 缺口不记账；② 深度键的**唯一产生者**是 material-organizer 的 Note 字段，却被 7 个 agent 的契约硬依赖；③ 素材↔实体靠名字 join，无外键。

---

## 四、计划书（根治方案）

### 4.0 目标与硬性验收

**目标（可度量）**：
1. 复建项目 10/10 角色 `validateMaterialDepth().valid === true`；
2. `material-registrar` 在正常章节 `passed === true`（errors 只保留真·写库失败）；
3. 章节状态集合 `{代码写入的 status} ⊆ chapterStatus.ALL_STATUSES`，且状态机有回退路径；
4. 第 1 轮 writer 字数落在可救区（≥rejectMin）比例 > 90%；
5. 每个 agent 的契约输入键，都能在"装配入口产出"里找到生产者。

**硬性约束（用户红线）**：不新增堵漏式消费端 fallback；改生产端；每步带回归。

### 4.1 建立 4 张"注册表"（唯一真相源）

**R1 `server/config/fieldRegistry/characterFields.js`（字段主数据）**
```js
{ key:'speakingTone', labels:['说话语气','方言/语感','说话风格','口音','方言'],
  aliases:['tone'], minChars:4, qualityHints:[...],
  requiredBy:{protagonist:'deep',supporting:'standard',npc:'basic'},
  producers:['initial-material','material-organizer'],
  consumers:['writer','entity-center','frontend','contract'],
  pgColumn:'speakingTone', entityKey:'speakingTone', stateJsonKey:'speakingTone' }
```
→ **派生**：`materialDepthSpec.FIELD_SPECS`、`DEPTH_REQUIREMENTS`、`characterFieldSpec`、`characterStateLabeledFields.LABELED_PATTERNS`、`outlineEntitySync` 映射、`entityCRUD` craft 清单、`mergeableFields`、**genres 生成 prompt 的 tags 片段**（这一步才真正"把映射表发给 agent"）、`contracts/*.yml` 的 `stateJson.anyOf`。
→ 旧文件改为**薄封装 re-export**，不破坏引用（陷阱#45）。

**R2 `server/config/statusRegistry.js`（章节状态单一源）**
- 全量状态（含 `first-reviewed/second-reviewed`，或统一改名为 `first-reviewing` 态下的子态——二选一，**后端为准，前端 import 后端导出**）；
- `STUCK_STATUSES` / 回退规则 / `isValidStatus`；
- 前端 `client/src/shared/chapterStatusConstants.js` 从后端**同构导出**（构建期生成，避免手抄）。

**R3 `server/config/materialTypeRegistry.js`**：type 主数据（valid/emoji/color/parentRequired/gen 端 label/decl 端 type），派生 `materialTypes` / `agentDeclarations` 校验 / 生成 type 列表。

**R4 `server/services/pipeline/contracts/_registry.js`**：把 7 份重复的 `stateJson.anyOf` 抽成一处常量，YAML 引用；并明确 severity 语义（见 4.2.2）。

### 4.2 一致性闸门（CI + pre-commit，防复发核心）

新增 `scripts/audit-vocabulary-consistency.js`（只读，放五关门禁）：
1. 每个 `DEPTH_REQUIREMENTS.requiredFields` 标签，必须存在于生成端 prompt tags（否则 fail：agent 没被要求写）；
2. 每个校验 label，必须被提取正则命中（读写同口径）；
3. 每个 `fieldRegistry.key`，必须能解析到 `pgColumn` + `entityKey` + `stateJsonKey`（三方齐全）；
4. 全仓库扫描 `status = '...'` / `statusMap` 写入值 ⊆ `ALL_STATUSES`（**这条能立刻抓出 P0-A**）；
5. 每个 `contracts/*.yml` 的输入键，必须能在"装配入口产出"里找到生产者。

### 4.2.2 契约语义修正
- `pipelineStepRunner.js`：只有 `CRITICAL` 阻断，`HIGH/WARN` 记日志 + 通知，不 return 失败；
- `stateJson.anyOf` 的键改为**由 registry 明确"生产端"**：要么让 `buildStateJson` 真正产出（新增 `independentStance/fateArc/innerConflict` 到实体/KV 写入路径），要么把契约键换成"实体中心实际有的键"（如 `personality`）——**改生产端，不在契约端加 fallback**。

### 4.3 各问题对应改法（与 P 编号映射）

| 问题 | 根治动作 | 触及文件 |
|---|---|---|
| P0-A 状态漂移 | R2 + 闸门4 + `fixStuckChapters` 覆盖全部非终态；前端从后端导出 | chapterStatus / orchestratorStepHandlers / chapterScheduler / client |
| P0-B 字段漂移 | R1 + 闸门1/2/3；生成 prompt 从 registry 生成 | 10 处词汇表文件 |
| P0-C 契约 | 4.2.2 + R4；删 contractMaterialEnricher 的 KV 合并（改生产端） | pipelineStepRunner / contracts / contractMaterialEnricher / agentMaterialHelpers |
| P1-A 装配假单点 | 让 material-manager/organizer/registrar/intent-planner 也走装配入口；审计改为"按 agent 名单逐一断言走了入口" | materialStateAssembler / agentDeclarations / verifyMaterialAssemblyEntry |
| P1-B 类型漂移 | R3；章节级新建未过校验→降级为**warning**并落 `unvalidated` 标记 | materialTypes / materialItemProcessor |
| P1-C 登记误伤 | registrar 拆 `errors`(致命) / `warnings`(告警)；`passed = 无致命` | materialRegistrar / 24 处 push 分诊 |
| P1-D 实体快照 | 新增 `projectEntityFromMaterial(material)` 单一投影函数，素材写路径末尾统一调用；merge 空值/占位词不覆盖（`''/'无'/'无\|无'/n/a`） | outlineEntitySync / entityBehaviorRules / materialActions |
| P1-E 门槛/旁路 | `repairExhausted` 覆盖 approved+reviewed 态；batchExecutor 拦截走"阻塞该章+跳过并前进"而非活锁；reader 返修改走主循环 | materialGate / batchExecutor / pipelineReaderCheck |
| P1-F 字数 | 第 1 轮即注入量化扩写指令（分场景预算+检查点+自查）；项目 wordConfig 拉开 rejectMin/targetMin | writerPromptBuilder / sceneFloorInstruction |
| P2-A 元问题 | 闸门进 CI；更新 dataFlowSpec 并加"dataFlow 与真实步骤比对"检查 | scripts / dataFlowSpec |

### 4.4 施工顺序（每步独立可验收，禁止一把梭）

- **S1（P0-A）**：状态机单一源 + 闸门4。**最小、最高收益**，先修"卡死"。
- **S2（P0-C-1）**：契约 severity 语义（WARN 不阻断）+ 7 份 anyOf 抽公共 + 改 `buildStateJson` 生产端产出深度键。→ 直接消掉 `RV/FR/PO-IN-003`。
- **S3（P1-C）**：registrar errors/warnings 分诊。→ "登记未通过"消失。
- **S4（P1-D）**：实体投影重建 + merge 空值保护。→ "角色字段缺少"消失。
- **S5（P0-B）**：R1 字段注册表（先覆盖 character 8 核心字段）+ 闸门 1/2/3 + 生成端 prompt 派生。→ 深度校验全绿。
- **S6（P1-A/E）**：装配入口全覆盖 + reader 返修走主循环 + 门槛回退路径。
- **S7（P1-F）**：第 1 轮量化字数 + wordConfig 放开可救区。
- **S8**：`dataFlowSpec` 更新 + 文档同步（ARCHITECTURE / DATABASE_SCHEMA / SESSION-STATE / INDEX）。

### 4.5 风险与回滚
- R1 会**动到校验/prompt/契约主干**，属中大型重构；建议每步单独 commit + 单独回归（当前基线：后端 240 套件/3839 用例；前端 17 failed/932 passed 为既有基线）。
- 每步前跑 `node scripts/audit-iron-law.js --self-check`；提交走五关门禁。
- 回滚点：每 S 步一个 commit，可单独 revert。

### 4.6 验收（用真实项目，不造测试数据）
- 项目 `7d3e3e66-…`；断言：① 10/10 角色 depth valid；② registrar passed；③ ch1-3 首轮 ≥ 可救区；④ 状态集合全部合法；⑤ `audit-vocabulary-consistency` 0 violation。
- 端到端：`node scripts/run20ChapterE2E.js --chapters 3 --dry-run` 起步，再真跑 3 章。

---

## 五、交接给下个窗口

1. **开工第一条命令**：`node scripts/audit-vocabulary-consistency.js`（S1 先写这个闸门，跑一遍拿到全量违规清单，作为施工台账）。
2. **先读**：本文件 → `docs/sop/00-陷阱清单.md`（原则1）→ `docs/design/章节因果门槛与单点素材装配（计划书）.md`（P1-4 上游）。
3. **不要做**：不要再用 `||` 默认值 / fallback 查询 / 事后同步层去"补齐"字段（这是原则1明令禁止的堵漏，也是本报告全部问题的成因）。
4. **决策待确认（需用户拍板）**：
   - R2 状态命名：是把 `first-reviewed/second-reviewed` **补进**状态机，还是**改回** `first-reviewing` 子态？（改前端还是改后端）
   - R1 字段注册表覆盖范围：仅 character 核心 8 字段起步，还是一次性覆盖全部类型？
   - 4.2.2 契约深度键：改成"实体已有的键"还是"让生产端真正产出 innerConflict/independentStance/fateArc"？

---

## 附录 A：状态非法写点
`server/core/pipeline/orchestratorStepHandlers.js:69,92,129` → `first-reviewed` / `second-reviewed`（不在 `ALL_STATUSES`）。
前端误认为合法：`client/src/pages/pipeline/pipelineConstants.js:107`。

## 附录 B：契约深度键 7 份重复
`writer:51 / first-review:38 / second-review:46 / fast-review:39 / final-editor:46 / reviser:39 / polisher:39`（`contracts/*.contract.yml`），键集 `innerConflict|independentStance|fateArc|protagonistMirror|personality`；产出端 `agentMaterialHelpers.buildStateJson` 不产出前四个。

## 附录 C：绕过装配入口的 agent
material-manager / material-organizer / material-registrar / intent-planner / outline-generator / knowledge-extractor / consistency-constraint（`grep assembleMaterialState|scheduleMaterials` = 0）。
