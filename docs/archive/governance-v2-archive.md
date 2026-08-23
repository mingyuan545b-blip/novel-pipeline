# 项目治理手册 v2.0

> 本文档供任何AI接手本项目时使用，包含项目约束、质量门禁、已知陷阱和执行协议。
> **接手AI必须先完整阅读本文档，再开始任何代码修改。违反硬约束即中断执行。**

---

## 一、项目身份

- **项目名**: novel-pipeline（小说生产线）
- **技术栈**: Node.js后端 + React前端 + PostgreSQL/SQLite/JSON三后端
- **LLM**: 阿里云Coding Plan（qwen3.6-plus）
- **核心功能**: 从大纲到成稿的全自动小说生成Pipeline
- **端口**: 后端3001 / 前端5173
- **三后端降级**: PostgreSQL(USE_PG=true) → SQLite(USE_SQLITE=true) → JSON文件(默认)

---

## 二、硬约束（违反即中断执行）

### 2.1 代码规范
- 单文件≤200行，超过必须拆分
- 单组件≤5个useState，超过必须提取自定义hook
- 禁止内联style，使用CSS模块
- 禁止硬编码：魔法数字、URL、超时、项目ID、端口
- 所有配置值必须来自systemConfig.js或环境变量
- 新增配置项必须同步到systemConfig.js的LLM_DEFAULTS

### 2.2 架构规范
- 配置单一入口：systemConfig.js → genreDefaults.js → genreRegistry.js
- **题材检测统一入口：resolveGenreFromProject(project)**，禁止直接调用detectGenre(project?.styleProfile)
- 错误分类统一入口：shared/errors.js（isLLMOverloaded/isLLMTimeout等）
- 角色实体唯一创建入口：entityCenter.getOrCreateEntity
- 统一调度：constraintInjector + styleInjector，禁止独立注入
- 所有Agent prompt组装必须走统一agent prompt assembly system
- 路由拆分：按功能域拆分子路由，主路由仅做组装入口
- 异步任务：统一使用asyncTaskManager，禁止独立创建tasks Map
- Pipeline三层防线：输入契约(pipelineContract) + 输出契约(pipelineOutputContract) + 污染检测(pipelinePollutionGuard)
- 契约错误码：pipelineErrors.js中定义，格式[步骤前缀]-[序号]（如W-001/P-001）
- 数据流规范：dataFlowSpec.js中声明每个agent的PUSH/PULL数据来源和上下游关系
- 契约阈值：所有校验阈值必须来自systemConfig.js的PIPELINE_CONTRACT常量

### 2.3 执行规范
- 禁止使用PowerShell
- 禁止创建子Agent/子任务
- async函数调用必须加await
- 改代码前必须先读代码
- 改完必须跑测试
- 每次改代码后必须运行 `node scripts/audit-hardcode.js`
- 同类bug必须全量grep修复，禁止只修部分文件

### 2.4 数据规范
- 所有数据由系统自动生成，禁止手动写入
- 数据变更必须同步上下游
- 项目删除必须级联删除所有关联数据（20张表）
- 章节状态统一使用chapterStatus.js定义的常量
- 素材管理失败不应标记为完成，应该重试或暂停

---

## 三、已知陷阱清单（必须逐项检查）

| # | 陷阱 | 对策 |
|---|------|------|
| 1 | 拆分时忘记更新require路径 | 必须grep验证所有引用 |
| 2 | 拆分后导出接口变化但调用方没更新 | 必须对比module.exports |
| 3 | 循环依赖 | 拆分后必须检查双向require |
| 4 | 拆分时引入新硬编码 | 每个新文件必须扫描 |
| 5 | 测试通过但运行时出错 | 必须启动验证 |
| 6 | 改A文件时B文件也受影响 | 必须grep依赖关系 |
| 7 | 自己加的新代码又制造硬编码 | 写完立刻运行audit-hardcode.js |
| 8 | 思考模型默认开启思考模式 | 新模型必须检查enable_thinking默认值 |
| 9 | 认证空值时随机生成secret | 空值=关闭认证，不生成 |
| 10 | 同类bug只修部分文件 | 必须全量grep同类模式 |
| 11 | qwen3.6-plus是思考模型 | llm.js默认enable_thinking=false |
| 12 | Coding Plan有5小时TPM限额 | TPM限流器已集成到rateLimiter.js |
| 13 | genre ID可能是对象不是字符串 | 必须toString()再使用 |
| 14 | _findFactByText全表查询导致OOM | 使用Set预加载去重 |
| 15 | styleInjector循环依赖 | 使用函数级懒加载 |
| 16 | skipUntil/冷却时间硬编码 | 必须使用LLM_DEFAULTS常量 |
| 17 | 甜宠题材生成霸总偏移 | constraintInjector必须含HARD BLOCK |
| 18 | API限流错误不应计入重试次数 | 应等待后重试，用errors.js分类函数 |
| 19 | re-export文件自引用 | require('./X')会解析到自身而非X/index.js，必须用require('./X/index') |
| 20 | 角色名/职业偏移不是"自由创作" | 偏移就是Bug，必须追查根因（素材未传入？nameLock失效？） |
| 21 | 契约检查不能写空壳 | check直接return true的空壳检查必须删除或实现 |
| 22 | 契约阈值不能硬编码 | 必须引用systemConfig.js的PIPELINE_CONTRACT常量 |
| 23 | genre=null是裸奔不是降级 | 所有Pipeline代码必须用resolveGenreFromProject(project)，禁止detectGenre(project?.styleProfile) |
| 24 | 前后端数据格式断裂 | saveProjectFromTemplate保存styleProfile:{genre:"甜宠匠心"}，但detectGenre只查key字段。resolveGenreFromProject三级fallback：subGenre→styleProfile→genre |
| 25 | 字段名大小写不一致 | 旧项目用subgenre(小写)，代码用subGenre(驼峰)，resolveGenreFromProject兼容两种 |
| 26 | require.cache删除破坏单例 | apiSelfCheck.js的checkServiceExports禁止delete require.cache，会导致pipelineModuleRegistry被重新加载创建空实例，startup.js注册的模块钩子丢失，onPostApproval等钩子永远不执行。有状态模块的单例必须保护 |
| 27 | power-system素材无definition生成路径 | syncToRegistries和createEquipmentBinds只处理equipment类型，power-system/technique/cultivation-method素材永远不会生成item-definition。新增素材类型必须同步更新DEFINITION_TYPES和BINDABLE_TYPES映射 |
| 28 | 定稿人markdown审核意见被误判为小说正文 | parseFallbackApproval的isNovelContent判断：text.length>500且前50字符无{就判定为小说正文。但定稿人返回的markdown审核意见（# 定稿意见\n**判定结果**）也满足此条件，导致approved=false，onPostApproval不触发。必须检查hasReviewMarker（定稿/审核/判定/意见/json代码块）排除审核意见 |
| 29 | 编年史粒度未分级导致数据膨胀 | 普通小说用full级别会记录所有角色语录+事迹，数据量大且无价值。改为4级(off/minimal/basic/full)，minimal只记主角+核心反派立场，普通小说用minimal即可 |
| 30 | 世界域数据结构单薄无法表达多元世界 | 原World对象只有id/name/color/isDefault，无法表达主世界+多小世界+各自独立武力体系/文化/科技/势力。改造方案：(1)worldConstants.js定义8种武力体系(cultivation/immortal/tech/magic/ancient-ritual/martial/psionic/faith)+5种科技水平+5种危险等级+6种世界类型(main/sub/pocket/mirror/secret/dream)；(2)World对象扩展powerSystem(数组多选)/culture/techLevel/rules/dangerLevel/entryMethod/description字段；(3)武力体系多选支持混合世界(如修仙+科技)；(4)势力独立存world-factions表绑定worldId，不跨世界；(5)extractAndSave新增type=world-info记录存储世界属性；(6)前端WorldScopeTab解析factionsByWorld+新增FactionsPanel组件按世界分组渲染势力；(7)buildWorld()工厂函数+validateWorld()校验保证数据一致性。任何新增世界属性必须同步更新前后端worldConstants.js |
| 31 | 新增PG专用表未注册写入handler导致读写表不一致 | 新增DEDICATED_TABLES表(如world_scopes/world_factions/cross_world_traces)后，store-pg-writer.js的_writeItemUnlocked查handlers[table]，无专用handler则走_writeKvStore写入kv_store表。但getItem/queryItems走getTableForType返回专用表名，导致写入kv_store、读取专用表，POST返回200但GET返回404。对策：每新增DEDICATED_TABLES表必须同步：(1)在store-pg-writer-*.js创建专用handler含INSERT/UPDATE SQL；(2)extract函数提取索引字段+data字段存完整JSON；(3)合并到handlers对象；(4)验证脚本测POST+GET单条确保读写表一致 |

---

## 四、质量门禁

### 4.1 代码改造前（PRE-CHECK）
```
[PRE-CHECK] 文件: xxx.js (当前xxx行)
1. 改造目标: 拆分为N个文件，每个≤200行
2. 依赖关系: 谁引用了这个文件？(grep验证)
3. 导出接口: 当前导出哪些函数/常量？(grep验证)
4. 风险评估: 改这个文件可能影响哪些功能？
5. 回滚方案: 如果出问题怎么恢复？
```

### 4.2 代码改造中（IN-PROCESS）
- 每写完一个文件检查行数（≤200）
- 每写完一个文件扫描硬编码
- 拆分后验证导出完整性
- 拆分后验证引用完整性

### 4.3 代码改造后（POST-CHECK）
- 单元测试: `npx jest --testPathPattern="相关测试" --no-coverage --forceExit`
- 全量测试: `npx jest --testPathPattern="tests/unit" --no-coverage --forceExit`
- 硬编码审计: `node scripts/audit-hardcode.js`
- 启动验证: 服务器能正常启动
- API验证: /api/health返回200

---

## 五、关键文件地图

### 5.1 配置层
- `server/config/systemConfig.js` — 系统常量唯一来源（LLM_DEFAULTS/PIPELINE/AGENT_DEFAULTS等）
- `server/config/genreDefaults.js` — 题材默认配置
- `server/config/genreRegistry.js` — 题材注册表（聚合genres/*.js）
- `server/config/providerRegistry.js` — LLM供应商注册表
- `server/config/configManifest.js` — 配置项元数据唯一注册表
- `server/services/genreConfig.js` — 题材检测统一入口（resolveGenreFromProject/detectGenre/getGenreById等）

### 5.2 错误处理层
- `server/shared/errors.js` — 统一错误分类（OVERLOAD_PATTERNS/TIMEOUT_PATTERNS等）
- `server/core/pipeline/errorRecovery.js` — Pipeline错误恢复
- `server/services/pipeline/infinitePipeline.js` — 无限Pipeline主循环

### 5.3 数据层
- `server/store.js` — 统一存储入口
- `server/db/store-pg.js` — PostgreSQL后端
- `server/db/jsonStore.js` — JSON文件后端
- `server/services/dataContext.js` — 数据上下文（替代直接store调用）

### 5.4 实体层
- `server/services/entityCenter.js` — 实体唯一创建/查询入口
- `server/services/knowledgeBase/` — 知识库模块（factSync/index/manager）

### 5.5 Pipeline层
- `server/core/pipeline/orchestrator.js` — 编排器
- `server/services/pipeline/infinitePipeline.js` — 无限Pipeline
- `server/services/pipeline/infinite/chapterExecutor.js` — 章节执行器
- `server/services/pipeline/relationshipStageGuard.js` — 关系阶段守卫（25章关系映射，注入writer/reviser prompt最前面）
- `server/services/pipeline/steps/` — 各Agent步骤
- `server/services/pipeline/pipelineContract.js` — 输入契约定义（12个agent的输入校验）
- `server/services/pipeline/pipelineOutputContract.js` — 输出契约定义（格式+内容合规）
- `server/services/pipeline/pipelinePollutionGuard.js` — 污染检测器（角色名/素材重复/设定偏移）
- `server/services/pipeline/pipelineErrors.js` — 契约错误码定义（40+错误码）
- `server/services/pipeline/pipelinePreflight.js` — 三层防线执行器（preflight/postflight/pollutionCheck）
- `server/services/pipeline/dataFlowSpec.js` — 数据流规范（PUSH/PULL/上下游关系）

### 5.6 路由层
- `server/routes/pipeline/index.js` — 路由组装入口
- `server/routes/pipeline/coreRoutes.js` — 核心Pipeline路由
- `server/routes/pipeline/infiniteRoutes.js` — 无限Pipeline路由
- `server/routes/pipeline/taskRoutes.js` — 任务查询路由
- `server/routes/pipeline/materialRoutes.js` — 素材管理路由
- `server/routes/pipeline/toolRoutes.js` — 工具路由
- `server/routes/pipeline/subplaneRoutes.js` — 次位面路由
- `server/routes/pipeline/templateRoutes.js` — 模板路由
- `server/routes/pipeline/asyncTaskManager.js` — 异步任务管理器

---

## 六、当前技术债务

### P0: 800+行文件（全部完成拆分）
| 文件 | 原行数 | 拆分后 | 状态 |
|------|--------|--------|------|
| services/pipeline/infinitePipeline.js | 1035 | 11个子文件(infinite/) | ✅已完成 |
| services/publishers/qimaoPublisher.js | 1191 | 8个子文件(publishers/) | ✅已完成 |
| services/pipeline/steps/materialUpdateProcessor.js | 899 | 4个子文件(materialFieldUtils/materialUpdateHelpers/materialActions) | ✅已完成 |
| routes/knowledge.js | 892 | 8个子文件(knowledge/) | ✅已完成 |
| services/contentUtils.js | 935 | 5个子文件(contentCleaners/contentDetectors/contentMetadataDetector/contentMetrics) | ✅已完成 |
| services/memory.js | 887 | 6个子文件(memory/) | ✅已完成 |
| services/comfyuiWorkflow.js | 946 | 6个子文件(comfyui/) | ✅已完成 |

### 已完成拆分
| 文件 | 原行数 | 拆分后 | 日期 |
|------|--------|--------|------|
| routes/pipeline.js | 1103 | 8个子文件(index/core/infinite/task/material/tool/subplane/template) | 2026-06 |
| services/pipeline/infinitePipeline.js | 1035 | 11个子文件(infinite/) | 2026-06 |
| services/publishers/qimaoPublisher.js | 1191 | 8个子文件(publishers/) | 2026-06 |
| services/pipeline/steps/materialUpdateProcessor.js | 899 | 4个子文件 | 2026-06 |
| routes/knowledge.js | 892 | 8个子文件(knowledge/) | 2026-06 |
| services/contentUtils.js | 935 | 5个子文件 | 2026-06 |
| services/memory.js | 887 | 6个子文件(memory/) | 2026-06 |
| services/comfyuiWorkflow.js | 946 | 6个子文件(comfyui/) | 2026-06 |

### P1: 500-800行文件（18个，应拆）
| 文件 | 行数 | 状态 |
|------|------|------|
| orchestrator.js | 751 | ✅已拆分(4子文件: orchestratorHelpers/orchestratorPreflight/orchestratorStepHandlers) |
| entityCenter.js | 692 | ✅已拆分(5子文件: entityCenter/) |
| store-pg.js | 704 | 跳过(底层DB，拆分收益低) |
| review.js | 573 | ✅已拆分(6子文件: review/) |
| writer.js | 546 | ✅已拆分(5子文件: writer/) |
| pipelineHelpers.js | 540 | ✅已拆分(4子文件: pipelineWordCount/pipelineReaderCheck/pipelinePostApproval) |
| characterStateCache.js | 534 | ✅已拆分(3子文件: characterStateFormatters/characterStateExtractor) |
| promptOptimizer.js | 528 | ✅已拆分(2子文件: promptOptimizerConstants) |
| hookBudget.js | 520 | ✅已拆分(3子文件: hookBudgetConstants/hookBudgetDetector) |
| templateImporter.js | 575 | ✅已拆分(4子文件: templateValidator/templateImporterCore/templateExporter) |
| genres/baby.js | 705 | 跳过(配置型，拆分破坏完整性) |
| genres/high-martial-crossplane.js | 660 | 跳过(配置型) |
| genres/infinite-dungeon.js | 791 | 跳过(配置型) |
| genres/tomato-sweet-artisan.js | 731 | 跳过(配置型) |
| genres/tomato-talisman.js | 641 | 跳过(配置型) |
| database-pg.js | 694 | 跳过(底层DB) |
| routes/franchises.js | 568 | 跳过(CRUD路由，拆分无意义) |
| materialRegistrar.js | 487 | 跳过(逻辑内聚，拆分收益低) |
| reviewRemediation.js | 477 | 跳过(逻辑内聚) |
| server/index.js | 475 | ✅已拆分(190行+4新路由文件:apiKeys/licenseRoutes/versionRoutes/authRoutes) |

### Legacy文件（5个已完成，1个保留）
| 文件 | 原行数 | 当前行数 | 状态 |
|------|--------|---------|------|
| `_pipelineLegacy.js` | 987 | 207 | ✅已拆分(5个step→handler) |
| `_chapterAuditorLegacy.js` | 1106 | 3 | ✅已拆分(6个子文件) |
| `_consistencyLegacy.js` | 756 | 3 | ✅已拆分(4个子文件) |
| `_projectsLegacy.js` | 776 | 3 | ✅已拆分(4个子文件) |
| `_agentPromptsLegacy.js` | 781 | 3 | ✅已清空(无引用) |
| `_multiPlatformPublisherLegacy.js` | 2318 | 3 | ✅已清空(re-export到publishers/index) |

### P2: 路由层拆分（server/index.js）
| 文件 | 原行数 | 拆分后 | 状态 |
|------|--------|--------|------|
| server/index.js | 475 | 190行 + routes/apiKeys.js + routes/licenseRoutes.js + routes/versionRoutes.js + routes/authRoutes.js | ✅已完成 |
| routes/genre-debug.js | 210 | 补充constraint-modules/constraints路由 | ✅已完成 |
| routes/health.js | 70 | 补充alerts/check路由 | ✅已完成 |

### P2: Legacy切换
| 文件 | 变更 | 状态 |
|------|------|------|
| multiPlatformPublisher.js | require('./_multiPlatformPublisherLegacy') → require('./publishers/index') | ✅已完成 |

### P2: 自引用Bug修复（re-export文件）
| 文件 | Bug | 修复 |
|------|-----|------|
| routes/knowledge.js | require('./knowledge')自引用 | require('./knowledge/index') |
| routes/pipeline.js | require('./pipeline')自引用 | require('./pipeline/index') |
| services/pipeline/infinitePipeline.js | require('./infinite')自引用 | require('./infinite/index') |

### ESLint集成
- 配置文件: `eslint.config.js`（ESLint 9 flat config格式）
- 规则: max-lines=200(warn), max-lines-per-function=80(warn)
- 豁免: index.js/路由文件/genres/db/scripts/tests
- 运行: `npm run lint`
- 基线: 92 warnings, 0 errors

---

## 七、AI监督机制（供接手AI执行）

### 7.1 每次修改前的强制自检
接手AI在修改任何代码前，必须输出以下内容：
```
[SELF-CHECK]
1. 我要改什么？→ 明确目标
2. 为什么改？→ 根因分析（不是表面现象）
3. 影响范围？→ grep依赖关系
4. 有没有硬编码？→ 检查新增代码
5. 有没有同类问题？→ 全量grep
6. 之前犯过类似错误吗？→ 查project_memory.md
```

### 7.2 每次修改后的强制验证
```
[POST-VERIFY]
1. 行数检查: 新文件≤200行？
2. 硬编码扫描: node scripts/audit-hardcode.js
3. 引用完整性: grep require路径
4. 测试: npx jest --testPathPattern="相关测试" --no-coverage --forceExit
5. 启动验证: 服务器能正常启动
```

### 7.3 禁止事项检查清单
每次提交代码前，逐项确认：
- [ ] 没有硬编码（魔法数字、URL、超时、端口、UUID）
- [ ] 没有使用PowerShell
- [ ] async函数调用都加了await
- [ ] 没有绕过统一调度（constraintInjector/styleInjector）
- [ ] 没有直接store.setItem创建实体（必须走entityCenter）
- [ ] 新增配置项已同步到systemConfig.js
- [ ] 同类问题已全量修复（不是只修一个文件）
- [ ] 文件行数≤200

### 7.4 常见错误模式检测
接手AI应主动检测以下模式：
```
# 硬编码超时
grep -rn "setTimeout.*[0-9]{4,}" server/
grep -rn "skipUntil.*Date.now.*+[0-9]" server/

# 硬编码URL
grep -rn "http://\|https://" server/ --include="*.js" | grep -v "node_modules\|config\|\.env"

# 缺少await
grep -rn "getVolumeOrder\|getOrCreateEntity\|cleanupInvalidHooks" server/ | grep -v "await"

# 绕过统一调度
grep -rn "buildGenreOutlineInjection\|buildGenreConstraints\|GENRE_HARD_BLOCKS" server/

# 绕过resolveGenreFromProject（genre=null裸奔根因）
grep -rn "detectGenre(project\?\.styleProfile" server/
```

---

## 八、改造记录模板

每次改造必须记录：
```
## [日期] 文件名 改造记录
- 改造前: xxx行
- 改造后: N个文件，行数分别为xxx/xxx/xxx
- PRE-CHECK: ✅/❌
- IN-PROCESS: ✅/❌
- POST-CHECK: ✅/❌
- 遗留问题: 无/xxx
- 教训: xxx
```

---

## 九、接手AI检查清单

新AI接手时必须完成以下检查：

- [ ] 阅读本文档全文
- [ ] 阅读 project_memory.md
- [ ] 运行 `node scripts/audit-hardcode.js` 了解当前状态
- [ ] 运行 `npx jest --testPathPattern="tests/unit" --no-coverage --forceExit` 确认测试基线
- [ ] 确认 `.env` 中 API Key 存在且有效
- [ ] 确认 `REQUEST_SECRET=` 为空（认证已关闭）
- [ ] 确认 `llm.js` 中 `enable_thinking: options.enableThinking === true`（默认关闭思考模式）
- [ ] 确认 `systemConfig.js` 中 LLM_DEFAULTS 包含所有冷却时间常量
- [ ] 确认 `errors.js` 中定义了统一错误分类函数
- [ ] 确认 `providerRegistry.js` 中 aliyunCoding 配置了 tpmLimit
- [ ] 确认 `rateLimiter.js` 中包含 TokenBucketLimiter 类
- [ ] 确认 `configManifest.js` 是配置项元数据唯一注册表
- [ ] 确认路由层已拆分到 `routes/pipeline/` 子目录
- [ ] 确认 `pipelineContract.js` 覆盖所有12个agent的输入契约
- [ ] 确认 `pipelineOutputContract.js` 覆盖所有agent的输出契约
- [ ] 确认 `pipelinePollutionGuard.js` 能检测角色名污染/素材重复/设定偏移
- [ ] 确认 `pipelineErrors.js` 错误码覆盖输入/输出/污染三大类
- [ ] 确认 `systemConfig.js` 中 PIPELINE_CONTRACT 包含所有契约阈值
- [ ] 确认 `dataFlowSpec.js` 声明了每个agent的PUSH/PULL数据来源
- [ ] 确认 `resolveGenreFromProject` 是题材检测唯一入口（grep验证无detectGenre(project?.styleProfile)模式）
- [ ] 确认 `relationshipStageGuard.js` 使用resolveGenreFromProject获取genreId

---

## 十、项目创建规范

### 10.1 创建项目必填字段

| 字段 | 必填 | 校验 | 说明 |
|------|------|------|------|
| name | 是 | 1-200字 | 项目名称 |
| genre | 是 | 1-100字 | 题材标识（Pipeline全部依赖genre加载配置） |
| mode | 否 | 默认novel | 项目模式（统一长篇模式） |
| description | 否 | ≤10000字 | 项目描述 |
| subGenre | 否 | ≤100字 | 子题材 |
| styleProfile | 否 | object | 风格配置（namingStyle/worldviewTemplate/systemPersona等） |
| wordConfig | 否 | object | 字数配置（targetWords/rejectMin等，由题材配置自动填充） |
| constraints | 否 | array | 写作约束ID列表 |
| targetChapters | 否 | 默认100 | 目标章节数 |
| styleTemplateId | 否 | string | 风格模板ID |

### 10.2 项目创建后自动初始化

创建项目后，模板生成流程会自动：
1. 从genre解析题材配置（genreRegistry.js → genres/*.js）
2. 生成初始素材（outlineGenerator → materials表）
3. 同步知识库（outlineGenerator → knowledge-facts表）
4. 创建实体注册（entityCenter → entity-registry表）
5. 生成章节大纲（outlineGenerator → chapters表）
6. 构建记忆层（memoryLayerBuilder → memory-layers表）

### 10.3 级联删除清单（28个store类型）

删除项目时必须级联删除以下所有数据：
```
chapters, reviews, materials,
entity-registry, item-definitions, character-binds, character-relations,
pet-entities, servant-entities,
character-states, character-state-cache, state-kv-index, state-meta,
knowledge-facts, memory-layers,
foreshadow_ledger, consistency-reports, consistency_checks, state-snapshots,
timelines, timeline, quests, constraint-presets,
entities, entity_state_history, entity_binds, entity_relations,
craft_materials, narrative_state,
pipeline_logs, infinite_pipeline_state
```

---

## 十一、数据库Schema映射

### 11.1 运行时Schema（当前使用）

当前系统使用**kv_store通用表**存储大部分数据，PG专有列仅用于索引优化。

| kv_store.type | PG专有列 | 实际存储方式 |
|---------------|---------|-------------|
| projects | projects表(id,mode,data) | data字段存JSON |
| chapters | chapters表(id,projectId,chapterNumber,status,data) | data字段存JSON |
| materials | materials表(id,projectId,type,name,data) | data字段存JSON |
| entity-registry | entity_registry表(id,projectId,entityType,name,roleLevel) | data字段存JSON |
| knowledge-facts | knowledge_facts表(id,projectId,level,category) | data字段存JSON |
| memory-layers | kv_store(type='memory-layers') | 纯kv_store |
| character-states | character_states表(id,projectId,characterId,chapterNumber) | data字段存JSON |
| state-kv-index | state_kv_index表(id,projectId,scope,entityKey) | data字段存JSON |
| foreshadow_ledger | foreshadow_ledger表(id,projectId,name,status) | data字段存JSON |
| narrative_state | narrative_state表(id,projectId,chapterNumber) | data字段存JSON |

### 11.2 新Schema设计稿（knowledgeSchema.js，未启用）

knowledgeSchema.js定义了10张新表，是v2架构设计稿：
- `entities` — 替代 materials(实体部分) + entity_registry + character_state_cache
- `entity_state_history` — 替代 character_states + character_state_cache(per-chapter)
- `entity_relations` — 替代 character_relations（扩展到所有实体类型）
- `entity_binds` — 替代 character_binds（扩展到所有实体类型）
- `craft_materials` — 替代 materials(非实体部分)
- `knowledge_facts` — ✅已启用
- `narrative_state` — ✅已启用
- `consistency_checks` — ✅已启用
- `foreshadow_ledger` — ✅已启用
- `timeline` — 替代 timelines（新表名）

**注意：新Schema未启用，代码全部基于kv_store + 旧表运行。迁移需重写所有数据访问层。**
