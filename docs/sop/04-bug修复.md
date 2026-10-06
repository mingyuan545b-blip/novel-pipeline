# Bug修复SOP

> 触发条件：任何bug修复/异常排查
> 前置：已读 [00-陷阱清单.md](00-陷阱清单.md)

---

## 一、根因分析（强制）

**禁止只修表面现象。** 修复前必须回答：

```
[根因分析]
1. 问题的根本原因是什么？（不是表面现象）
2. 修改会影响哪些模块和功能？（grep验证）
3. 可能引入哪些新风险？
4. 有没有更安全、更简单的替代方案？
5. 之前有没有犯过类似错误？（查陷阱清单）
```

---

## 二、影响范围排查

### 2.1 依赖grep
```bash
# 谁引用了这个文件？
grep -rn "require.*<moduleName>" server/

# 谁调用这个函数？
grep -rn "<functionName>" server/ client/src/

# 同类模式是否还有其他地方？
grep -rn "<pattern>" server/
```

### 2.2 同类bug全量修复
- 发现一个bug，必须grep全量同类模式
- 禁止只修一个文件（见陷阱#10）
- 修复清单必须列全所有受影响文件

---

## 三、修复执行

### 3.1 最小改动原则
- 只修改与问题直接相关的代码
- 禁止过度重构
- 禁止"顺手优化"无关代码

### 3.2 禁止改旧bug加新bug
- 修改前分析影响范围
- 只修改与问题直接相关的代码
- 必须回归测试所有受影响功能

### 3.3 配置同步
- 修改配置项必须同步到systemConfig.js
- 修改数据结构必须同步上下游
- 修改API响应格式必须同步前端

---

## 四、验证清单

### 4.1 代码验证
- [ ] 修改文件≤200行
- [ ] 无新增硬编码
- [ ] 命令使用 cmd/Node（未使用 PowerShell）
- [ ] async调用都加了await

### 4.2 功能验证
- [ ] bug已修复（用真实数据验证，不是单元测试）
- [ ] 同类问题全量修复（grep验证无遗漏）
- [ ] 回归测试通过（受影响功能正常）
- [ ] 服务器能启动
- [ ] /api/health返回200

### 4.3 数据验证（如涉及）
- [ ] 读写表一致（POST后GET能查到）
- [ ] 数据变更同步上下游
- [ ] 级联删除正常（如涉及项目删除）

---

## 五、陷阱追加（强制）

修复bug后，如果发现新陷阱，必须追加到 [00-陷阱清单.md](00-陷阱清单.md)：

```
| # | 陷阱简述 | 根因+对策（含具体文件名/函数名/SQL） |
```

---

## 六、堵漏式修复禁令（⚠️最高优先级，违反=回滚）

> 触发条件：任何bug修复方案设计前
> 前置：已读 [00-陷阱清单.md](00-陷阱清单.md) 陷阱#87-#88
> **历史教训**：3个Bug（陷阱#80-82）修复全部是堵漏，9处排查发现8处堵漏，根因都指向material-organizer prompt源头

### 6.1 四类堵漏模式识别（禁止新增）

**模式1：消费端拼凑**
- 特征：在读取端合并多数据源补救，而非生产端直接输出
- 案例：contractMaterialEnricher.js在契约校验前合并KV store深度字段
- 判定：`grep -rn "enrichMaterials\|mergeState\|combineData" server/services/pipeline/`

**模式2：事后补标记**
- 特征：流程结束后补写状态字段，而非流程中自然更新
- 案例：markChapterProcessed在material-manager后补chapterUpdated
- 判定：`grep -rn "markChapter\|postProcess\|afterStep.*update" server/services/pipeline/`

**模式3：fallback默认值掩盖**（陷阱#89修正：字段+默认值双重匹配，非所有||都报）
- 特征：核心业务字段（roleLevel/roleType/importance/significance）用业务默认值掩盖生产端缺失
- ⚠️区分：
  - `mat.roleLevel || 'npc'` → **堵漏**（核心业务字段+业务默认值）
  - `errorMessage || 'unknown'` → **防御性编程**（错误信息兜底，合理）
  - `material.name || ''` → **防御性编程**（空值兜底，合理）
- 核心业务字段清单：roleLevel/roleType/importance/significance（新增核心业务字段时必须同步更新audit-leak-fix.js的codePattern）
- 案例：outlineEntitySync.js:22 `mat.roleLevel || 'npc'` — 用'npc'伪装没生成的roleLevel
- 判定：`grep -rnE "\b(roleLevel|roleType|importance|significance)\b.*\|\| '(npc|unknown|default|normal|none|minor|major|protagonist|antagonist)'" server/services/pipeline/`

**模式4：事后提取补救**
- 特征：从正文反向提取本应生产端直接输出的字段
- 案例：processChapterDepth从正文提取深度指标
- 判定：`grep -rn "extract.*from.*content\|reverseExtract\|postExtract" server/services/pipeline/steps/`

### 6.2 强制源头修复流程（6步法）

```
[源头修复6步法 - 禁止跳过]
Step1: 定位生产端——哪个agent/prompt没生成数据？
Step2: 修复生产端——修改agent prompt让LLM直接输出缺失字段
Step3: 验证消费端无需拼凑——grep确认消费端代码不再需要合并/补标记
Step4: 删除堵漏代码——移除contractMaterialEnricher/markChapterProcessed等
Step5: 全量测试——单元测试+端到端验证
Step6: CI扫描——运行audit-leak-fix.js确认无新增堵漏
```

### 6.3 修复方案验证3问（强制，陷阱#88）

**修复前必须用数据回答**：

```
[修复方案验证3问]
1. 修复后能否真正解决问题？
   - 案例：强制innerConflict后LLM能否写出主动配角？→ 查限知信息差是否解决
   - 禁止：未验证假设就实施

2. 根因在哪个层级？
   - 必须逐层验证：素材层→契约层→审核层→设定层→数据源层
   - 禁止：只看一层就下结论

3. 是否有同类bug全量grep？
   - 案例：3处resolveGenreFromProject({styleProfile})同样bug
   - 禁止：只修一个文件
```

### 6.4 堵漏代码白名单（允许保留的堵漏）

以下堵漏代码**允许保留**，但必须满足条件：
1. **优雅降级**：生产端失败时的fallback（如LLM返回空时的默认值），但必须log.warn
2. **向后兼容**：旧数据迁移期的临时补丁，但必须有删除时间点
3. **跨系统适配**：不同数据格式的转换层（如_convertMmOutputToOrganizingPlan），但必须标注"fallback only"
4. **自然流程**：步骤内部的状态更新（如markChapterProcessed在material-manager内部），非外部补标记
5. **独立检测机制**：有独立价值的检测逻辑（如processChapterDepth用于工具人化检测），非数据拼凑
6. **数据源统一层**：统一不同消费端的数据源（如contractMaterialEnricher统一契约校验与writer数据源），删除会导致误判

**白名单条件**：
- [ ] 有明确的fallback触发条件（不是无条件执行）
- [ ] 有log.warn记录fallback触发
- [ ] 有删除计划（注释标注预计删除时间/条件）

**当前白名单清单**（audit-leak-fix.js WHITELIST）：
| 文件 | 函数 | 类别 | 删除条件 |
|---|---|---|---|
| pipelinePostApproval.js | _convertMmOutputToOrganizingPlan | 跨系统适配 | material-organizer稳定运行30天无失败后 |
| agentTemplateFallbacks.js | fallbackPersonality | 优雅降级 | 所有题材agent都输出结构化personality后 |
| materialManager.js | markChapterProcessed | 自然流程 | stateKVIndex.updateAfterOperations内部自动更新后 |
| materialRegistrar.js | markChapterProcessed | 自然流程 | stateKVIndex.updateAfterOperations内部自动更新后 |
| materialRegistrar.js | processChapterDepth | 独立检测机制 | writer prompt直接输出深度指标计数后 |
| contractMaterialEnricher.js | enrichMaterialsForContract | 数据源统一层 | materials表stateJson直接包含深度字段后 |

### 6.5 CI检测脚本（强制集成）

```bash
# 提交前必须运行
node scripts/audit-leak-fix.js

# 检测规则：
# 1. 新增文件名含enricher/merger/combiner/postProcessor → 警告
# 2. 新增函数名含enrich/merge/combine/markProcessed/postExtract → 警告
# 3. 新增 || 'npc' / || 0 / || '' 模式 → 警告
# 4. 已有堵漏代码（白名单外）→ 提示清理

# 退出码：
# 0 = 无新增堵漏
# 1 = 发现新增堵漏（阻断CI）
# 2 = 已有堵漏未清理（警告不阻断）
```

---

## 七、常见bug排查路径

### 7.1 POST成功但GET返回404
**根因**：读写表不一致（见陷阱#31）
**排查**：
1. 检查store-pg-writer.js的handlers[table]是否有专用handler
2. 无handler则走_writeKvStore写入kv_store，但读取走专用表
3. 修复：创建专用handler含INSERT/UPDATE SQL

### 7.2 genre=null导致输出偏移
**根因**：未用resolveGenreFromProject（见陷阱#23）
**排查**：
```bash
grep -rn "detectGenre(project\?\.styleProfile" server/
```
**修复**：全部替换为resolveGenreFromProject(project)

### 7.3 角色名/职业偏移
**根因**：素材未传入或nameLock失效（见陷阱#20）
**排查**：
1. 检查writer prompt是否包含角色素材
2. 检查nameLock是否启用
3. 检查constraintInjector是否注入HARD BLOCK

### 7.4 测试通过但运行时报错
**根因**：缺少启动验证（见陷阱#5）
**排查**：
1. 单元测试mock了依赖但运行时真实依赖出错
2. 必须npm run restart + 真实API调用验证

### 6.5 循环依赖报错
**根因**：拆分时未检查双向require（见陷阱#3）
**排查**：
```bash
# 检查A是否require B，B是否require A
grep -rn "require.*<moduleA>" server/services/<moduleB>/
grep -rn "require.*<moduleB>" server/services/<moduleA>/
```
**修复**：使用函数级懒加载（require在函数内部）

### 7.6 约束词失效（有约束但内容仍违规）
**根因**：约束词只在prompt里"写"了，但hardBlockChecks不检测该约束的执行情况（陷阱#42）
**排查**：
1. 确认约束词在哪个模块定义（constraintModuleExtrasRedlines.js / constraintModuleExtrasCraft.js）
2. 确认约束词是否通过agentSlotRegistry.js注入到agent prompt
3. 检查hardBlockChecks.js的_runHardBlockChecks是否检测该约束 → **关键：约束词≠自动检测**
4. 检查reviewOverride.js是否把该类问题override通过
5. 检查contentUtils.js是否有对应的检测函数
**修复路径**：
- 约束词 → hardBlockChecks新增检测 → reviewOverride收紧override条件
- 禁止只加约束词不加检测（陷阱#42）
**示例**：anti-ai-trace约束禁止"仿佛/似乎"，但hardBlockChecks不统计AI高频词，导致约束失效

### 6.7 审核放行（审核发现问题但被override通过）
**根因**：reviewOverride.js的override逻辑过宽（陷阱#43）
**排查**：
1. 查看章节的firstReviewOutput/secondReviewOutput（GET /api/chapters?projectId=xxx）
2. 搜索"系统覆盖通过"关键词，确认是否被override
3. 检查reviewOverride.js的shouldOverrideReviewRejection逻辑：
   - 视角误判override（第75-84行）：原文有"仿佛/似乎"就override → 过宽
   - 字数override（第87-99行）：系统字数达标就override → 合理
   - 方言/风格/幽默override（第104-137行）：题材匹配就override → 需个案评估
4. 检查feedback._hardBlock是否被正确设置
**修复路径**：
- 收紧override条件：增加nonPovCriticalIssues的severity判断
- 把major/high级问题从suggestion升级为block条件
- override必须记录详细原因，便于追溯

### 7.8 章节衔接断裂（前一章结尾与本章开头不连贯）
**根因**：intent-planner的上下文传递缺陷（陷阱#41）
**排查**：
1. 读取前一章的content结尾200字
2. 读取本章的content开头200字
3. 人工判断是否连贯（是否有跳跃/重复/矛盾）
4. 检查intentPromptBuilder.js的buildMustKeepItems是否包含前一章结尾摘要
5. 检查firstReview是否检测章节衔接
**修复路径**：
- intent-planner的prevChapterSummary必须来自前一章的实际content结尾，而非大纲
- hardBlockChecks新增章节衔接检测（陷阱#44）
- firstReview的审核范围必须包含与前一章的连贯性检查

---

## 七、修复记录模板

```
## [日期] Bug描述
- 症状: xxx
- 根因: xxx（引用陷阱#N）
- 影响: xxx
- 修复: xxx
- 验证: ✅（具体验证步骤）
- 陷阱追加: #N xxx（如有新陷阱）
```

### [2026-06-27] 35个单元测试失败（4类根因）
- 症状: 全量测试132套件中35个测试失败
- 根因1: 术语"次位面"→"小世界"在源码已变更但测试数据未同步（5个文件）
- 根因2: NOVEL_DEFAULTS.targetMinWords从2200→2400但测试断言未同步（systemConfig.test.js 3处）
- 根因3: apiContractExtractor.test.js路由正则`/^\/api/`过严，worldscope路由用`/worldscope`直接挂载不在/api下
- 根因4: worldConstants.validateWorld新增type字段必填校验但测试数据world对象无type字段（worldScopeModule.test.js）
- 根因5: templateEntityAssocHelpers调用timelineAdapter.saveTimelineEvent(projectId, ev)但测试未mock且timelines数据无projectId
- 影响: tests/unit下10个文件
- 修复:
  1. 5个文件批量替换"次位面"→"小世界"（volumeHelpersFull/Branch/outlineRhythmMatchers/Branch/materialInjector）
  2. systemConfig.test.js 3处2200→2400
  3. apiContractExtractor.test.js路由正则放宽为`/^\//`
  4. worldScopeModule.test.js测试数据2处world对象添加type字段（main/sub）
  5. templateEntityAssocHelpers.test.js + Branch版本：添加timelineAdapter mock + 所有timelines数据添加projectId字段，Branch版本断言从`expect(mockSetItem).toHaveBeenCalled()`改为`expect(timelines[0].characterIds).toContain('c1')`直接验证结果
- 验证: ✅（132套件/2021测试全通过，0失败）
- 陷阱追加: 无（均为现有陷阱#6"改A文件时B文件也受影响"的具体案例）

### [2026-06-27] 跨世界溯源表未注册级联删除导致孤儿数据
- 症状: world-factions和cross-world-traces两张表在项目删除时数据不会被清理
- 根因: 创建cross_world_traces和world-factions表时只注册了DEDICATED_TABLES+专用写入handler（陷阱#31已修），遗漏了在dataStoreRegistry.js中标记`cascadable: true`，导致projectDeleteHandler.js的getCascadableStoreTypes()不返回这两个类型（陷阱#32新增）
- 影响: 项目删除后这两张表数据成为孤儿，长期积累污染数据库
- 修复: 在dataStoreRegistry.js新增3条注册：
  ```js
  'world-scopes':          { dedicated: false, syncable: false, cascadable: true, hasProjectId: true, aliases: [] },
  'world-factions':        { dedicated: false, syncable: false, cascadable: true, hasProjectId: true, aliases: [] },
  'cross-world-traces':    { dedicated: false, syncable: false, cascadable: true, hasProjectId: true, aliases: [] },
  ```
- 验证: ✅（getCascadableStoreTypes()返回67类型，3个新表全部包含）
- 陷阱追加: #32 新增PG表必须同步注册cascadable:true，否则项目删除时数据成为孤儿

### [2026-06-27] backfill空timestamp导致character_state_cache回填失败
- 症状: 服务器启动时`[WARN] [backfill] character_state_cache backfill failed: 无效的类型 timestamp with time zone 输入语法: ""`
- 根因: 三重缺陷叠加
  - (1) PG schema: `character_state_cache.computedAt TIMESTAMPTZ DEFAULT NOW()`（pgSchemaEntityBase.js:55）
  - (2) fieldRegistry: `computedAt: { type: 'text', extractorDefault: '' }`（fieldRegistryEntity.js:125）— 类型声明与PG不一致，extractorDefault为空字符串
  - (3) backfillColumns.js: 空字符串被过滤但entity_state_history.computedAt也有同样问题，且fieldRegistryRelation.js的extractorDefault也是''
- 修复: 双保险方案
  - (1) backfillColumns.js: 对timestamptz列增加空值+日期有效性校验，无效值跳过
  - (2) fieldRegistry.js: timestamp transform对空字符串/无效日期返回NOW()而非原值
  - (3) fieldRegistryEntity.js + fieldRegistryRelation.js: 修正computedAt类型为timestamptz，extractorDefault改为null
- 影响文件: backfillColumns.js, fieldRegistry.js, fieldRegistryEntity.js, fieldRegistryRelation.js
- 验证: ✅（backfill从WARN变INFO，`character_state_cache: backfilled 3 rows`成功）
- 陷阱追加: #33 fieldRegistry与PG schema类型不一致导致backfill报错

### [2026-06-27] health端点并发触发Windows栈溢出
- 症状: 并发请求/api/health时服务器进程崩溃，退出码3221226505(0xC00000FD STATUS_STACK_OVERFLOW)
- 根因: health.js的17个checkDb用Promise.all并行执行，每个checkDb发起PG查询并解析结果，Windows环境下高并发触发栈溢出（Linux下无此问题）
- 修复: 改为分批chunk执行，每批5个Promise.all，批与批之间串行await
  ```js
  const CHUNK_SIZE = 5;
  for (let i = 0; i < checkEntries.length; i += CHUNK_SIZE) {
      const chunk = checkEntries.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(([, fn]) => fn()));
  }
  ```
- 影响文件: server/routes/health.js
- 验证: ✅（3并发health请求全200无崩溃，4串行端点全200）
- 陷阱追加: #34 Windows下高并发Promise.all触发栈溢出

---

## 何时更新本文件

- 每次bug修复 → 追加修复记录到第八节
- 发现新的常见bug排查路径 → 追加到第七节
- 验证清单有新项 → 追加到第四节
- 发现新陷阱 → 追加到 [00-陷阱清单.md](00-陷阱清单.md) 对应类别

**更新后必读**：[MAINTENANCE.md](../MAINTENANCE.md) 确认是否还需更新其他文档。
