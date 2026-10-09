# SESSION-STATE — 跨窗口接手状态卡

> 新窗口/新AI接手时：先读本文件（2分钟），再按任务读 docs/INDEX.md 对应SOP。
> 长任务必须遵守 docs/sop/10-上下文交接规范.md（状态落盘+恢复锚点，防上下文压缩失忆）。
> 本文件只记录"当前状态与待办"，架构细节看 ARCHITECTURE.md。
> 最后更新：2026-10-10（**UI 盲区修复 + 铁律三根因（幽灵规则/误报）+ AI 味词表接入 M11 检测器**，见 §一 0u）
> 上一轮：崩溃转储 process.report + 并发压测 + AI 味审计（2026-10-09，见 0t）
> 上一轮：跨界副本博弈建项 + 20 章生产 + 12 项问题溯源（2026-10-09，见 0s）

---

## 一、当前结论（重要）

0u. **（2026-10-10 本会话）UI 盲区修复 + 铁律三根因 + AI 味词表接入检测器（用户："点任何章 UI 都显示固定错误：复审未通过·系统提示未化为高武意境表达·违反铁律三"）**
   - **先判性质 = UI bug，不是数据**：全书只有第 1、6 章真含"铁律三"（章节表 + 流水线日志双证）；用户所见"固定错误"是**看板坏了**。
   - **UI 根因**：`client/src/pages/pipeline/usePipelinePageState.js` 两处叠加——①状态轮询空闲时也用**项目级** infinite 日志覆盖执行日志；
     ②`loadPipelineLogs` 有"仅当 logs 为空才加载"守卫 → 点任何章都不刷新。**已修**（空闲只显示所选章日志；去掉守卫）。
   - **顺手修潜伏 bug**：同文件 `STATUS_VALUES` 未 import →「补跑素材管理员」按钮必 `ReferenceError` 静默失败（baseline 亦然）。已修。
   - **铁律三根因**：①**幽灵规则**——审稿器引用"铁律一/二/三"但全库无定义（"只查不写"）→ 已把 **铁律一/二/三 补进唯一源 `foundation.js`** + 加防漂断言；
     ②**检测器误报**——原 `content.includes('系统提示')` 把"**不是**系统提示"判 critical → 改结构化 `systemMetadataLeak()` + 否定豁免，**刻意不收录"状态栏"等剧情化 HUD 词**。
   - **接入检测器**：新增 **M11「AI 腔高频词控制」**（用户点名词表）——`constraintDetectionConfig.M11` + `detectors/detectAiSlop.js` +
     `constraintMetaSpecAiSlop.js`（拆文件守 200 行）+ 注册表；走 `hardBlockChecks` + `constraintFeedbackCollector` + `getMetaConstraintsForPrompt()`（writer 侧**既查也写**），`block:false`。
   - **验证**：`server/tests/unit` **110/110**；`tests/unit` **265 套件/4025 例全绿**（基线 262/4008）；client `usePipelinePageState` 8/8（全量 17 失败=既有 entitycenter 基线）。
   - **⚠️ 下窗口待办（问题统计见 worklog §六）**：P1 铁律三只在二审"LLM 先过"后才查（真违规可能漏网）；
     P2 pipeline 内 **19 处空 catch / 9 处 silent**（静默吞错）；P3 `constraintDesignCoveredCheck` M1–M10 既有覆盖缺口；
     P4 审稿器铁律编号仍硬编码（应取唯一定义源）；P6 方法论：需常态化"审稿器引用 ⟷ 执笔端声明"一致性盘点。
   - 详见 `docs/worklog/2026-10-10-UI盲区与铁律三根因-AI味接入检测器.md`。

0t. **（2026-10-09 上一会话）崩溃转储（process.report）+ 并发压测 + AI 味高频词审计（用户："加 process.report 崩溃转储 + 并发压测；提交根因修复；检查 AI 写作高频词"）**
   - **交付**：`server/bootstrap/crashDump.js`（**`reportOnFatalError=true`** —— 原生致命错误 0xC0000409 唯一留证通道；
     `reportOnSignal=false` 避免停机产报告；`uncaughtException` 先落报告再退出码 1）→ 接入 `server/index.js` 顶部 +
     `scripts/serverStart.js` 加 CLI 兜底 `--report-on-fatalerror --report-compact --stack-trace-limit=50`；
     `scripts/crashReport.js`（读转储摘要，抠原生栈）；`scripts/stressTest.js`（并发压测，含预检/崩溃检测/429 提示）；
     `scripts/audit-ai-slop.js`（AI 味高频词审计）。转储目录 `data/crash-dumps/`（已 gitignore）。
   - **提交**：上一会话 6 处根因修复（#1/#4/#6/#7/#9/#10/#12）+ 回归测试 + worklog + 本文件，已过 pre-commit 五关。
   - **验证**：`crashDump.test.js` 4/4；`kuaijieRegression`+`materialShapeGate` 17/17；后端带转储重启成功；
     压测 health 64×20 / mixed 48×25 均 ok=全、**未复现 0xC0000409**（health 256×8 触发限流 → 压力被削弱）。
     **结论：偶发性未复现；转储已就位，下次崩溃将留下原生栈。**
   - **AI 味审计（用户点名词表）**：项目 `万界副本·博弈者` 定稿 **中招** —— `嘴角勾起×16`、`这意味着×9`、`底层逻辑×7`、
     `交织×6`、`心中一凛×2`、`瞳孔微缩×1`…（final 104 次/55k 字，严重词 36）。**覆盖缺口**：现有 M1–M10 检测器
     **未收录**这些词 → 生成端无约束、审读端不拦。**建议加 M11「AI 腔设定词」并 writer 侧声明（待拍板）**。
   - 详见 `docs/worklog/2026-10-09-崩溃转储与并发压测-AI味高频词审计.md`。

0s. **（2026-10-09 同日上一会话）跨界副本博弈建项 + 20 章生产 + 12 项问题溯源（用户："追根溯源，不是打补丁"）**
   - **交付**：新建项目 `万界副本·博弈者`（genre=高武/high-martial-comedy，**branch=metaverse 游戏化元宇宙·副本**），
     `POST /api/projects/initialize` 走 SOP 四阶段；**20/20 章全部 material-updated**（总 52,572 字，均 2,629/章），
     素材 16→112、facts 23、世界域 52、穿越痕迹 7。项目 id `8bc180d6-a5cf-404e-96ea-9fcc572bf7cf`。
   - **问题统计表（12 项）→ 根因修复 6 项**（详见 `docs/worklog/2026-10-09-跨界副本博弈-新项目20章-问题溯源.md`）：
     - **#1（阻断级）** `outlineGenerator.js` 调 `parseJsonResponse` 却未导入 → 大纲恒 0 → 连带 quests 失败。补导入。
     - **#12（最有价值）** **两套 `trimItemData` 分叉**：`db/storeCommon.js`（PG 路径）把材质形状归一放在
       **体积早返回之后** → **未超限素材永不归一**（新素材缺 provenance）；历史数据只因 T2 一次性回填而合规。
       修复=归一提到早返回前（与 `storeTrim.js` 对齐）+ 回填 68 条；`audit-material-shape.js --db` 归零、`materialShapeGate` 转绿。
     - **#6/#7/#10** 三处"静默失效"：`pipelineDepthDriftCheck` require 路径多一层 `../`；
       `checkPowerTimeline` 用块外 `content`（ReferenceError → **战力规则校验从未生效**）；`firstReviewParser` require 路径多一层。
     - **#9** 硬阻断后不收敛 → 前向活锁：ch3 正文出现"**上一章**"命中元叙事红线被 hardBlock；根因=**规则"只查不写"**
       （检测端硬拦，writer/reviser 提示词从未声明）。修复=唯一构建器 `writingGuardSectionBuilder` 增「元叙事章回引用红线」段。
   - **未修（已记录根因/方向）**：#2 后端偶发原生崩溃（`0xC0000409`，已知类#34，触发点未定位，已提供自愈监督器）；
     #3 素材非角色批次 JSON 解析不健壮；#4 initialize count 上报（已改待验）；#5 writer 首章 relationship 缺口；
     #8 润色缩字 + `content`/`normalContent` 语义分裂（5/20 章 <2400，1 章 <2000）；#11 门槛前向活锁（设计层）。
   - **回归**：`tests/unit` **262 套件 / 4008 例全绿**（基线 261/3999；新增 `tests/unit/kuaijieRegression.test.js` 9 例防回退）。
   - **全功能巡检**：31 个关键端点 31/31 通过（`scripts/_session_kuaijie/20_functional_tests.js`）。
   - **提交状态**：①本批 6 处根因修复**已提交**（见 §一 0t）；②3 个重复同名项目待清理（删项目需确认）。
   - **测试位置约定**：一次性驱动/诊断脚本放 `scripts/_session_kuaijie/`（含自愈监督器 `11_supervise_chapters.js`）；正式回归测试放 `tests/unit/`。

0r. **（2026-10-09 本会话）设计期补设计 + 命名质量 + 口头禅入编年史（用户："保证下个窗口建项目不产流水账/AI文/烂名字"）**
   - **已把前两批未提交改动提交**：`3eb5e50`（素材链路 T1→T6，上一会话遗留）+ `e934754`（高光/名言/魅力判定标准）。
   - **补设计（此前是空转的根因）**：设计期 `charisma/philosophy/quoteLibrary/highlightScenes` 普遍为空 →
     写手没依据只能写流水账（garbage in）。新增 `services/craftDesigner.js`：对未达标的主角/配角**一次批量 LLM** 产出
     6 项工艺，**只填空缺、过 validateQuotes/validateHighlights/validateCatchphrases 才落库**；
     `materialGenerator.generateInitialMaterials` 末尾**自动执行**（无缺口零调用）。
     CLI：`node scripts/designCharacterCraft.js --project <id> --generate [--apply]`。
   - **立项四件**：新增 `services/narrativePromiseDesigner.js` 生成"读者承诺/差异化卖点/主循环/情绪配方"落
     `project.narrativePromise`（此前**从没人写** → `narrativePromise.js` 注入块恒被跳过 → 写手不知道读者要什么）；
     初始化时自动跑（缺才生成）。
   - **命名质量（用户点名）**：新增 `services/namingQualitySpec.js`——禁用名单（萧炎/龙傲天/叶凡/叶辰/韩立/沈砚/顾清寒/柳如烟/
     林晓/陈默/慕容轩…）、流水线拼名正则（"顾清寒"式/复姓套餐）、**按时代风格的取法**（仙侠/武侠/志怪/民国/都市/西幻/科幻，
     示例取法参考《墓王之王》骆时秋/寒千落/风满楼/烛九阴/陈梦飞/齐庆疾/南锦屏）、命名三问（时代感/无同款/可反推身份）、
     `buildNamingGuidance()`；接入 `namingStyleRegistry`（风格块+审核块）、`outlineConstants.TYPE_NAMING_RULES.character`、
     `outlineTemplateBuilder.buildMaterialUserPrompt`、`promptFragments.resolve`。
     新增只读体检 `scripts/audit-character-names.js`（禁用名/跨项目重名/姓氏扎堆，`--strict` 可接 CI）。
   - **名梗进编年史**：新增 `services/validateCatchphrases.js`（口头禅三问：可复用/有辨识度/长在题材里，禁过场句与现代网络梗）；
     编年史 8→**9 维**（多"口头禅名梗"）：extractor prompt/归一、`characterChronicle` 落库、`entityCraftReflow` 回流、
     实体新增 `catchphrases` 字段（entityCRUD/behaviorRules/registry/formatters/fieldRegistry）、前端 `chronicleDimensions` + 测试。
   - **实测取证**：`node scripts/audit-character-names.js` → 40 角色 **违规 6**（席准/岑野/沈砚/柳三娘命中禁用名单、林渊命中流水线名）、
     **跨项目重名 1**（沈砚出现在 2 个项目）、姓氏扎堆 3（老/苏/林×4）。**按指令不修存量**。
   - **回归**：后端 **261 套件/3996 用例全绿**（较上场 256/3964，+5 套件 +32 例）；新增测试 5 个文件
     （namingQualitySpec / validateCatchphrases / craftDesigner / narrativePromiseDesigner / characterNameAudit）；
     `eslint server/ scripts/ --max-warnings=0` 通过；PROJECT_STANDARDS 0 error；iron-law `--pre-deliver` 无违反；
     hardcode 0（超 200 行文件 0——期间把 characterStateExtractor/outlineTemplateBuilder 拆分压回 ≤200）；词汇表 0 违规；
     前端 `chronicleDimensions` 8/8 通过。
   - **⚠️ 未完成 / 下个窗口注意**：① writer 侧"每章一个可截图瞬间"配额（**M11**）仍未接；
     ② 存量项目工艺/命名未回填（用户要求不修）；③ 建新项目时初始化会多两次 LLM 调用（工艺补设计 + 立项四件），
     无缺口/已齐备时零调用；④ `designCharacterCraft --generate` 未经真实 LLM 端到端跑（本地未验证真实产出质量，
     只验证了闸门与纯函数）——**下个窗口建项目时应看日志 `[craftDesigner]`/`[narrativePromise]` 确认实际落库**。
   - 详见 `docs/design/角色编年史升级-多维分层与素材质检.md` §十一、`docs/sop/12` §8.3/§8.7。

0q. **（2026-10-08 本会话）高光/名言/魅力"判定标准"落地——把"什么算高光/名言"写进 prompt（用户反馈）**
   - **用户诉求**：编年史的高光/名言"怎么定义的？"；参考《凡人修仙传》"人生如棋，落子无悔"、《英雄联盟》卡蜜尔
     "我曾踏足山巅，也曾坠入低谷，二者都让我受益匪浅"；让 AI **认识什么是高光/魅力/名言而不是流水账**。
   - **取证（真实 PG 数据，项目 7d3e3e66 / e5f0c24e）**：高光 **15 条里 10 条 why 是评论腔**
     （"展现了…/体现了…/确立了…/立住了…"）；`what` 退化成**剧情摘要**（"使用勘定笔…冻结探员行动权，趁乱带走流浪汉"）；
     quotes 收进**过场句**（"上车。""进去了。""几多钱？""莫搞。"）；`speaker` **100% 空**、`chapter` **100% 为 0**。
     根因：提示词只给"要什么"，**没给"什么不算"**（无反例/无判定测试/无自检），且 quotes/deeds/highlights 定义重叠。
   - **标准单一源**：新增 `services/craftQualitySpec.js`——**高光四问**（可截图/只有他会做/有代价/不可逆）、
     **名言三问**（去语境/可反推/有重量）、魅力句式（"当X时宁可Y也不Z"）、评论腔禁词表、过场句正则、`buildCraftGuidance()` 提示词块。
   - **改了什么**：① `chronicleExtractor` full 档 prompt 重写（标准+**正例出处**《凡人》何仙师赠韩立"人生如棋，落子无悔"／
     卡蜜尔台词 + **本项目真实反例** + 自检三步 + 禁词）② highlights 增 `cost`（代价），quotes 要求 `speaker/chapter`
     ③ `_normalizeEntry(item, chapter)` **回填** speaker=角色名、chapter=当前章（修历史 100% 空/0）
     ④ 新增 `validateHighlights.js`（四问+评论腔拦截+去重）、`validateQuotes` 加严（过场句不收、评论腔 why 不收，
     `MIN_QUOTE_CHARS 2→4 / MIN_WHY_CHARS 4→6`）⑤ `entityCraftReflow` 改为**过质检才回流实体**（宁缺毋滥）
     ⑥ 设计端：`materialDepthSpec` 高光/金句 qualityHints 去掉评论腔词"立住"改"处境/代价/记忆点"、`fieldRegistry` PROMPT_HINTS、
     `designCharacterCraft --emit-prompt` 输出完整标准 ⑦ `characterStateExtractor` 支持【金句库】`处境：原文（记忆点）`
     ⑧ UI：高光卡片显示"代价："。
   - **测试**：新增 `tests/unit/validateHighlights.test.js`(9)；`validateQuotes`/`entityCraftReflow`/`chronicleExtractor` 增补负例
     + **prompt 防回退断言**；`entityCraftReflow` 两处 fixture 改为合格数据（**故意**：证明新闸门生效）。
   - **回归**：后端 **256 套件/3964 用例全绿**（基线 255/3949）；改动文件 `eslint --max-warnings=0` 通过；
     词汇表闸门 0 违规；铁律互斥自检通过；前端 `chronicleDimensions` 7/7 通过。
   - **⚠️ 未了**：① **garbage in**：提取是事后的，正文没高光就抽不出——待做 **M11「writer 侧高光/名言配额」**；
     ② 存量老章的评论腔 why 不会自动修（需重跑提取或人工）；③ 名梗/口头禅维度未纳入编年史（`meme-lexicon` 是喜剧素材，两回事，
     要不要加 `catchphrase` 维度**待用户定**）；④ 本次未提交。
   - 详见 `docs/design/角色编年史升级-多维分层与素材质检.md` §十。

0p. **（2026-10-07 本会话）素材链路 T1→T6 六项改造完成**（详见 `docs/worklog/2026-10-07-T1至T6-素材链路定位校验兜底与省token.md`）
   - **回答用户 5 疑问**：①定位=**有**（`provenance.createdChapter/createdAt` 不可变；此前 `sourceChapter` 被每次更新改写→创建章节永久丢失）②交接校验=**有骨架但关键一环是空的**（输出契约只有"response≥10字"，`updates[]` 无结构校验）③兜底=**有三级但第一级静默吞**（解析失败只 warn，重试/门槛被绕过）④token=可大幅减少（实测材料管理投喂正文**压 56%**）⑤格式=**读已单点、写从未收口**（46 处手搓素材）。
   - **T1**：双策略失败 → 抛 `MATERIAL_MANAGER_OUTPUT_UNPARSABLE` + `materialManagerFailed` + 不写 processed/知识库（让 L2 重试/门槛/补跑真正接管）；顺带修 `{"updates":[]}` 被误判为解析失败。
   - **T2**：新增不可变 `provenance` + changeLog v2（4 种旧结构归一）；`materialRepository` 成为唯一语义写入 API；真实 PG **116 条已 --apply 回填**（0 条目丢失）；UI 元数据显示"创建/最近更新/出身"并标注存量推断值。
   - **T3**：`materialOutputSchema` 硬校验 type/name/action/content（此前 `action:"新增"` 会**静默什么都不做**）；违规只回喂违规条目做 1 次定向修复，且修复必须按 name 绑定（防绕过"每章最多3个新素材"）。
   - **T4**：形状不变量**下沉到存储单点**（storeTrim/storeCommon），46 处写入自动合规；新增闸门 `scripts/audit-material-shape.js`（接线检查 + 写入点基线冻结 + `--db` 真实抽样），**已接入 ci:check**。
   - **T5**：`enableMaterialPrecheck` 开关（**默认关**）+ 正文压缩；真实测量 **80106→35255 字（压缩 56%）**，可跳过章 0（本批数据都有信号）；含防"位置偏置丢信号"设计。
   - **T6**：`materialDepthBackfill` 多来源确定性回填（实体/KV→素材正文【标签】→编年史），只填补不覆盖不臆造；**真实数据四类深度键 1/40 → 7/40**；prompt 深度字段改必填 + 深度缺口告警。
   - **回归**：后端 **255 套件/3949 用例全绿**（基线 247/3877）；前端 17 失败=既有基线（entitycenter hook）；iron-law/hardcode(0)/词汇表(0)/装配入口 全通过。
   - **⚠️ 未了**：`npm run ci:check` 仍非全绿 —— 3 项**既有**检查在 HEAD 上就失败（`verifyStyleProfileSchema`/`verifyApiContract`/`verifyDocFreshness`，已用 git worktree 干净副本取证），需用户决定是否修；另修掉了同类的既有假红 `verifyMaterialMigration` 校验4（装配入口改名未同步）。
   - **开关与遗留**：T5 预判按项目开启；T6 深度键只做运行时回填，未批量回写实体。

0o. **（2026-10-07 本会话）S1→S8 施工完成：字段单一源与 Agent 协作闭环**（详见 `docs/worklog/2026-10-07-S1至S8-字段单一源与契约闭环施工.md`）
   - **用户拍板三项**：① first/second-reviewed **补进**状态机；② 字段注册表**一次性覆盖全部类型**；③ 契约深度键**真正生产**。
   - **S1 状态机单一源**（P0-A）：`first/second-reviewed` 补入 `ALL_STATUSES`（此前是"幽灵态"→门槛活锁/永久砖）；
     `chapterStatus.js` 升为真相源（标签/颜色/顺序/迁移表），`chapterStateMachine` 薄封装，前端常量改为生成器产物。
     新增闸门 `scripts/audit-vocabulary-consistency.js`（接入 ci:check）。
   - **S2 契约**（P0-C）：WARN/HIGH 不再阻断（仅 CRITICAL）；7 份 anyOf 收敛为 `@characterDepthKeys`；
     `buildStateJson` 真正产出深度键；**修复 KV 键不一致根因**（写素材 id / 读实体 id）→ 写入端统一实体 id
     + 迁移脚本 `migrateCharacterKVKeys.js`。
   - **S3 登记分诊**（P1-C）：registrar 拆 errors/warnings，`passed` 只看致命；新建未过类型校验降级 `unvalidated` 落库。
   - **S4 实体投影**（P1-D）：`entityProjection.buildCharacterEntityPatch` 单一投影；`hasMeaningfulValue` 防占位词覆盖；
     章节级更新回写实体中心（不再是大纲快照）。
   - **S5 字段注册表 R1**（P0-B）：`server/config/fieldRegistry.js` 聚合字段约束+深度要求+**别名**+**落点映射**（全类型）；
     校验用别名提取；生成端 prompt 并入必填标签；闸门加 check#1/2/3。
   - **S6 装配/门槛**（P1-A/E）：装配审计按 agent 名单逐一断言（去假阳性）；门槛拦截改"打 skipUntil 跳过并推进"（消活锁）。
   - **S7 字数**（P1-F）：首轮即下发结构化写满手法；`ensureSalvageBand` 保证 rejectMin ≤ targetMin−10%（可救区>0）。
   - **S8**：dataFlowSpec 补 organizer/knowledge-extractor、修 downstream；闸门加 check#6（与 StepRegistry 比对）；本 worklog 落盘。
   - **回归**：后端 **247 套件/3877 用例全绿**；词汇表闸门 **0 违规**；iron-law/项目标准/eslint 全通过。**已分 10 个 commit 提交**。
   - **遗留**：① reader 返修仍走旁路（未接主循环，改动面大）；② 存量项目需跑 `migrateCharacterKVKeys.js --apply`；
     ③ 计划书 §4.6 的真项目验收断言待实跑。

0n. **（2026-10-07 本会话）字段单一源 & Agent 协作完整性体检（只读，未改代码）**
   - **产物（下个窗口施工总图）**：`docs/design/字段单一源与Agent协作闭环（体检+计划书）.md`；会话记录 `docs/worklog/2026-10-07-字段与Agent协作完整性体检.md`。
   - **用户 5 疑问统一结论**：①实体中心角色字段缺=投影只在"建素材时同步一次"+merge 真值覆盖；②PG 映射表**确实没发给 agent**（`fieldRegistry*` 只被 `server/db/*` 消费，从无 prompt 注入点）；③流程**确实没闭环**（10 处字段词汇表互不引用、无一致性闸门）；④第一轮字数少=**量化扩写指令只发 round>1** + `rejectMin==targetMin` 无救区；⑤登记/agent 失败=校验标签对不上（实测 10/10 角色 `valid=false`）+ registrar 把告警当失败 + 契约深度键产不出来。
   - **本轮新发现 P0-A（用户尚未反馈，日志已发生）**：`orchestratorStepHandlers.js:69/92/129` 写入非法状态 `first-reviewed/second-reviewed`（不在 `chapterStatus.ALL_STATUSES`）→ `STUCK_STATUSES` 不覆盖 → 永不重置/永不再选/补跑只认 `approved` → 该章永久半成品，后续章被门槛活锁（`_kanding_server.log` 逐字吻合）。
   - **本轮新发现 P0-C**：`contracts/*.yml` 7 份重复 `stateJson.anyOf:[innerConflict/independentStance/fateArc/...]`，而 `agentMaterialHelpers.buildStateJson` 从不产出这些键 → CH2+ 七个 agent 被同一键卡死；且 `pipelineStepRunner.js:72` 把 WARN/HIGH 也当致命阻断。
   - **本轮新发现 P1-A**：`scripts/verifyMaterialAssemblyEntry.js` 是假阳性（只 grep `scheduleMaterials(`，不校验 agent 是否走装配入口）；实际 7 个 agent（material-manager/organizer/registrar/intent-planner/outline-generator/knowledge-extractor/consistency-constraint）绕过单点装配。
   - **计划书施工序**：S1 状态机单一源+一致性闸门 → S2 契约 severity/深度键 → S3 registrar errors/warnings 分诊 → S4 实体投影重建 → S5 字段注册表 R1 → S6 装配全覆盖+reader 返修走主循环 → S7 第一轮量化字数 → S8 dataFlowSpec/文档同步。
   - **待用户拍板 3 项**：状态命名（补进 reviewed 态 vs 改回 reviewing 子态）、字段注册表覆盖范围（character 8 字段起步 vs 全类型）、契约深度键（换实体已有键 vs 生产端真产出）。
   - **未提交**（本会话只读）。

0m. **（2026-10-06 本会话）勘定交接问题修复 + 同规模复建压测（详见 `docs/worklog/2026-10-06-勘定交接问题修复与复建压测.md`）**
   - **用户反馈修复**：编年史「基础/精简/完整都一个样」→ `chronicleDimensions` 增档位→维度映射（minimal=立场 / basic=立场+日常+心理 / full=8 维），`ChronicleDims/ChronicleTab` 按档位收敛展示并显示"展示：…"。
   - **P0-A**：新项目默认 `settings.chronicleLevel/worldScopeLevel='basic'`（修"招牌功能默认 0 数据"）。
   - **P0-C（角色卡空壳）**：`outlineEntitySync.syncCharacterToEntityCenter` 补齐 charisma/philosophy/entranceDesign/highlightScenes/craftStyle/quoteLibrary + 四件套；extractor 增【高光场景】【方言/语感/说话风格】标签；`backfillCharismaFields` 支持回落素材正文。
   - **P0-D**：新增 `itemStageParser`（纯函数）把素材【成长阶段】解析进 `item-definitions.propertiesJson.stages`；三处写入点接入；新增 `backfillItemStages.js`。
   - **#12/#13**：新增 `materialBatchPlan` 分批 + `materialGenerator.js`（从 outlineGenerator 拆出）；按 `(type,name)` 统一 upsert + 单条容错。复建实测 **10 角色**（旧版 4）。
   - **#17**：新增纯函数 `worldRefResolve`（name→id + 主世界别名/复合串），落库前归一；`normalizeWorldScopeRefs.js` 回填存量。
   - **P0-B 更正**：限知 confidence/sourceHow 的 UI 数据源是 `knowledge-access`（有数据），交接测的 `knowledge-facts` 本就不含认知维度 → 非缺陷。
   - **复建压测**：`7d3e3e66-9e8b-4135-8053-d6ddb8b645d8`（kanding/7 世界/full）→ 25 素材、10 角色工艺字段全非空、编年史 7 条 8 维、世界域 27、限知 15 带渠道、ch1-3 = 2430/2348/2039 字全 material-updated。
   - **回归**：后端 **240 套件/3839 用例全绿**；前端 **17 failed/932 passed（17 为基线既有）**；hardcode 0 / standards 通过 / eslint --max-warnings=0 通过。
   - **遗留**：P1-E 宠物/仆从素材类型（题材级）；世界域 LLM 自造世界名（要在 prompt 里限定只能选项目世界）；#14 门槛不自动续跑；#15 章长门禁偏松；复建项目大纲只出 5 章（疑远景色大纲）。

0l. **（2026-10-05 本会话）副本带出机制 + 编年史多维升级（P0-P2 开工，未提交）**
   - **副本归属/带出**（doc：`docs/design/实体中心-副本归属与带出机制.md`）：
     - 新增 `services/carryOutGate.js`（带出判定纯函数 `evaluateCarryOut`/`validateChannelTag`/`buildChannelTag`）；
     - `worldConstants` 增 `CARRY_OUT_POLICIES`(6 策略) + `buildWorld.exitMethod/carryOutPolicy/channelTag` + `validateWorld` 校验；
     - `crossWorldTraceConstants` +`carried-out` 动作、+character/pet/servant/consumable 类型、事件写 `channel`/`medium`；
     - `worldScopeExtractor`/`Runner` 抽存 `locationSlot` + 渠道/媒介；`entities` 增 `scopeWorldId/locationSlot/bindMedium`；
     - `scripts/backfillScopeOwnership.js`（默认干跑）回填归属。
   - **编年史 8 维 + 台词质检**（doc：`docs/design/角色编年史升级-多维分层与素材质检.md`）：
     - 编年史 4→**8 维**（日常/心理/立场/立场变化/高光/名言/事迹/关系）；quotes 升**四要素**(带 why)；
     - 新增 `services/validateQuotes.js`（四要素质检+去重）、`services/entityCraftReflow.js`（编年史→实体回流 `quoteLibrary`/`highlightScenes`）；
     - `entities` 增 `highlightScenes`；`materialDepthSpec` 增「高光场景」；
     - 前端 `ChronicleComponents` 增 `HighlightsSection` + 兼容对象型 quotes（避免渲染对象报错）。
     - `scripts/designCharacterCraft.js`（人物工艺体检 + 设计模板，只读）。实测：现有项目**所有角色（含 5 主角）工艺字段全空**。
   - **记录改优先 cmd**：PROJECT_STANDARDS §十/§B、项目身份与硬约束、sop/04/09/11、CLAUDE/AGENTS、ARCHITECTURE
     由"禁 PowerShell / 用 .ps1"改为**优先 cmd**；新增 `scripts/registerBackupTask.bat`（cmd 原生，ASCII+CRLF，三分支验证通过），
     旧 `registerBackupTask.ps1` 标注弃用（**未删**，按约定删文件需用户确认）。
   - **字段落点**：新增字段全部走各表 `data` JSON 列（无需 DDL/迁移）；`fieldRegistryCharacter` 未加列。
   - **回归基线**：后端 **237 套件/3820 用例全绿**（较基线 +8 套件）；前端 vitest **17 failed/921 passed（与基线一致，0 新增失败）**；
     audit-hardcode 0 issue；audit-iron-law --pre-deliver 无违反；改动文件 eslint --max-warnings=0 通过。
   - **UI（与后端同步，已实测）**：新增 `WorldContractPanel`（世界通行契约：策略/渠道标签/离开方式**可编辑**）、
     `OwnershipSection`（角色详情「副本归属/带出」+ **试算带出** 调后端 `POST .../carry-out-check`）；
     宠物/仆从展开显示归属/位置；`TransitionTimeline` 显示渠道/媒介；`buildWorldScopeView` 把带出违规挂到章节事件（ViolationPanel 可见）。
     **Playwright 实测**：契约面板渲染、试算带出返回"✅ 允许带出"、**0 console 错误**。
   - **UI 重设计（用户反馈 2026-10-05）**：
     ①「世界域」拆 4 个子标签（世界与归属 / **通行契约** / 穿越事件 / 势力），**通行契约独立成栏**、每个世界一行带归属数可就地编辑；
     ②「编年史」重写为**多维视图**：维度筛选条（全部/立场/立场转变/心理/日常/高光/名言/事迹/关系，各带计数）+ 按维度/按章节切换
     （`chronicleDimensions.js` 纯函数 + `ChronicleDims.jsx` 组件）。
     实测：通行契约 11 行归属数正确、编年史 chips=9/维度卡=4，**0 console 错误**；前端 **17 failed/930 passed（17 为基线既有失败）**。
     ⚠ Vite 长跑会缓存污染返回旧模块 → 改前端后如界面不更新，`node scripts/killPort.js 5173` 后重启 `npm run dev`。
   - **遗留（未做完）**：带出**硬阻断**接 `materialGate` 装配（现为软门禁）、sop/12 §八 增"台词/高光"验收项、
     LLM 自动人物工艺生成。

0k. **（2026-10-04 本会话）实体中心三处用户反馈修复（前端，未提交）**
   - **① 装备卡片"重叠 + 宽高不一致"（真实缺陷）**：根因是**全站缺 `box-sizing: border-box`**，
     而 `categoryBrowser.css` 里 `.cb-cell > * { width:100% }` 把 22px padding 叠加在 100% 之外
     → **实测单元格 274px / 卡片 298px**，右侧压住相邻卡片（在 1641 视口下实测 **5 对卡片几何重叠**）。
     修法：`.cb-cell > *` 补 `box-sizing:border-box` + `.cb-list` 改 `align-items:stretch` + 卡片 `height:100%`
     → 复测 **卡片统一 274×78、重叠 0 对**。线索道具等复用 CategoryBrowser 的 tab 同步受益（实测 0 溢出/0 重叠）。
   - **② 装备详情"点击后右边没数据"**：`item-definitions` 双存止血后只留 `materialId`，四级描述为空，
     `densitiesOf` 未读素材正文 → 详情栏只剩"暂无描述 / 暂无分阶段数据"。修法：`densitiesOf` 的「概要」级
     回落 `material.description/currentContent`（SSOT 仍在素材），占位文案改为面向用户的
     "该条目暂无分阶段属性/特效数据，以上为素材概要内容"。实测选中 白事堂·黑色兽皮纸 后右栏显示素材正文+元数据。
   - **③ 限知改树状（用户诉求）**：`tags`… 新增 `knowledgeTreeBuild.js`（纯函数，人物轴/事件轴）+ `KnowledgeTree.jsx`
     （两级可折叠 + 展开/折叠全部）；人物轴 一级=人物→二级=确信/怀疑/误信/未知→叶子=事实；
     事件轴 一级=事件→二级=获知渠道（亲眼/听说/推理/发现…）→叶子=知情者。
     `SOURCE_HOW_LABELS` 补全模型返回的口语渠道（observed/heard/read/recalled/self_knowledge/agreed）避免裸英文。
     实测：人物轴 15 个一级节点（沈砚 60 条），事件轴 94 个一级节点；折叠全部=0 叶子、展开全部恢复、0 控制台错误。
     新增 `__tests__/pages/knowledgeTreeBuild.test.js`（14 例）。
   - **回归基线**：前端 vitest **17 failed / 921 passed**（与交接卡记录的 17 全在 entitycenter/* **完全一致，本次 0 新增失败**）；
     铁律/硬编码（0 issue）/项目标准（0 error）通过；改动文件 `eslint --max-warnings=0` 通过。
   - **遗留**：`KnowledgeFactGroup.jsx` 的默认导出（事实大卡）已无人使用（仅剩 ConfidenceBadge/SourceBadge 被复用），
     清理与否待确认（删文件按约定需用户同意）。

0j. **（2026-10-01 本会话）藏经阁重设计 + 运行看板 + 全书设定（3 个前端交付 + 2 个真实缺陷修复）**（新窗口优先读本节）
   - **藏经阁重设计**：新增 `services/libraryCompleteness.js`（完整度判定）+ `GET /api/library/sources`（提取来源）
     + `/index` 增补 completeness/sourceNovel 并**默认"有内容优先"排序**；前端拆出
     `libraryTreeBuild.js`(纯函数)/`LibraryStatsBar`/`LibraryFilters`/`SourceList`/`TechListItem`/`LibraryTree`/`LibraryDetail`，
     默认视图改「按来源」。**实测：207 条技法中 184 条是全空壳**，现在一眼可辨、可筛选、可降权。
   - **运行看板（新页 `/progress`）**：`services/pipeline/progressView.js`(纯函数) + `GET /api/pipeline/progress/:projectId`
     （一个端点取齐进度/当前步骤/轮次/耗时/时间线/Agent 统计）。诚实标注：日志在步骤结束时写入 → 耗时为近似值；
     实测部分步骤 totalMs=0 → 显示"未计时"而非 0。
   - **全书设定（新页 `/story-bible`）**：类型(只读)/子类型/题材画像/走向/风格画像/目标章数字数 +
     角色方言/语体/位面势力/性格背景编辑；方言语体下拉复用 `/api/flavors/dialects|speech-styles`。
   - **修掉的真实缺陷 ①**：`DataContext` 单例缓存**无 TTL 且写入口从不失效** → 改项目/素材后运行中的 agent 读到旧值。
     实测三步复现（不失效缓存读到旧值，失效后读到新值）；已在 4 个写入口补 `resetDataContext`。
   - **修掉的真实缺陷 ②**：`--accent-primary`/`--card-bg`/`--input-bg` **全站未定义**（真实名 `--text-accent`/`--bg-card`/`--bg-input`）
     → 大量 `background` 声明整条失效（实测进度条 `backgroundImage:"none"`）。本轮 5 个文件纠正 65 处。
   - **回归基线**：后端 **229 套件/3763 用例全绿**；UI 巡检 25 页，新增/重设计页 **0 问题**；
     铁律/硬编码/级联/项目标准/apiRegistry/数据源一致性 0 error；前端复杂度 0 error。
   - **观察项**：后端曾一次异常退出（0xC0000409）**未复现**（同路径反复压测正常），建议单独立项；
     Vite dev server 长时间运行会缓存污染（返回空模块），重启即恢复。

0i. **（2026-09-30 本会话）外部评审 P0 兜底四件套：备份 / 预算熔断 / 长程闸门 / 藏经阁修复**（新窗口优先读本节）
   - **P0-1 数据灾备（此前为零）**：`scripts/pgBackup.js` + `lib/pgBackupCore.js` + `tests/unit/pgBackup.test.js`(18)。
     支持 `--dry-run/--list/--verify/--restore-test/--keep/--out`；产物 `backups/pg/`（已 gitignore）。
     **实测：备份 5.87MB/40表 → sha256 校验 → 恢复演练临时库 40 表行数完全一致 → 临时库已清理**。
     计划任务外壳 `pgBackupTask.bat` + `registerBackupTask.bat`（**需用户显式注册**，未自动安装；cmd 原生）。
     新增 [docs/sop/11-数据备份与恢复.md](sop/11-数据备份与恢复.md)。
   - **P0-2 项目预算熔断**：`config/systemConfigBudget.js`(PROJECT_BUDGET) + `services/pipeline/projectBudget.js`
     + `llmBudgetGuard.js` + kv `project-spend`（锁保护自增）+ `stopConditions.js` 优雅停机
     + `GET|PUT /api/maintenance/budget/:projectId` + `scripts/backfillProjectSpend.js`。
     **闸门下沉到 `services/llm.js` 的 `chat()`**——实测只在 agentRunner 拦会漏：
     限额设 1 token 时 `generate-materials`（outlineGenerator 直连 llm.chat）仍跑通；下沉后同一请求被拦且**零 token 消耗**。
     回填实测：20章项目累计 **1,799,517 tokens / ¥3.60**（与交接卡"1.80M/18章"吻合）。
   - **P0-3 长程验证闸门**：`scripts/run20ChapterE2E.js` 支持 `--chapters N`（默认 20，可跑 100 章）
     + **成本闸门**（预估超 2M tokens 必须 `--yes`）+ `--dry-run` + 收尾自动拉取真实消耗闭环。
     **未执行 50~100 章实跑**：100 章 ≈ 1000 万 tokens ≈ ¥20 / 3.3 小时，需用户确认后执行：
     `node scripts/run20ChapterE2E.js --chapters 100 --yes`
   - **P0-4 藏经阁修复**：`useLibraryState` 深度分类 Bug（原按色值比部门名，恒不相等 → micro 永久失效）改为
     用服务端 `worldviewDepth`（SSOT），部门映射仅兜底；`expandAll` 覆盖深度视图 key；
     反馈接口回填技法名/部门（此前前端只显示裸 ID）；Top/Bottom 不再重复；新增回归测试。
   - **回归基线**：后端单测 **227 套件 / 3744 用例全绿**；铁律自检无互斥；硬编码 0 issue/0 超行；
     级联 0 CRITICAL；apiRegistry / 数据源一致性 / 项目标准 0 error；文档新鲜度 18→13（余为历史记录误报）。
   - **存量问题（非本次引入，已核实）**：前端 vitest 有 **17 个失败**（全在 `pages/entitycenter/*`，
     与本次改动零重叠）；`verifyApiContract` 35 errors（改动前后一致）；13 条文档新鲜度误报（历史 worklog/陷阱清单）。
   - **测试项目已清理**：本次建的 2 个一次性项目已删（含级联 `project-spend`），`scanOrphans` 0 孤儿；
     验证项目 `5d512269` 的预算限额已重置为不限制。

0h. **（2026-09-29 本会话）素材单一源 P0-1/2/3 落库 + P1-4 计划书立项**（新窗口优先读本节）
   - **P0-1** `5a4763a`：与题材无关字段源头过滤（`stateKVHelpers` 兜底改题材中性字段，去掉 hp/combatPower）。
   - **P0-2** `7f6d0a7`：素材生命周期 `materialLifecycle.js`（`state/archived/activeFromChapter/activeToChapter`）
     + 加载链按章过滤（`materialIndex`/`materialBudgetCalc`）+ 迁移脚本 + 实体中心卡片归档/区间 UI。
   - **P0-3** `63e45a0`：双存止血——`item-definitions` 不再复制素材内容（只留身份+`materialId`）、
     按 name 幂等复用；世界观主题归一 `worldviewTopics.js`；`scripts/verifySourceUniqueness.js`（体检）
     + `scripts/migrateDefinitionContent.js`（干跑/--apply）。实测：定义含内容 27→9、已回指素材 18。
     单测 **217 套件/3615 用例全绿**。
   - **⚠ P1-4 计划书已立项（用户本轮诉求，下个窗口直接开工）**：
     `docs/design/章节因果门槛与单点素材装配（计划书）.md`。核心判断：**"agent 各自拼素材"不是根因，
     根因是章节因果顺序被破坏**——① 规划超前（一次规划 20 章/补 2–5 章，
     `pipelineInit.js:114`、`outlineSupplementor.js:12`）；② 跳章执行（冷却/失败章不阻塞后续章，
     `chapterScheduler.js:75`、`batchExecutor.js:75`）；③ 补跑只认 approved（`orchestratorPreflight.js:17`）；
     ④ 兜底静默（补跑失败直接伪 `material-updated`，`materialManagerCatchup.js:36`、`orchestratorPreflight.js:34`）。
     → 施工顺序 **P1-4a 章节门槛 materialGate → P1-4b 远景粗纲/就近细纲 → P1-4c 单点装配
     materialStateAssembler（+provenance/gaps）→ P1-4d 密度策略 densityPolicy → P1-4e 缺口告警 UI → P1-5 体检面板**。
     开工第一条命令见该文档 §十一。
   - **✅ P1-4a 已完成（本会话）**：新增 `server/services/pipeline/materialGate.js`（纯判定 + `assertChapterReady`
     补跑/落盘 + 显式债务 `materialDebt`）；接入 `infinite/batchExecutor.js` 主循环（未通过则告警+等待，**不跳章硬写**）、
     `core/pipeline/orchestrator.js` 章节入口、`pipelineStepRunner` writer 步兜底网；
     `chapterErrorHandler` 新增门槛分支（回 outlined、**不罚本章重试/不进冷却**）；
     收口 `materialManagerCatchup.js` / `orchestratorPreflight.js` 的**静默伪 material-updated**（改为保持缺口 + ERROR 告警）。
     集成期顺带把所改文件的 P1-Q1 状态字面量收敛为 `STATUS_VALUES.*`。
     测试：materialGate 16 + pipelineStepRunnerGate 2 + orchestrator/Preflight 各 +2/+1；**219 套件 / 3636 用例全绿**。
     真实数据只读演练：7 项目"下一章"全部放行（无误阻断），模拟前章 failed-skipped → 正确拦截并给出等待原因。
     **下一步 → P1-4b（远景粗纲 `scope:'far'` / 就近细纲 `refreshNearOutline`）。**
   - **✅ P1-4b 已完成（本会话）**：两档大纲落地——
     远景侧：`outlineTemplateBuilder` 新增 `FAR_OUTLINE_HINT`（禁写设定细节）+ `buildOutlineMaterialDigest(materials, scope)`
     （**far 只给名录**，detail 才带内容摘要；原内联逻辑抽出以便单测）；`generateChapterOutlines(..., options.scope)` 默认 `far`
     （安全默认，所有既有调用点无需改签名）。
     就近侧：新增 `server/services/pipeline/chapterPlanRefresh.js` → `refreshNearOutline(projectId, N, {chapterId, force, onStep})`，
     开写前用"此刻已归档素材 + 上一章节选"把粗纲细化为 `chapter.outline`（粗纲存 `farOutline`）；
     **幂等**（`outlineRefinedChapter`）/ **失败不阻断**（保留粗纲 + `outlineRefineFailed` 锚点）；题材偏移只 WARN 不阻断。
     接入 `orchestrator.run()` 门槛之后、`handleChapterIntent` 之前，且**刷新后重读章节**再取大纲（否则下游仍拿到粗纲）。
     测试：chapterPlanRefresh 13 + outlineScopePrompts 12 + orchestrator +3；**221 套件 / 3664 用例全绿**。
     **下一步 → P1-4c（单点装配入口 `materialStateAssembler`：包 `scheduleMaterials`，加 `gaps/provenance/density`）。**
   - **✅ P1-4c 已完成（本会话）**：单点装配入口落地——
     新增 `materialStateAssembler.js`（装配+记账+落盘一处完成，blocked 缺口 ERROR 报警）+ `materialAssemblyReport.js`
     （**纯函数**：`gaps` 三级 blocked/warn/info、`provenance` 来源追溯、`density` 密度事实、`summary` 供门槛/UI 消费；
     `materialNeeds` 解析为空 → 记 `context-unresolved` blocked，**不再静默返回空素材**）；
     调度器不再自己记账（只装载 + 回传 `context`）；**装配入口已收敛：Agent 步 6 个 + 核查脚本 3 个全部改走同一入口**，
     新增只读审计 `scripts/verifyMaterialAssemblyEntry.js`（0 绕过）；`materialCreateAction`/`materialActions`
     统一写 `lastWriter/lastUpdatedChapter`（口径见 `config/materialWriteOwnership.js`）；
     装配记录扩展 `gaps/provenance/density`（不新增表）。
     测试：+33（report 16 / assembler 8 / writeStamp 7 / recorder 2）；**224 套件 / 3697 用例全绿**。
     真实数据只读实测：脱口秀 ch7 `blocked=1(relationship:relations-empty)`、键盘飞剑 ch7 `blocked=0`，provenance 带素材ID与写入章。
     **遗留（未做，已记入计划书）**：blocked 的处置（补跑/往 prompt 注入【素材缺失声明】）、素材写入权全仓审计（~60 处，P2）。
     **下一步 → P1-4d（密度策略 `config/densityPolicy.js` + `densityResolver.js`，装配记录写 `densityReason`）。**
   - **注意**：P1-4 **不是推倒重来**——`agentDeclarations`/`contextCommander`/`agentMaterialScheduler`/
     `contextAssemblyRecorder`（装配图）是既有地基，只在其上加"顺序保证 + 缺口暴露 + 密度显式化"。

0g. **（2026-09-27 本会话）积压批次落库 + 实体中心 UX 重构（P1–P5）**（新窗口优先读本节）
   - **积压落库**：跨三批会话的未提交改动走五关门禁提交为 `f3e001d`（207 文件；含藏经阁PG化/
     Token 账本面板/许可证机器码/字数与轮次修复/拆超 200 行与超 100 行函数）；运行时 `data/` 未入库。
   - **实体中心 UX 重构**（用户诉求"多个 tab 大杂烩、要更人性化"）：
     P1 通用分类浏览器→装备/功法/宠物/仆人；P2 限知分类+人物/章节/搜索；P3 世界域归属归一+可读化；
     P4 关系复合聚合+中心视图；P5 摘要/状态追踪分主次；
     **P6（用户第二轮反馈返工）自研 SVG 人物关系图**（中心+放射+带标签箭头，点谁谁变中心展开，带返回栈）
     + 世界域实体按 (类型,名字) 跨章去重（137→112，卡片显 Ch2–16）+ 关系按姓名合并重复人物节点。
     **P7（用户第三轮反馈）**：① 归属标记（ownershipUtils：角色/组织·势力/未归属，覆盖装备·功法·宠物·仆人，
     卡片显「归属：X（角色/组织）」）；② 关系图可读性返工（一对一线+标签径向旋转+中心名入圆内，解决标签覆盖）；
     ③ 状态追踪垃圾数据**来源定位**（`server/config/genreStateFields.js` 通用修仙/游戏字段模板带默认值 +
     from/to 关系形状字段误入）→ 前端默认隐藏空值/无关字段并在卡片标注，沈砚 28→14 字段。
     > 管线侧根因（未排期）：不持久化默认值字段；题材 schema 按项目题材取，勿回落通用模板；查 from/to 写入源。
   - **注意**：`client/src/pages/entitycenter/*` 新增了 utils（categoryUtils/knowledgeUtils/worldScopeUtils/
     relationUtils/summaryUtils/stateTrackUtils/ownershipUtils）与组件（CategoryBrowser/WorldCard/RelationGraphView/
     RelationPairRow 等），均 ≤200 行、useState ≤5；Playwright 探针脚本在 `tmp_*.cjs`（gitignored）。
   - **提交**：f3e001d / e18aaf0 / c1d34b1 / 75d9c39 / a40dd54 / 4a56e49
   - **验证（实测）**：单测 **214 套件/3601 用例全绿**；vite build 通过；`verifyFrontendComplexity` 0 error；
     Playwright **13 个 tab 全部 0 console 报错**。
   - **顺带修的真实缺陷**：卡片外层 button 内嵌按钮（React 告警）；世界域 `worldId` 恒为 main-world 导致
     "0 归属"、实体名空白/穿越统计错（字段 entityName/status 与实际 name/isVisitor 不符）；
     关系中心视图取 characters[].id 与关系 UUID 不同源 → 0 结果。
   - **待办（下一轮）**：P6 道具 `itemRole`(常驻/一次性/伏笔)+`foreshadowChapterRange`+归档+
     伏笔按章节情景加载；编年史/跨世界溯源/系统 三个 tab 未做同类改造。
   - **⚠ 重规划已立项（用户第三轮诉求，见 `docs/design/实体中心-重规划（素材单一源与生命周期）.md`）**：
     实体中心定位=**素材管理与预加载**；要**单一源**（实测装备 18/19 双存、世界观 30+34 双存、
     角色 ≥4 源）、**单点预处理入口**（其他 Agent 不各自拼）、**生命周期/章节区间**（报废/牺牲不回收
     是 token 黑洞）、**与题材无关字段过滤**。
     分批：**P0** ①✅题材中性字段兜底（已做）②✅**生命周期落在被加载的 `materials`**
     （新增 `materialLifecycle` 纯函数 + `materialIndex/materialBudgetCalc` 按章过滤 + 迁移脚本干跑 +
     装备/功法卡片「生命周期/归档/章节区间」单点写 materials）③✅**双存止血**（定义不再复制内容+回指 materialId+幂等；世界观主题归一防碎片；
     体检 `verifySourceUniqueness` + 迁移 `migrateDefinitionContent` 干跑/apply）；
     **P1** 单点装配 `materialStateAssembler`（⬜待做）/ 素材体检面板（脚本已先行）/ 世界观历史主题迁移；
     **P2** 其余迁移去重脚本。**下一步建议 P1-4（单点预处理入口）**。
     > P0-3 实测：装备/功法双存 18 → 定义含内容 27→9、已回指素材 18；世界观 KV 主题 34（写入已归一，历史待迁）。
     > 落点修正：实测 `item-definitions` 管线不读（只有 UI/迁移脚本用），故生命周期改落 `materials`
     > （否则省不到 token）。实测该项目素材 106 条：已归档 51、区间 0（区间是缺的杠杆）。
   - **已知抖动**：`pipelineMetricsPercentile.test.js` 的"getSlowestSteps 按 p95Ms 降序"偶发失败（p95 并列），复跑即过。

0f. **（2026-09-26 本会话）Token 去向面板上线 + 许可证失效根因已修 + 实体中心分主次**（新窗口优先读本节）
   - **许可证"功能需要专业版会员"根因**：`getMachineId()` 把 `os.totalmem()` 纳入指纹，换内存即失效 →
     抽到 `server/services/machineFingerprint.js`（优先 Windows MachineGuid / Linux machine-id，**不含内存**），
     已重新激活（`/api/license/status` 恢复 `pro`），陷阱 #116。
   - **Token 去向面板** `/token-ledger`：每章 token、分段/步骤占比、场景筛选、逐章趋势、截断/返修/效率告警、
     逐章明细可展开到每次调用。上报单点=`agentRunner`，存储=kv `token-ledger`（每次调用一条），
     历史回填=`node scripts/backfillTokenLedger.js --apply`（已回填 261 条，7 个项目）。
   - **实测首个战果（20章项目）**：1.80M tokens/18章；分层记忆 40%、Agent提示词 39.7%（**31 处截断丢 9.0万**）、
     返修员占步骤 30.4%；第16章 67.4% 花在返修轮。
   - **实体中心**：角色按等级分组（主角/配角/NPC）+ 默认按重要度排序 + 分级视觉 + 搜索/筛选 + 未选中时显示总览；
     顺手删掉 `GenreStateSection` 的死请求（题材 id 当项目 id → 每次 404），陷阱 #117。
   - **回归基线（实测）**：单测 **213 套件 / 3585 用例全绿**；vite build 通过；前端复杂度 0 error；
     级联删除 0 CRITICAL；Playwright 实测 Token 页与实体中心 0 报错、404 归零。
   - **本轮改动未提交**（工作区）。

0e. **（2026-09-21 本会话）用户反馈两问题已修 + 20章E2E通过 + 6项新需求落地**（新窗口优先读本节）
   - **实体中心多主角已修**：`entity_registry.roleLevel` 原是单向棘轮只升不降 → 改为跟随同步源；
     实测 丧仪司项目从"3个主角"恢复为 `1主角+3配角/NPC`；新项目20章全程保持 1 主角。
   - **执行日志轮次已修**：新增 `server/shared/runContext.js`(ALS)，`store.setItem` 单点给 reviews 补 `runRound`；
     硬门槛/执笔失败也写审查留痕；前端显示"第x轮(累计y)"。实测新项目 137 条审查 **100% 带 runRound**。
   - **新 E2E 验证项目**：`逆江湖_苍生为局_20章` **5d512269-3b0b-4e33-bb7d-ac7310bbe73d**，**20/20 章通过**，
     52,925 字（均2,646）；`verifyFiveChapterE2E` 46/46 OK、`verifyDataFlow` 0 FAIL、`verifyNewProject` 全通过。
   - **本轮修掉的真实缺陷**（详见 worklog 表格，16 条）：执笔字数无恢复路径 / 字数门禁四道且末道不可覆盖 /
     润色砍字数 / 时间轴上下文无限递归 / 素材表多主角 / 6个接口500 / 任务看门狗状态无人识别 / 主线任务恒为0 …
   - **新能力**：`scanOrphans.js` 一键扫描清理（已清 3,568 行孤儿）、`/api/maintenance/orphans|runtime`、
     LLM 超时与慢请求预警（health 暴露 `llm-latency`/`pipeline-tasks`）、角色归属按等级分级、
     长度锚点（大纲四段节拍 + 执笔中途检查点）。
   - **回归基线（实测）**：单测 **222 套件 / 3,691 用例全绿**；`npm run check` **0 失败/5警告**；铁律自检无互斥。
   - **dotenv 已全量加固**：46 处补 `override:true`（原56处只有10处有），用户级旧环境变量不再遮蔽 `.env`。

0d. **（2026-09-18 第三批）轮次双显示 / 深度巡检 / 防膨胀 / 日志可读性**（新窗口优先读本节）
   - 轮次双显示：日志新增 `runRound`（本次运行第几轮），UI 显示"第1轮(累计6)"；
     final-editor 多轮覆盖判定改用相对轮次（修掉"续跑章节首轮失败就被系统覆盖通过"）
   - 每轮清理下游输出时写 `round-start` 日志（解释"定稿后又回初审"）
   - 素材登记失败已修：`entityCenter.createEntity` 不存在 → 改 `getOrCreateEntity`
   - 知识抽取补 passed+中文摘要（原先只有 created/errors，UI 看不出成败）
   - 深度巡检接入每章：免费校验，跌破"要求×0.7"才 LLM 补全（`enforceChapterDrift`）
   - **防膨胀策略**（config/materialContentPolicy）：人设类永不删 / 状态类覆盖 /
     事件类滚动窗口5条 / 单素材上限（character 4000字）；超限按 事件→未知→人设截断 裁剪
   - Agent输出详情滚动：滚动容器改放内层元素（`.scroll-area`），修 `cyber-card{overflow:hidden}` 裁剪
   - 实测 ch4：茅十七 1418→1516字、白姑 767→928字（不降反增）；单测 3580 全绿

0c. **（2026-09-18 第二批）装配图中文化 + 执行日志补章号/轮次/细节 + 关系与角色深度修复**
   - 装配图前端全中文（服务端下发 typeLabel/statusLabel/relevanceLabel，唯一数据源）
   - 执行日志：`tagLogMeta` 统一补 round/chapterNumber；步骤日志带 detail（结论+问题）；
     失败日志带"当前字数/最低要求/失败步骤"；时间格式 `2026-09-18 22:13:05`
   - 人物关系：organizer prompt 强制输出 relationshipChanges（≥2角色互动不得为空）；
     relationship 纳入 neverDropTypes（题材门禁不得排除）；消费端读 character-relations
   - 角色素材深度：materialDepthEnforcer 批量补全（复用此前零调用的 materialDepthRepairPrompt）
   - **素材内容合并（陷阱清单P0 已修）**：materialMarkdownExtractor/materialActions 统一走
     mergeWithBaseline（initialContent 为基座），章节更新不再冲掉人设；
     实测 茅十七 1286→1418字（跑完一章后反而增补）
   - **素材误归档已修**：保护主角从 name.includes('主角') 改为语义判定（roleLevel 等）；
     `scripts/repairArchivedMaterials.js`（默认干跑，支持 --merge-content）修复历史数据
   - 分层记忆收敛：注入源=memory-pyramid+卷摘要；L0-L4 仅 UI 诊断
   - 五章E2E复验：5/5章 material-updated（2628~3726字），31项核验 29 OK/2 WARN/0 FAIL

0b. **（2026-09-18 本会话）上下文地基已修复 + 上下文装配图上线**（5个commit，见下方提交清单）：
   - 修复 calculateBudget 恒判超限 → 不再全量降级L0（人设/伏笔/关系不再退化成索引）
   - 上下文电路图更名为**上下文装配图**（`/context-assembly`，页面+API；逐章显示用了哪些素材、
     什么层级/信息密度、哪些数据未接入或丢失）
   - 新增 `scripts/verifyDataFlow.js`（全链路数据流通核查）与
     `scripts/verifyFiveChapterE2E.js`（五章E2E核验）、`scripts/runFiveChapterE2E.js`
   - 修复字数系统性不足：writer prompt 场景下限硬编码1950字 vs 硬性最低2500字自相矛盾
     → 改为按 wordConfig 派生（`config/writerLengthPolicy.js`）
   - 五章E2E项目 `85c5b21a-2f4e-49ff-aa44-c887be977f1e`（丧仪司_五章验证，原创殡葬题材）
     5/5章 material-updated（2501~3720字），核验 26 OK/2 WARN/0 FAIL
   - **待决策**：①人物关系生产端断链（关系表无生产者，消费端已修）②角色素材深度<400字
     ③分层记忆L0-L4冗余（长期记忆由 memory-pyramid 承担）④~~licence机器绑定含内存导致换内存即失效~~（2026-09-26 已修，见陷阱 #116）


0. **⚡进行中任务（2026-09-06中断）**：新项目E2E验证到ch1续跑前一步。**下个窗口第一条命令和全部上下文在 `docs/worklog/2026-09-06-token-plan接入与新项目E2E.md` 的"恢复锚点"节**（含16个未提交文件清单）。16文件改动全部测试绿但**未提交**。
0a. **LLM已切阿里云Token Plan网关**：`sk-sp-`key + `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` + qwen3.8-flash（.env已配）。旧coding.dashscope端点已对非Coding Agent返回405。速度：素材24s/大纲13s/单章~2min（本地27B的1/25）。
0b. **历史悬案破案**：此前"新key两个端点都被拒"= Windows User级环境变量残留旧38字符key遮蔽.env（dotenv默认不override）。已修：server入口dotenv加override:true。**建议用户删User级旧变量+轮换对话中明文出现过的key**。
0c. **字数退回死循环根因链已修**（与本地RUN3三连败同根因）：①含糊扩写指令→统一构建器expansionInstructionBuilder（显式数学量+清单）②rejectMin==minWords可救区为0→80%抢救区升级reviser ③reviser扩写+0字标passed白烧轮→步内升级重试 ④敏感词反馈不含命中词（与审计系统不对齐）→补齐 ⑤熔断器绝对轮次→相对轮次 ⑥执行日志缺章/轮+5归档步骤英文→persistLog单点补全+前端映射。
1. **项目骨架健康（2026-08-27复验）**：单测 205套件/3444用例全绿、铁律自检无互斥、硬编码0、级联0、服务3001健康、PG正常（7项目/82章）。问题都是"漂移型"，做纠偏即可。（09-06复验：单测3459全绿）
2. **LM Studio本地模型已接入（2026-08-27）**：`qwen3.8-27b`（256K上下文，unsloth Q8_K_XL）@ `http://192.168.1.102:1234/v1` 全流程可用。路由：配置了 `LMSTUDIO_API_KEY` 时11个步骤全部走本地，删key自动回落阿里云。**本地模型是思考模型且API层关不掉思考**，靠 `noThinkMarker`（` /no_think`）在请求构建层统一治理（陷阱#94）。生成速度约6 tok/s，单章预计20-40分钟，属硬件现状。
3. **uncensored-MTP变体加载崩溃**：`qwen3.8-27b-uncensored-hauhaucs-aggressive-mtp` 在LM Studio加载即崩（exitCode=0xC0000409），疑似显存同驻冲突或MTP构建问题；当前验证与生产均用标准版。
4. **文档记录不完全可信**：此前由降智模型编写，陷阱清单等需以代码和测试实测为准。
5. **文档体系已治理（2026-08-27）**：新增防失忆协议 `docs/sop/10-上下文交接规范.md`（三层记忆架构：交接卡/工作日志/长期知识）；CLAUDE.md与AGENTS.md接手指引已对齐；任务级工作日志在 `docs/worklog/`。
6. **铁律系统**（2026-08-23）：规则唯一定义源 `scripts/lib/ironLawRules.js`；场景化 block/warn/skip 处置；`node scripts/audit-iron-law.js --self-check` 做互斥自检。改规则必须先过自检。

## 二、已完成（全部过五关pre-commit门禁）

### 2026-08-27（本会话）

| 提交 | 内容 |
|---|---|
| b8f008a | LM Studio接入+思考治理+文档治理（19文件）：lmstudio provider本地优先、/no_think+系统级输出纪律双保险、消除writer模板与output-novel模块矛盾输出指令（思考爆炸根因）、超时配置化(供应商级30min)、错误捕获增强、context budget补256K、sop/10防失忆规范、AGENTS/CLAUDE对齐、worklog机制、单测+13全绿(3444) |
| （进行中） | 真实小说端到端验证：项目"守灵人"(f91ea3b0)。run1/run2已证伪旧代码(600s超时、思考8184tokens吃光预算)，run3跑修复后代码（进度详见 docs/worklog/2026-08-27-lmstudio接入与文档治理.md） |

### 2026-08-23

| 提交 | 内容 |
|---|---|
| 7a79780 | .env/密钥/产物移出git跟踪，.gitignore强化（含6641个node_modules文件） |
| fe5b3e4~20a0266 | 悬空重构代码分4组落库（文档/后端/前端/基建） |
| 3d4ec9d | 铁律系统重建：共享规则+场景分支+互斥自检+钩子统一(.githooks) |
| 2abb66f | 4个超200行文件拆分（零行为变更）+ 过期题材测试修复 |
| baf3b66 | 2个超100行函数拆分（orchestratorStepLoop/agentPromptAssembler）+ eslint测试目录豁免修复 |
| 05ff55b | SESSION-STATE交接卡机制建立 |
| 66fef17 | modelBakeoff.js 模型对比评测脚本 |
| b86d84b | UI大面积加载失败修复：全局限流200→1200/分（123处429根因）+ settings页8处裸fetch改鉴权api（401根因） |
| 5f6af62 | 桌面启动/停止按钮（launcher/，桌面有副本） |

## 三、运行时状态

- 后端3001：`npm start`（scripts/serverStart.js），PostgreSQL(USE_PG=true)，健康
- 前端5173：`cd client && npm run dev`，Vite+React19
- **LLM：aliyunCoding/qwen3.8-flash @ token-plan网关（.env的ALIYUN_CODING_BASE_URL）**；LMSTUDIO_*已注释停用（27B太慢，用户已决策弃用为主力）
- **当前主力验证项目**：**`逆江湖_苍生为局_20章` 5d512269-3b0b-4e33-bb7d-ac7310bbe73d**（20/20章 material-updated，数据完整）
- 旧验证项目：`仙师好评_云端E2E` f48c77ad…（已弃用不复跑）；守灵人f91ea3b0（用户决策弃用）
- **孤儿数据**：已用 `node scripts/scanOrphans.js --clean` 清理 3,568 行；日常体检可跑 `node scripts/scanOrphans.js`
- **任务/时间线**：新项目在大纲生成后**自动初始化**（1主线+2阶段+20时间线事件）；历史项目可 `POST /api/quests/auto-init/:projectId` 补
- 桌面按钮：`小说流水线-启动.bat` / `小说流水线-停止.bat`（一键起停+开浏览器）
- UI巡检：`node scripts/uiBugCheck.js`（Playwright，22页，报告在output/ui-bugcheck/）
- 已知非bug：/comic/config 报 503 "ComfyUI not running" = 外部服务未装的预期提示
- health-check 2项失败**已修**（CORS/jsonStore 探针过期，非真实缺陷）；章节reset接口 `materialIndex is not a constructor` **已修**
- **本轮未提交**：所有改动仍在工作区（用户未要求提交；仓库另有上一批16文件未提交改动）

## 四、待办（按优先级）

### ⚡ 进行中（下个窗口最优先，锚点见worklog）
- [x] ~~P1-4a 章节因果门槛~~ ✅ 已完成（见 0h 节）。
- [x] ~~P1-4b 两档大纲~~ ✅ 已完成（见 0h 节）。
- [x] ~~P1-4c 单点装配入口~~ ✅ 已完成（见 0h 节）→ **下一步 P1-4d 密度策略**：
      新增 `config/densityPolicy.js` + `densityResolver.js`（优先级：点名>区间命中>同场>题材字段>默认），
      装配记录写 `densityReason`（字段已由 P1-4c 铺好）；验收：改前/改后对比 token 面板"素材占比"与 `actualDepth` 分布。
      锚点：`docs/worklog/2026-09-29-章节因果门槛与素材装配计划书.md`、计划书 §八 P1-4d。
- [ ] **复验长度锚点效果**：本次新增"大纲四段节拍 + 执笔中途检查点"，需重跑 1~2 章看字数是否稳定 ≥2500
      （命令：`node scripts/run20ChapterE2E.js --resume 5d512269-3b0b-4e33-bb7d-ac7310bbe73d --only 4,15 --force`）
- [ ] 剩余 7 章低于 2500 字（2,084~2,415）是否回炉重跑（末轮宽限已保住成品，非阻塞）
- [ ] **改动走五关门禁提交**（本轮修复 + 上一批16文件）→ 提交后刷新本卡
- [ ] genre命名混乱（目录 `high-martial-crossplane` / 插件id `high-martial-comedy` / label "万界debug·反套路喜剧"）统一评估

### 🔴 需用户本人操作
- [ ] **注册每日数据库备份**（2026-09-30 新增能力，尚未启用）：
      `scripts\registerBackupTask.bat`（cmd 原生；旧 `.ps1` 版已弃用）
      建议加 `--out D:/pgbak` 指到另一块盘（同盘坏则备份与数据一起没）；季度跑一次 `npm run backup:restore-test`
- [ ] **确认后跑 100 章长程验证**（唯一能暴露摘要漂移/伏笔账本膨胀/实体状态爆炸的手段）：
      `node scripts/run20ChapterE2E.js --chapters 100 --yes`（≈1000万tokens ≈¥20 ≈3.3小时）
- [ ] 给新项目设预算上限（默认不限）：`PUT /api/maintenance/budget/:projectId`
- [ ] **删除 Windows User 级 `ALIYUN_CODING_API_KEY`（38字符旧key，已失效）**：
      `[Environment]::SetEnvironmentVariable('ALIYUN_CODING_API_KEY',$null,'User')`（或 `reg delete "HKCU\Environment" /v ALIYUN_CODING_API_KEY /f`）
      位置：注册表 `HKCU:\Environment`。项目侧已全量 override 加固，不删也不再影响本仓库，但会污染其它工具
- [ ] `DEEPSEEK_API_KEY` 仍是占位符（实测 401），备用通道不可用
- [ ] **轮换5个进过git历史的密钥**：阿里云key、DeepSeek key、REQUEST_SECRET、ENCRYPTION_SECRET、DB密码（历史提交7a79780之前含明文，未来push远端前建议 git filter-repo 清理）
- [ ] LM Studio中试加载uncensored-MTP版（先卸载标准版腾显存，崩溃码0xC0000409待复现定位）；或接受标准版
- [ ] 决定 modelBakeoff 候选模型名单并授权消耗少量API额度

### 🟠 P1 质量与CI
- [ ] 5文件覆盖率阈值：genreConfig/healthCheckers/healthMonitor/materials路由/initializeRoutes
- [ ] 53个核心路由缺输入验证（express-validator已是依赖）
- [ ] LLM 请求级超时策略评估：当前供应商级 600s + 慢请求预警（1/3 阈值），是否按 agent 分级收紧
- [ ] 章节内新角色素材被拒时的"实体/素材不一致"（已加 ERROR 告警，仍无自动修复）
- [ ] frontend vitest 覆盖率纳入CI门槛

### 🟡 P2 治理
- [ ] PG单轨收尾：data/ 运行时JSON目录（139个未跟踪文件）归档策略
- [ ] scripts/ 约40个 tmp_*/debug* 一次性脚本归档
- [ ] 死文件清理：server/routes/apiKeyRoutes.js（未挂载，真实路由是apiKeys.js）、**server/routes/admin.js（也未挂载）**、client中pipelineConstants重复定义待评估
- [ ] materialFinder.findCharacterMaterial 与 materialCharacterFinder 语义合并评估（陷阱清单原则1已知违反项）
- [ ] 数据备份制度：pg_dump 定时（backups/ 目前仅1份5-21的）

### 🟢 P3 功能
- [x] 成本/Token面板（2026-09-26 完成：`/token-ledger` 页面 + `token-ledger` 账本 + 回填脚本）
- [ ] 由 Token 面板暴露出的后续优化：分层记忆恒定占 40%（评估按步裁剪/公共前缀缓存）、
      Agent提示词 31 处截断丢 9 万（排查约束规则是否被砍，与 sop/08 相关）
- [ ] 质量反馈闭环、EPUB导出、模型分层策略落地（创意步用强模、分析步用便宜档，DEFAULT_STEP_ASSIGNMENTS已支持）

## 五、常用命令速查

```bash
npm run check              # 20项健康自检
npm run test:unit          # 单测（必须全绿才算完成）
npm run ci:check           # CI全量
node scripts/audit-iron-law.js --self-check   # 铁律互斥自检（改规则前后必跑）
node scripts/audit-iron-law.js --pre-deliver  # 交付前扫描(含新文件)
node scripts/uiBugCheck.js                    # 前端22页巡检
node scripts/tmp_verify_lmstudio.js           # LM Studio路由+连通验证（不回显密钥）
node scripts/modelBakeoff.js --models A,B --dry-run  # 模型对比(先dry-run)
npm start / npm stop       # 后端起停
node scripts/tmp_rerun_chapters.js <projectId> 1,3   # 续跑指定章节（不reset，maxRounds=5）
node scripts/tmp_verify_aliyun.js                    # token-plan网关连通验证（override已全量加固，无需再前置 env -u）

# —— 2026-09-21 新增 ——
node scripts/scanOrphans.js                  # 孤儿数据扫描（干跑，安全）
node scripts/scanOrphans.js --clean          # 实际清理孤儿数据
node scripts/repairRegistryDrift.js          # 数据漂移体检（roleLevel/reviewType/tags/素材多主角）
node scripts/repairEntityFieldResidue.js     # 人设字段标签残留回填（干跑；--apply 写入）
node scripts/run20ChapterE2E.js --resume <projectId>            # 20章E2E续跑（跳过已完成章）
node scripts/run20ChapterE2E.js --resume <pid> --only 4,15 --force  # 定向强制复验
curl -s localhost:3001/api/maintenance/orphans -H "Authorization: Bearer $REQUEST_SECRET"   # 一键扫描（API）
curl -s localhost:3001/api/maintenance/runtime -H "Authorization: Bearer $REQUEST_SECRET"   # LLM超时/卡死任务快照
```

## 六、协作约定（用户已确认）

- 删除文件/改全局配置/改安装前先征得确认；只读检查可直接做
- 用户已授权按本文件计划推进修复，但破坏性git操作（history rewrite）仍需单独确认
- 回答用中文；改动后跑对应测试验证再提交；提交走pre-commit五关门禁
- **长任务必须建工作日志**（docs/worklog/），上下文压缩前先落盘（见 sop/10）
