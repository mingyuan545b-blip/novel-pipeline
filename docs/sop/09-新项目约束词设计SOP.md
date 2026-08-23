# 新项目约束词与数据深度设计SOP

> **触发条件**：新建项目/更换题材/新增约束词/约束词体系变更/数据深度配置变更
> **核心目标**：四阶段闭环，杜绝低俗题材再入库；约束词、素材标准、数据库字段、数据深度、铁律五对齐后再开写
> **执行引擎**：铁律内嵌为阶段门禁，`scripts/audit-iron-law.js`自动检测违反信号
> **前置**：已读 [00-陷阱清单.md](00-陷阱清单.md)、[08-约束执行规范.md](08-约束执行规范.md)

---

## 〇、铁律执行引擎（底层机制）

### 0.1 铁律优先级

```
P0 安全（不破坏现有功能/不丢数据/不泄露敏感信息）
  > P1 质量（代码质量底线/工作流程必备）
    > P2 平衡（根据具体场景判断，不死板执行）
```

### 0.2 铁律清单

| 编号 | 铁律 | 优先级 | 违反信号 | 检测方式 |
|------|------|--------|---------|---------|
| P0-1 | 禁止破坏现有功能 | P0 | 修改后测试失败 | jest全量测试 |
| P0-2 | 禁止丢失生产数据 | P0 | DELETE无WHERE/删除无备份 | git diff扫描 |
| P0-3 | 禁止提交未验证代码 | P0 | 修改后无jest运行记录 | 工具调用记录 |
| P0-4 | 禁止硬编码敏感信息 | P0 | 代码含'sk-'、'password=' | git diff扫描 |
| P1-Q1 | 禁止硬编码业务值 | P1 | 代码含'material-updated'/'approved'字面量 | git diff扫描 |
| P1-Q2 | 禁止改旧bug加新bug | P1 | 修改文件数>问题相关范围 | 修改清单审查 |
| P1-Q3 | 禁止屎山代码 | P1 | 单文件>200行 | ESLint max-lines |
| P1-Q4 | 禁止async调用缺await | P1 | async函数返回Promise被当对象用 | 静态扫描+pipeline运行 |
| P1-Q5 | 禁止敏感词无词边界匹配 | P1 | "大麻"误命中"大麻烦" | 敏感词扫描器单测 |
| P1-Q6 | 禁止访问不存在的对象字段 | P1 | validation.errors.join但errors未定义 | 静态扫描 |
| P1-Q7 | 禁止僵尸功能 | P1 | 函数定义了但无调用方 | grep全仓库调用链 |
| P1-F1 | 修改前必读代码 | P1 | 修改前无Read工具调用 | 工具调用记录 |
| P1-F2 | 修复前必查同类模式 | P1 | 修复前无Grep工具调用 | 工具调用记录 |
| P1-F3 | 修复后必跑测试 | P1 | 修改后无jest运行记录 | 工具调用记录 |
| P1-F4 | 教训必持久化 | P1 | 犯错后project_memory.md无更新 | 文件修改时间 |
| P2-C1 | 禁止不查证就建议 | P2 | 建议前无Read工具调用 | 工具调用记录 |
| P2-B1 | 禁止PowerShell语法 | P2 | 命令含`\| tail`/`$1`/`2>&1` | RunCommand记录 |

### 0.3 铁律违反检测机制

**外部检测脚本**：`scripts/audit-iron-law.js`

| 时机 | 命令 | 检测项 |
|------|------|--------|
| 会话开始 | `node scripts/audit-iron-law.js --session-start` | 环境+配置就绪 |
| 交付前 | `node scripts/audit-iron-law.js --pre-deliver` | git diff+工具调用记录 |
| git commit | pre-commit hook自动触发 | git diff扫描硬编码+PS语法 |

### 0.4 铁律冲突仲裁

| 冲突场景 | 仲裁原则 |
|---|---|
| 禁止硬编码 vs 修bug改状态值 | 修bug优先，但必须grep分布+记录TODO |
| 小切口 vs 全链路 | 看问题性质：单点逻辑bug小切口；链路传递bug必须全链路扫 |
| 禁止反复犯错 vs 上下文限制 | 靠持久化教训+强制查证弥补 |
| 先分析 vs 高效执行 | 读3处代码的成本 < 修错3次的成本 |

---

## 一、第一阶段：题材市场评估

**目标**：选题材之前先证明它有市场，防止低俗烂大街套路再入库。

### 1.1 执行步骤

1. **题材市场五问**：对候选题材逐项回答（目标读者/核心卖点/元素组合/创新点/生命周期）
2. **题材质量门禁**：任意一条不达标直接淘汰
3. **题材白名单校验**：跑`node scripts/audit-genre-whitelist.js`

### 1.2 验收标准

- 题材市场评估表（五项全过）
- `audit-genre-whitelist.js`通过
- 标题无套路词（影后/重生/马甲/战神/赘婿/归来/逆袭/打脸）

---

## 二、第二阶段：系统能力盘点

**目标**：设计项目前先确认系统的实体中心、知识库、主线任务、数据深度模块能否支撑该题材。**特别警惕"定义了但未被调用"的僵尸功能**。

### 2.1 执行步骤

1. **实体中心能力盘点**：检查角色/世界观/势力/道具/功法体系字段
2. **知识库能力盘点**：检查主线任务/伏笔系统/时间线/关系网
3. **约束词库盘点**：检查题材必选约束词+互斥约束词
4. **数据深度能力盘点**：检查世界观三维分类+角色深度三指标
5. **僵尸功能扫描**：grep所有`auto*`/`init*`/`ensure*`函数，确认调用链完整
6. **世界观分支能力盘点**（新增）：检查题材是否支持分支+分支配置完整性
7. **4类素材生成链路盘点**（新增）：检查material-organizer/registrar/knowledgeExtraction调用链

### 2.2 主线任务模块位置（必查）

| 模块 | 前端入口 | 后端路由 | 数据表 |
|------|---------|---------|--------|
| 主线任务 | `/materials` → "⚔ 主线任务" Tab | `/api/quests/quests` | `quests` |
| 伏笔系统 | `/knowledge` → ForeshadowPanel | `/api/knowledge/foreshadow-guard` | `materials`(type=foreshadowing) |
| 时间线 | `/knowledge` 页面 | `/api/timelines` | `timelines` |
| 角色状态 | `/entities` → 角色卡 | `/api/entities` | `entities` + `entity_state_history` |

### 2.3 项目初始化遗漏功能必查清单【硬门禁】

**背景**：陷阱#58发现`autoInitProject`僵尸功能导致新项目主线任务空数据。

**检查方法**：Read [initializeRoutes.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/routes/projects/initializeRoutes.js)，确认 `handleInitialize` 调用：

| 必调用函数 | 文件位置 | 创建的数据 | 漏调用后果 |
|-----------|---------|-----------|-----------|
| `createProjectData(req)` | projectCreateHandler.js | 项目元数据（含branchKey） | 项目不存在 |
| `pipeline.generateInitialMaterials` | services/pipeline | 素材 | 无素材 |
| `pipeline.generateChapterOutlines` | services/pipeline | 章节大纲 | 无大纲 |
| `autoInitProject(projectId)` | routes/questAutoInit.js | 长期主线+阶段任务+支线+时间线 | **主线任务空数据** |

**检查脚本**：`grep -n "autoInit" server/routes/projects/initializeRoutes.js`

### 2.4 世界观分支能力盘点【新增·硬门禁】

**背景**：陷阱#71发现题材配置与项目题材精神分裂，新增分支机制支持同一题材下多世界观变体切换。

**分支机制架构**（[branches/](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/genres/high-martial-crossplane/branches/)）：

| 层 | 文件 | 职责 |
|---|---|---|
| 通用层 | foundation.js/styleProfile.js/detectors.js | 跨分支通用约束（已去不搭元素） |
| 分支层 | branches/branchProgrammatic\|Layered\|Metaverse.js | 三个完整世界观配置包 |
| 组装层 | branches/index.js + genreConfig.js | applyBranch注入+project.branchKey读取 |

**high-martial-comedy题材支持的分支**：

| 分支key | 标签 | 世界本质 | 战力替代 | 环境替代 | 导师替代 |
|---------|------|---------|---------|---------|---------|
| programmatic | 程序化模拟世界 | 万界是运行中程序，天道是OS | 权限等级(访客→root→管理员) | 测试服/沙盒 | 注释幽灵 |
| layered | 多层现实嵌套 | 层层嵌套现实，有接缝错位 | 层理解深度(表层→归零者) | 相邻层 | 跨层观察者 |
| metaverse | 游戏化元宇宙 | 元宇宙结构，有面板副本 | 等级+装备(荒诞化) | 副本/活动关卡 | NPC管理员 |

**检查方法**（7项硬门禁，陷阱#71+#73系统性合并）：
1. **题材是否支持分支**：`genreConfig.getGenreById(genreId).supportedBranchKeys` 返回非空数组
2. **分支配置完整性**：每个分支必须含 worldviewCore/powerSystem/planeConcept/mentorConcept/namingStyle/toneStyle/extraConstraints/extraFoundationRules/styleProfileOverrides/genreBaseOverrides/detectorConfig/moduleOverrides
3. **createProjectData是否处理branchKey**：Read [projectCreateHandler.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/routes/projects/projectCreateHandler.js) 第107-115行
4. **resolveGenreFromProject是否注入分支**：Read [genreConfig.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/genreConfig.js) 的resolveGenreFromProject函数
5. **新建项目时branchKey必传**：POST /api/projects/initialize 的body必须含`branchKey`字段
6. **分支styleProfileOverrides字段完整性【陷阱#73硬门禁】**：每个分支的styleProfileOverrides必须含 `key/systemPersona/namingStyle/tone/worldviewTemplate` 5个字段，缺一不可。对照清单：key=分支唯一标识；systemPersona=系统人格（替代题材defaultSystemPersona）；namingStyle=命名风格（替代题材namingStyle）；tone=文风（替代题材styleHints.tone）；worldviewTemplate=世界观模板（替代题材worldviewTemplate）。漏字段会导致review agent回退到题材profile旧约束词（如武侠的nostalgic-elder/jianghu-epithet/苍劲豪迈/martial-ascension），first-review因"方括号标签/上帝视角/喜剧密度"拒绝
7. **buildStyleProfile字段读取优先级【陷阱#73硬门禁】**：Read [projectCreateHandler.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/routes/projects/projectCreateHandler.js) 的buildStyleProfile函数，确认 key/tone/namingStyle/worldviewTemplate/systemPersona 5个字段采用 `pluginSP.xxx || genreFullConfig.xxx` 优先级（分支优先于题材profile）。直接读genreFullConfig会导致分支styleProfileOverrides不生效。验证方法：新建项目后`GET /api/projects/:id`查styleProfile，6字段必须全部来自分支而非题材profile

### 2.5 数据深度能力盘点

**世界观三维分类系统**（[contextDepthConstants.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contextDepthConstants.js)）：

| 维度 | label | 包含素材类型 | 默认加载 | 大纲提及加载 |
|------|-------|-------------|---------|-------------|
| macro | 宏观 | power-system, worldview | L1 | L2 |
| meso | 中观 | faction, organization, geography, institution, religion | L0 | L2 |
| micro | 微观 | scene, phenomenon, technology, custom | null | L1 |

**角色深度三指标**（[characterDepthExtractor.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/characterDepthExtractor.js)）：

| 指标 | 字段 | 检测模式 | 累加策略 |
|------|------|---------|---------|
| 内心描写 | `innerVoiceCount` | 眼神/眉头/面色+情绪动词；心中暗想/盘算 | 跨章累加到entityCenter.genreState |
| 自主决策 | `autonomousDecisionCount` | 猛地/突然+动作；决定/选择/执意 | 跨章累加到entityCenter.genreState |
| 反预期行为 | `subversiveBehaviorCount` | 愣住+随即；以为+却；竟然/居然 | 跨章累加到entityCenter.genreState |

### 2.6 4类素材生成链路盘点【新增·硬门禁】

**背景**：陷阱#67-70发现4类素材全部0数据的根因是material-organizer僵尸功能+执行顺序缺陷+roleLevel未透传+response未持久化。

**4类素材生成链路**：

| 素材类别 | 生成步骤 | 写入位置 | 关键函数 | 链路断点后果 |
|---------|---------|---------|---------|-------------|
| 实体中心 | material-organizer→material-registrar | entity_center表 | handleMaterialOrganizer→handleMaterialRegistrar→processCharacterUpdates | 角色全npc/roleLevel丢失 |
| 知识库 | material-organizer→knowledge-extraction | knowledge_facts+knowledge_access表 | runMaterialOrganizer→runKnowledgeExtraction→processKnowledgeChanges | knowledgeChanges=0 |
| 主线任务 | autoInitProject | quests表 | autoInitProject→ensureMainQuest+createPhaseQuests | quest=0 |
| 角色深度 | material-registrar→characterDepthExtractor | entity_center.genreState(JSONB) | processChapterDepth→extractDepthIndicators→persistDepthIndicators | 三指标=0 |

**检查方法**：
1. **material-organizer是否被调用**：grep `runMaterialOrganizer` in pipelinePostApproval.js
2. **执行顺序是否正确**：material-organizer必须先于materialRegistrar执行（陷阱#69修复）
3. **response是否持久化**：runMaterialOrganizer内必须保存result.response到chapter.materialOrganizerOutput（陷阱#68修复）
4. **roleLevel是否透传**：processCharacterUpdates必须调用processRoleLevelUpdate（陷阱#70修复）
5. **autoInitProject是否被调用**：initializeRoutes.js Step4必须await autoInitProject
6. **characterDepthExtractor是否被调用**：materialRegistrar.js必须调用processChapterDepth

### 2.7 全链路素材注入完整性校验【新增·硬门禁·陷阱#79】

**背景**：陷阱#79发现"素材到位≠素材注入"——5章监控全部角色深度=0、工具人化，根因是material-organizer输出了深度字段但processTraitNotes因数据源不一致（查materials表但角色在entityCenter）导致深度字段永不写入stateKVIndex，writer/reviser/review全拿不到。material-depth校验的是落库状态，不是运行时注入状态，必须独立校验注入链路。

**素材注入5环节**：

| 环节 | 数据源 | 关键函数 | 断链后果 |
|------|--------|---------|---------|
| ①生成 | material-organizer输出 | runMaterialOrganizer→LLM输出8个深度字段 | moOutput深度字段空 |
| ②存储 | stateKVIndex | processTraitNotes→updateCharacterState | character-states表0记录 |
| ③加载 | 调度器→stateJson | scheduleMaterials→_loadFromEntityCenter→buildStateJson | stateJson深度字段空 |
| ④注入 | agent prompt | buildCharacterSection/Review→_extractDepthLines | agent拿不到深度字段 |
| ⑤运行时 | 章节正文 | writer LLM基于深度字段写作 | 工具人化+角色深度0 |

**检查方法**：
1. **首章pipeline后必须运行**：`node scripts/auditMaterialInjection.js <projectId> 1`
2. **退出码0=通过，1=有断链**：任何断链点阻断后续章节pipeline
3. **关键校验项**：
   - ①material-organizer输出深度字段非空（personalityNote/innerConflictNote等8个至少有1个）
   - ②entityCenter角色数>0
   - ③material-depth的materialOrganizerOutput/knowledgeFacts/knowledgeAccess检查通过
   - ④章节内容有内心活动描写（writer拿到深度字段后会体现）

**陷阱#79防护**：processCharacterUpdates的findCharacterMaterial已增加entityCenter fallback，processTraitNotes的进入条件已从4字段扩展为8字段。若校验仍失败，检查entityCenter.findEntityByName是否正常工作。

### 2.8 约束词题材适配校验【新增·硬门禁·陷阱#78】

**背景**：陷阱#78发现contentMetadataDetector的约束词混了三类（管线标记/管线术语/元叙事引用），第②类管线术语在程序员题材中是正文合理用语，但硬编码全局拦截导致误判。

**检查方法**：
1. **contentMetadataDetector三类分离**：PIPELINE_MARKER_PATTERNS（全题材通用）/ DEFAULT_PIPELINE_TERM_PATTERNS（题材可配置）/ META_NARRATIVE_PATTERNS（全题材通用）
2. **题材插件pipelineTermOverrides配置**：程序员题材应在config.js声明`pipelineTermOverrides: { skip: ['参数同步', '循环数据归档', '主控逻辑'] }`，表示这些词在该题材正文里是合理用语
3. **首章pipeline后校验**：如果首章hardBlock触发"管线术语泄露"，检查被拦的词在该题材是否是正文用语，是则加入pipelineTermOverrides.skip

### 2.9 跨字段引用一致性校验【新增·硬门禁·陷阱#77】

**背景**：陷阱#77发现material-organizer的relationshipChanges引用的角色不在characters[]定义中，material-registrar不校验导致引用角色永远不被创建。

**检查方法**：
1. **materialRelationProcessor已增加自动创建**：relationshipChanges引用的角色不在materials表/entityCenter时，自动创建最小实体（roleLevel=npc）
2. **首章pipeline后校验**：检查entityCenter角色数是否≥relationshipChanges中引用的不同角色数，若小于则有引用角色未被创建
3. **material-organizer prompt强化**：要求所有出现在relationshipChanges中的角色必须在characters[]中定义（仍由LLM遵守，自动创建是兜底）

### 2.10 节点级契约校验门禁【新增·硬门禁·陷阱#79】

**背景**：陷阱#79发现"问题在pipeline执行中不拦截，跑完才发现"——5章工具人化全部跑完才知道。节点级契约校验在pre/post/postMaterial三阶段拦截断链，WARN也阻断。

**契约校验架构**（YAML驱动，可维护可扩展，阶段3已完成STEP_CONTRACTS硬编码删除）：

| 文件 | 职责 | 行数 |
|------|------|------|
| [contractValidator.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contractValidator.js) | 主调度（loadContract/validateInput/validateOutput） | 171 |
| [contractFieldChecker.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contractFieldChecker.js) | 字段校验纯函数（getByPath/validateField/routeBySeverity） | 101 |
| [contractPostMaterialValidator.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contractPostMaterialValidator.js) | material-manager落库校验（stateKVIndex+entityCenter） | 78 |
| [contractCompat.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contractCompat.js) | YAML→旧STEP_CONTRACTS格式兼容层（阶段3迁移产物） | 64 |
| [pipelineContract.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/pipelineContract.js) | 契约常量+enforceContract+数据流校验（STEP_CONTRACTS已删除） | 113 |
| [configSyncCheck.js](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/configSyncCheck.js) | YAML契约覆盖校验（替代旧PF代码同步校验） | 82 |

**10个YAML契约**（阶段1+2+3全覆盖STEP_ORDER）：

| 契约文件 | agent | 输入规则 | 素材深度规则 | 输出规则 | postMaterial规则 |
|---------|-------|---------|------------|---------|----------------|
| [outline-generator.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/outline-generator.contract.yml) | outline-generator | 2 (PF-OG-001/002) | 0 | 1 (OG-OUT-001) | 0 |
| [writer.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/writer.contract.yml) | writer | 3 (WR-IN-001/002/003) | requireMinCount+stateJson.anyOf | 2 (WR-OUT-001/002) | 0 |
| [first-review.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/first-review.contract.yml) | first-review | 2 (FR-IN-001/002) | requireMinCount+stateJson.anyOf | 2 (FR-OUT-001/002) | 0 |
| [fast-review.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/fast-review.contract.yml) | fast-review | 2 (FA-IN-001/002) | requireMinCount+stateJson.anyOf | 2 (FA-OUT-001/002) | 0 |
| [second-review.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/second-review.contract.yml) | second-review | 3 (SR-IN-001/002/003) | requireMinCount+stateJson.anyOf | 2 (SR-OUT-001/002) | 0 |
| [reviser.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/reviser.contract.yml) | reviser | 2 (RV-IN-001/002) | requireMinCount+stateJson.anyOf | 1 (RV-OUT-001) | 0 |
| [final-editor.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/final-editor.contract.yml) | final-editor | 3 (FE-IN-001/002/003) | requireMinCount+stateJson.anyOf | 2 (FE-OUT-001/002) | 0 |
| [polisher.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/polisher.contract.yml) | polisher | 2 (PO-IN-001/002) | requireMinCount+stateJson.anyOf | 1 (PO-OUT-001) | 0 |
| [material-manager.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/material-manager.contract.yml) | material-manager | 2 (MM-IN-001/002) | 0 | 1 (MM-OUT-001) | 2 (MM-POST-001/002) |
| [consistency-constraint.contract.yml](file:///c:/Users/mingy/Desktop/trae/novel-pipeline/server/services/pipeline/contracts/consistency-constraint.contract.yml) | consistency-constraint | 2 (CC-IN-001/002) | 0 | 1 (CC-OUT-001) | 0 |

**三阶段校验**（pipelineStepRunner.js挂载，9个agent全覆盖）：

| 阶段 | 时机 | 校验内容 | 阻断策略 |
|------|------|---------|---------|
| pre-execution | agent执行前 | input.required字段+materialFields深度字段 | CRITICAL+WARN均阻断 |
| post-execution | agent执行后 | output.required字段（content/wordCount/passed等） | CRITICAL阻断 |
| post-material | material-manager落库后 | character-states表+entityCenter角色数 | CRITICAL阻断 |

**阶段3迁移成果**（STEP_CONTRACTS硬编码已删除）：
- 旧`pipelineContract.js`的STEP_CONTRACTS常量（37行硬编码）已删除
- `getStepContract`/`getContractSummary`从YAML契约生成兼容格式（contractCompat.js）
- `configSyncCheck.js`改为校验YAML契约覆盖STEP_ORDER（不再校验PF代码同步）
- `pipelinePreflight.js`无需修改（通过contractCompat.js透明兼容）

**YAML契约关键字段**：

| 字段 | 类型 | 含义 | 示例 |
|------|------|------|------|
| `input.required[].path` | string | ctx对象字段路径（无ctx前缀） | `chapter.outline` |
| `input.required[].severity` | enum | CRITICAL/WARN/HIGH | CRITICAL |
| `input.materialFields.character.requireMinCount` | object | CH2+最少未归档角色数 | `{min:1, exceptFirstChapter:true}` |
| `input.materialFields.character.stateJson.anyOf` | array | stateJson任一深度字段即可 | `[innerConflict, fateArc, ...]` |
| `output.required[].field` | string | agent输出字段名 | `content` |
| `postMaterial.characterStates` | object | character-states表本章记录数>0 | `{check: hasChapterState}` |

**检查方法**：
1. **契约加载校验**：`node -e "const v=require('./server/services/pipeline/contractValidator');console.log(JSON.stringify(v.getContractSummary(),null,2))"` — 应返回10个agent摘要
2. **单元测试**：`node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/contractValidator.test.js --no-coverage` — 65用例全过
3. **全量契约测试**：`node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/pipelineContract*.test.js tests/unit/contractValidator.test.js tests/unit/configSyncCheck.test.js tests/unit/pipelinePreflight.test.js --no-coverage` — 171用例全过
4. **真实pipeline验证**：新建项目跑CH1，观察pre-execution是否拦截断链；跑CH2，观察requireMinCount+stateJson.anyOf是否强制CRITICAL
5. **WARN也阻断**：pipelineStepRunner.js第51-60行——inputCheck.warnings.length>0时return passed:false

**陷阱#79场景覆盖**（单元测试已验证）：

| 场景 | 期望 | errorCode |
|------|------|-----------|
| CH1 + materials空 | 通过（首章例外） | - |
| CH2 + materials空 | CRITICAL阻断 | WR-IN-005 |
| CH2 + 仅archived角色 | CRITICAL阻断 | WR-IN-005 |
| CH2 + 角色stateJson无深度字段 | CRITICAL阻断 | WR-IN-004 |
| CH2 + 角色stateJson含innerConflict | 通过 | - |
| material-manager后stateKV无记录 | CRITICAL阻断 | MM-POST-001 |
| material-manager后entityCenter无角色 | CRITICAL阻断 | MM-POST-002 |
| stateKV查询异常 | WARN不阻断（passed=true） | MM-POST-CHECK-ERR |

**扩展指南**（新增agent契约步骤）：
1. 在contracts/目录新建`<agent>.contract.yml`
2. 在contractValidator.js的SUPPORTED_AGENTS数组追加agent名
3. 在pipelineStepRunner.js的CONTRACT_AGENTS集合追加
4. 补单元测试到contractValidator.test.js
5. 运行`node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/contractValidator.test.js --no-coverage`验证

### 2.11 验收标准

- 系统能力清单（实体/知识库/约束词/数据深度/僵尸功能扫描/世界观分支/4类素材链路/全链路注入/约束词题材适配/跨字段引用一致性/节点级契约校验十一块全过）
- 主线任务UI入口可达且数据可加载
- `initializeRoutes.js` 调用链完整（含autoInitProject）
- 题材支持分支且分支配置完整
- 4类素材生成链路完整（material-organizer被调用+执行顺序正确+response持久化+roleLevel透传）
- **全链路注入完整性校验通过**（`auditMaterialInjection.js`退出码0）
- **约束词题材适配配置就绪**（程序员题材声明pipelineTermOverrides.skip）
- **跨字段引用一致性通过**（relationshipChanges引用角色全部有实体）
- **节点级契约校验通过**（`contractValidator.test.js` 35用例全过 + 真实pipeline首章验证三阶段拦截有效）

---

## 三、第三阶段：项目设计

**目标**：基于已验证的系统能力，设计具体项目，确保约束词、素材标准、数据库字段、数据深度、铁律五对齐。

### 3.1 步骤3.1 项目骨架+世界观分支选择

- 主角设定（姓名/性格/金手指/成长曲线）
- **世界观分支选择**（新增）：从题材支持的分支中选择一个，确定worldviewCore/powerSystem/planeConcept/mentorConcept/namingStyle/toneStyle
- 世界观框架（按宏观/中观/微观三层组织，术语体系由分支决定）
- 主线任务（卷划分+每卷核心矛盾+爽感节奏点，写入quests表）

### 3.2 步骤3.2 每个Agent的约束词设计

按流水线顺序逐个设计：大纲生成/素材生成/执笔/一审/二审/快审/终审

**分支配置自动注入**（新增）：约束词设计无需手动复制分支配置，resolveGenreFromProject会根据project.branchKey自动注入分支专属的术语体系/战力体系/环境概念/导师设定/命名风格/文风到所有agent。

### 3.3 步骤3.3 素材标准设计

基于约束词，定义本项目素材字段标准。

**数据深度设计要求**：
- 宏观层素材（power-system/worldview）每个项目≥2条，覆盖主世界核心规则
- 中观层素材（faction/institution）按卷配置，每卷≥1个新势力
- 微观层素材（scene/technology）按需配置，关键场景≥1条
- 角色素材必须含 `innerVoice/autonomous/subversive` 三指标字段定义

### 3.4 步骤3.4 约束词冲突预检

调用 `constraintDesignChecker.runFullDesignCheck` 自动检测。

**预检不通过禁止进入3.5**，必须修改约束词后重跑。

### 3.5 步骤3.5 六处对齐检查【硬门禁】

**检查七件事**：

| 检查项 | 怎么查 | 不通过怎么办 |
|---|---|---|
| 字段注册表覆盖 | `node scripts/verifyProjectSchema.js --project=<id>` | 补fieldRegistryData.js |
| pg实际表结构 | 脚本调用 `validateRegistryVsPgSchema` | 跑迁移脚本 |
| 题材schema对齐 | 查 `genreStateFields.GENRE_SCHEMAS[题材id].extraFields` | 补题材字段定义 |
| filter状态值一致性 | `Grep "status === 'approved'"` 全仓库 | 对齐`isCompletedOrApproved()` |
| 素材传递方向 | `Grep "substring(0,"` 涉及章节内容的 | 取开头的改为`getChapterTail()` |
| 数据深度字段一致性 | 查character_states表含innerVoiceCount/autonomousDecisionCount/subversiveBehaviorCount | 补迁移脚本+genreStateFields |
| **分支配置注入一致性**（新增） | 查project.branchKey+resolveGenreFromProject返回的genre.branchKey一致 | 补createProjectData的branchKey处理 |

**产出**：六处对齐报告（字段差异=0 + filter不一致=0 + 传递方向错误=0 + 深度字段缺失=0 + 分支配置不一致=0）

### 3.6 第三阶段产出

- 项目骨架（含世界观分支选择） + 约束词 + 素材标准 + 六处对齐报告，四件齐全才进入第四阶段

---

## 四、第四阶段：端到端验证

### 4.1 步骤4.1 首章试写

#### 4.1.1 环境就绪检查【必做】

| 检查项 | 怎么查 | 不通过怎么办 |
|---|---|---|
| 服务器加载新代码 | `GET /api/health` 看 `startedAt` 晚于最近代码修改 | `node scripts/serverStart.js --start` |
| API key可用 | 查 `.env` 有 `ALIYUN_CODING_API_KEY` | 确认.env |
| 路由参数一致 | `node scripts/audit-route-param-consistency.js` | 修正验证器 |
| 敏感词边界防护 | `node scripts/tmp_scan_sensitive.js ch1` | 修复sensitiveWordGuard.js加词边界 |
| 主线任务UI可达 | 打开 `/materials` → "⚔ 主线任务" Tab | 修复QuestPanel.jsx |
| 数据深度字段就绪 | 查character_states表含三指标字段 | 跑迁移脚本 |
| **分支配置注入验证**（新增） | 新建项目时传branchKey，查project.branchKey有值+resolveGenreFromProject返回genre.branchKey一致 | 补createProjectData的branchKey处理 |

#### 4.1.2 跑首章流水线

- 用 `POST /api/projects/initialize` 一步创建项目+素材+大纲，**body必须含branchKey字段**
- 用 `POST /api/pipeline/full` 异步启动首章pipeline
- 完成后查 `GET /api/chapters/:id` 确认内容生成

**禁止**：
- 禁止用 `POST /api/projects` + 手动传styleProfile
- 禁止用 `POST /api/chapters` 创建章节（initialize已自动创建）
- 禁止在服务器未重启的情况下跑pipeline
- 禁止新建项目时不传branchKey（分支配置不会注入）

#### 4.1.3 4类素材到位验证【新增·硬门禁】

首章pipeline完成后，必须验证4类素材全部到位：

| 素材类别 | API查询 | 合格标准 | 不达标处理 |
|---------|---------|---------|-----------|
| 实体中心 | `GET /api/entity-center/entities?projectId=<id>&entityType=character` | 主角roleLevel=protagonist（非npc） | 查processRoleLevelUpdate是否被调用 |
| 知识库 | `GET /api/knowledge/facts/<projectId>` | facts数≥1 + access记录≥1 | 查runMaterialOrganizer+runKnowledgeExtraction是否被调用 |
| 主线任务 | `GET /api/quests/quests?projectId=<id>` | quests数≥1（含main+phase） | 查autoInitProject是否被调用 |
| 角色深度 | `GET /api/entity-center/entities?projectId=<id>` 查genreState | 主角innerVoiceCount≥1 | 查processChapterDepth是否被调用 |

**不达标5步处理流程**（防陷阱#52）：
1. 根因分析（问3层为什么）
2. 横向排查（grep全仓库同类模式）
3. 查陷阱库（grep project_memory.md）
4. 修复+回归（重跑失败章节+回归已通过章节）
5. 教训持久化（写入project_memory.md）

### 4.2 步骤4.2 老书虫视角点评（数据驱动+深度维度）

| 评价项 | 检测器/工具 | 合格标准 | 不达标处理 |
|---|---|---|---|
| 标题吸引力 | 规则匹配套路词 | 0个命中 | 回3.2加"禁止烂大街标题" |
| 前1000字钩子 | `contentDetectors.detectTension()` | `hasTension=true` | 回3.2加"开头必须有冲突" |
| 角色辨识度 | 查`character_states`表metrics | 主角3项指标有值 | 回3.2加"角色深度"约束 |
| 文风接地气 | AI痕迹检测器 | AI痕迹词≤5个/千字 | 回3.2强化`anti-ai-trace` |
| 题材承诺达标 | 题材专属检测器 | 高武≥3处笑点/章 | 回3.2强化`comedy-mandatory` |
| **世界观三维覆盖** | `worldviewClassification.getClassificationOverview(materials)` | 宏观≥2/中观≥1/微观按需 | 回3.3补素材 |
| **角色深度三指标** | `characterDepthExtractor.extractDepthIndicators(content, names)` | 主角+1配角三指标均>0 | 回3.2加"配角反工具人"约束 |
| **敏感词无误判** | `sensitiveWordGuard.scanContent(content)` | 0个block级真实命中 | 修复sensitiveWordGuard.js加词边界 |
| **分支术语一致性**（新增） | grep章节内容是否含分支detectorConfig.forbiddenTerms | 0个禁用术语命中 | 回3.2强化分支术语约束 |

**产出**：老书虫点评报告（9项数据驱动评价，每项有数值+合格判定）

### 4.3 步骤4.3 五章稳定性验证

#### 4.3.1 六项必做产出（缺一不可）

| 产出项 | 数据来源 | 合格标准 |
|---|---|---|
| 状态累积表 | PG的`character_states`表 | 主角伤势/境界/系统状态/持有物跨章一致 |
| 伏笔台账 | PG的`quests`+`timelines`表 | 列出已埋伏笔+回收状态 |
| 角色弧光曲线 | 通读5章正文 | 三章一节点，有成长转折 |
| 题材承诺达标率 | 每章规则匹配笑点/萌点 | 高武≥3处/章，5章全达标 |
| **数据深度累积表** | PG的`character_states`表三指标 + `worldviewClassification`素材分布 | 角色三指标跨章累加非单调0；世界观三维素材5章内有增量 |
| **4类素材到位表**（新增） | 实体中心+知识库+主线任务+角色深度API查询 | 5章后4类素材均有增量 |

#### 4.3.2 验证失败5步处理流程（防陷阱#52）

发现任何一章不达标时，**禁止直接回3.2改约束词**：

1. 根因分析（问3层为什么）
2. 横向排查（grep全仓库同类模式）
3. 查陷阱库（grep project_memory.md）
4. 修复+回归（重跑失败章节+回归已通过章节）
5. 教训持久化（写入project_memory.md）

#### 4.3.3 五章稳定性验收标准

| 检查项 | 通过标准 | 失败处理 |
|---|---|---|
| 状态累积表 | 5章状态一致无突变 | 查character_states提取逻辑 |
| 伏笔回收率 | 已埋伏笔≥50%被回收或仍在待回收期 | 查quest自动初始化 |
| 角色弧光 | 有成长转折非平铺 | 回3.2加角色深度约束 |
| 题材承诺达标率 | 5章全部达标 | 回3.2强化题材约束 |
| 章节衔接 | 每章开头承接上章结尾 | 查stepContextBuilder传递方向 |
| 跨章重复 | 0处逐字复制 | 查跨章重复检测是否触发 |
| **数据深度累积** | 主角三指标ch5>ch1；配角≥1个三指标和≥3 | 查characterDepthExtractor调用链 |
| **4类素材到位**（新增） | 5章后实体roleLevel正确/知识库facts递增/quest有推进/深度指标累加 | 查4类素材生成链路（陷阱#67-70） |
| **organizingPlan非空**（陷阱#90新增） | 每章material-organizer输出`hasKnowledgeChanges=true`且`knowledgeChangesCount>0`；characters数组非空 | 查agentJobTemplates.js material-organizer slots是否含constraints+style-profile；查materialOrganizer.js的_warnOnEmptyOrganizingPlan日志 |

**产出**：五章稳定性报告（8项验收标准全过）+ 六项必做产出数据

### 4.4 交付前必做检查

执行 `node scripts/audit-iron-law.js --pre-deliver`，自动检测14项铁律。

---

## 五、流程图

```
[会话开始] → audit-iron-law.js --session-start
      ↓
[第一阶段 题材评估] → 白名单CI →不达标→ 淘汰
      ↓通过
[第二阶段 系统能力盘点] →缺失→ 先补系统
   ├─ 实体中心/知识库/约束词
   ├─ 主线任务UI入口可达
   ├─ 数据深度能力（世界观三维+角色三指标）
   ├─ 世界观分支能力（新增）
   └─ 4类素材生成链路（新增）
      ↓齐全
[第三阶段 项目设计]
   ├─ 3.1 项目骨架+世界观分支选择（新增）
   ├─ 3.2 约束词设计（分支配置自动注入）
   ├─ 3.3 素材标准（含数据深度配置）
   ├─ 3.4 冲突预检 →有冲突→ 改约束词
   └─ 3.5 六处对齐检查 →有差异→ 补字段/改filter/改方向/补深度字段/补分支配置
      ↓六处对齐
[第四阶段 端到端验证]
   ├─ 4.1 环境就绪（含分支注入验证）+首章试写
   ├─ 4.1.3 4类素材到位验证（新增·硬门禁）
   ├─ 4.2 数据驱动老书虫点评（9项含分支术语一致性）→不达标→ 回3.2
   └─ 4.3 五章稳定性验证（8项含4类素材到位）→不通过→ 5步处理流程
      ↓通过
[交付前] → audit-iron-law.js --pre-deliver →14项全过→ 项目正式立项
```

---

## 六、陷阱关联

**使用规则**：执行任何阶段前，必须先查此表+grep `project_memory.md` 看有没有新陷阱。

| 陷阱# | 描述 | 本SOP对应步骤 |
|---|---|---|
| #41 | prevChapterSummary取开头而非结尾 | 3.5素材传递方向校验 |
| #42 | 约束词只写不查 | 3.4冲突预检 |
| #47/#50 | stepContextBuilder取开头而非结尾 | 3.5素材传递方向校验 |
| #51 | 跨章重复检测门禁用错状态值 | 3.5 filter状态值一致性 |
| #52 | SOP验证降级成"跑流水线+点评" | 4.3六项必做产出 |
| #53 | 敏感词无词边界匹配 | 4.1.1敏感词边界防护 |
| #55 | 主线任务UI入口未验证可达 | 2.2主线任务模块位置必查 |
| #56 | 数据深度字段未对齐 | 3.5数据深度字段一致性 |
| #57 | 角色深度提取器调用链断 | 2.5数据深度能力盘点 |
| #58 | autoInitProject僵尸功能 | 2.3项目初始化遗漏功能必查清单 |
| #67 | material-organizer僵尸功能 | 2.6 4类素材生成链路盘点 |
| #68 | material-organizer response未持久化 | 2.6 4类素材生成链路盘点 |
| #69 | pipelinePostApproval执行顺序缺陷 | 2.6 4类素材生成链路盘点 |
| #70 | processCharacterUpdates不透传roleLevel | 2.6 4类素材生成链路盘点 |
| #71 | 题材配置与项目题材精神分裂 | 2.4世界观分支能力盘点 |
| #86 | material-organizer genre解析bug导致配角深度指令不生效 | 2.6 4类素材生成链路盘点（resolveGenreFromProject必须传完整project对象） |
| #87 | 堵漏式修复反复发生——消费端拼凑而非生产端生成 | 2.6 4类素材生成链路盘点（禁止堵漏，按源头修复6步法） |
| #88 | 修复方案未验证假设就实施——第一版诊断常错 | 4.3.2 验证失败5步处理流程（修复前强制验证3问） |
| #89 | 检测规则不区分语义导致误报率畸高 | 4.1.1 环境就绪检查（audit-leak-fix.js误报率<30%） |
| #90 | material-organizer slots配置不足导致空organizingPlan→连锁下游全断 | 2.6 4类素材生成链路盘点（material-organizer slots必须含constraints+style-profile，与material-manager对齐）；4.3.3 五章稳定性验收（organizingPlan非空检查） |
| #91 | final-editor字数覆盖分支跳过runPostApproval→material-organizer/registrar/knowledge-extraction全部不执行 | 2.6 4类素材生成链路盘点（三个审批覆盖分支必须统一调用runPostApproval，禁止走捷径直接调material-manager） |
| #92 | 引用从未定义的函数validateNewMaterial→素材创建运行时报错 | 4.1环境就绪检查（grep所有require导入的函数名，验证在目标module.exports中存在） |
| 路由参数 | validators.js参数名与路由`/:id`不一致 | 4.1环境就绪检查 |
| 服务器老代码 | 代码改了未重启服务器 | 4.1环境就绪检查 |
| API key误判 | 误查/api/api-keys端点 | 4.1环境就绪检查 |
| 低俗题材 | "影后归来"式烂大街套路入库 | 第一阶段市场五问+白名单 |
| 字段缺失 | 素材标准与pg schema未对齐 | 3.5六处对齐检查 |

---

## 七、维护规则

1. **新增题材时**：必须先过第一阶段市场五问+质量门禁，再更新白名单脚本+CI，最后更新本SOP
2. **新增约束词时**：必须更新第三阶段3.2配置流程+3.4冲突预检
3. **新增数据库字段时**：必须同步更新 `fieldRegistryData.js` + `genreStateFields.js` + 跑3.5对齐校验
4. **新增铁律时**：必须更新〇节铁律清单+对应阶段门禁+`audit-iron-law.js`检测项
5. **新增数据深度维度时**：必须同步更新 `contextDepthConstants.js` + `characterDepthExtractor.js` + 本SOP第二阶段+第四阶段
6. **新增敏感词时**：必须同步加词边界+单测覆盖子串误判场景
7. **新增世界观分支时**（新增）：必须同步更新 `branches/` 目录+`branches/index.js`注册+`projectCreateHandler.js`的branchKey处理+本SOP第二阶段2.4+第三阶段3.1
8. **本SOP与08-约束执行规范.md的关系**：08定义CES系统架构，09定义新项目设计流程，两者互补不冲突
