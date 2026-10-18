# AI接手需求文档（HANDOVER PRD）

> **本文件是什么**：给新接手AI的总需求书 + 工作宪法。定义"怎么工作、怎么读文档、怎么协作、怎么调试、怎么算完成"。
> **本文件不是什么**：不是架构文档（看 `ARCHITECTURE.md`）、不是当前状态（看 `docs/SESSION-STATE.md`）、不是具体操作步骤（看 `docs/sop/`）。
> 最后更新：2026-09-06 | 状态：🟢活跃 | 预计完整阅读：8分钟 / 只读§0-§2：2分钟

---

## §0 阅读指引（渐进披露，先读这里再决定读什么）

**本文档分层阅读协议**（同样适用于整个项目文档体系，见§4）：

| 你是谁/要干什么 | 必读 | 按需读 | 不要读 |
|---|---|---|---|
| 新会话冷启动 | §0 §1 §2 + `docs/SESSION-STATE.md` | 按任务查§4的文档路由表 | §5-§11全文 |
| 要写代码/修bug | §3工作规范 + 对应SOP | §8调试规范 | 方法论调研§7 |
| 要做大任务/多agent协作 | §5 §6 | §7 | — |
| 要改文档/规范体系 | §4 §9 | §10验收标准 | — |
| 项目Owner级重构 | 全文 | 全部L3参考文档 | archive/ |

**Token纪律（硬性）**：
1. 任何单次任务，启动阶段读取的文档总量 ≤ 800行（约15K tokens）。超了就说明你在读错层的东西。
2. 禁止"为求稳妥把文档全读一遍"——本项目文档体系的设计目标就是让你**只读需要的那一层**。
3. 大文档（>300行）必须先读顶部TL;DR再决定是否深入，禁止无脑整读。
4. 读代码优先用工具定位（GitNexus `query`/`context`、grep精确匹配），禁止整目录cat。

---

## §1 项目快照（30秒版，详情以代码实测为准）

- **是什么**：AI长篇小说自动生产线（三五百万字级），题材插件化。
- **技术栈**：Express 5 + PostgreSQL（后端3001）/ React 19 + Vite + Zustand（前端5173）/ 多供应商LLM统一层（阿里云/DeepSeek/LM Studio本地）。
- **健康基线**（2026-08-27复验）：单测205套件/3444用例全绿；pre-commit五关门禁生效；PG正常（7项目/82章）。
- **核心架构原则**：DataContext唯一数据入口；三层存储（素材库→实体中心→知识库）不反向写；题材=插件；业务规则禁止硬编码（走style-profiles/constraint-presets注入）。
- **当前LLM现状**：LM Studio本地qwen3.8-27b为主（思考模型，靠`noThinkMarker`治理），阿里云回落。生成慢（~6 tok/s）是硬件现状不是bug。
- **已知待办优先级**：🔴密钥轮换（需用户）→ 🟠覆盖率阈值/健康检查2硬失败/53路由缺输入验证 → 🟡治理清欠 → 🟢功能。详见 `docs/SESSION-STATE.md`。

**信任分级铁则**（继承自sop/10，全文档体系通用）：
- 代码结构/行为 → **以代码+测试实测为准**，文档只是地图。
- 实测数字（测试数/覆盖率/性能）→ 超7天必须抽查复跑。
- 历史文档/陷阱清单 → 部分由降智模型编写过，引用前先验证。

---

## §2 目标与非目标

### 2.1 新AI接手后的总目标
1. **稳定优先**：任何改动后 `npm run test:unit` 全绿 + pre-commit五关通过才算完成。
2. **可定位**：出问题时能在10分钟内定位到"哪一层、哪个文件、哪个函数"（靠§8调试体系）。
3. **可增删**：新增/删除一个题材插件、pipeline步骤、检测器、路由模块，改动面 ≤ 该模块自身 + 1个注册表文件（靠§5模块化契约）。
4. **省token**：文档体系执行渐进披露，冷启动 ≤ 800行阅读量（靠§4）。
5. **不失忆**：任何长任务状态落盘，上下文压缩后可无损恢复（靠sop/10三层记忆，本文档§3.4强化）。

### 2.2 非目标（明确不做）
- ❌ 不追求"重写更优雅的架构"——现有骨架健康，纠偏优于翻新。
- ❌ 不为省token牺牲验证——"动态平衡"的意思是：读文档省，跑测试不省。
- ❌ 不引入新的重型框架/编排工具，除非现有方案实测不可行且用户批准。
- ❌ 不主动清理git历史、不删文件、不改全局配置——这些必须先问用户（§11边界）。

---

## §3 工作规范（工作宪法）

### 3.1 任务生命周期（探索→计划→实施→验证→提交，每步有出口条件）

```
[探索] 读SESSION-STATE → INDEX选SOP → GitNexus查影响面
  出口：能一句话说清"改哪里、影响谁、风险级"
[计划] 中大型任务先写计划（≥3文件的改动必须写）
  出口：计划落盘到worklog（长任务）或直接列给用户（短任务）
[实施] 小步提交单元，单文件≤200行/单函数≤100行（铁律）
  出口：改动通过impact分析，HIGH/CRITICAL风险已警告用户
[验证] 单测+对应audit脚本+端到端实测（真实项目数据）
  出口：数字实测，禁止"应该没问题"
[提交] pre-commit五关（铁律→eslint→硬编码→级联→标准）
  出口：被拦时修根因，禁止--no-verify绕过
```

### 3.2 继承的核心原则（来自PROJECT_STANDARDS，经评估全部保留）
1. **禁止硬编码业务规则**——模板只定结构，规则由配置注入。
2. **传输格式写死在基座**——Agent输出JSON协议不可被模板/项目覆盖。
3. **修根因不修症状**——每次修复前必问：这是症状还是病因？（术语漏检→修prompt而非扩正则库；字数膨胀→补拦截关卡而非调阈值）
4. **举一反三**——修一个Agent的bug必须检查同类Agent（fast-review的fallback问题→同步查first/second-review、final-editor）。
5. **两套系统对齐**——pipeline.js与chapterAuditor.js的检测逻辑和hardBlock等级必须一致。
6. **DataContext唯一数据入口**——Agent禁止直接调store。
7. **语义问题LLM优先，正则只做安全网**——只收题材特有造词，不收通用术语。

### 3.3 修改前强制动作（GitNexus协议，继承自CLAUDE.md）
- 改任何函数/类/方法前：`impact({target, direction:"upstream"})`，报告爆炸半径。
- 提交前：`detect_changes()` 核对影响范围。
- 重命名：用`rename`（懂调用图），禁止find-and-replace。
- 探索陌生代码：`query({query:"概念"})` 代替盲目grep。

### 3.4 状态落盘（防失忆，强化sop/10）
- 三层记忆：**L1交接卡**（SESSION-STATE.md，≤200行）/ **L2工作日志**（worklog/日期-任务名.md，含恢复锚点）/ **L3长期知识**（ARCHITECTURE/sop/reference）。
- 触发即落盘：上下文将压缩、里程碑完成、切换任务前、破坏性操作前、发现推翻文档的结论时。
- 数据流向只许 L2→L1/L3 提炼，禁止反向、禁止多处记录同一状态。
- **会话结束最后一步永远是刷新SESSION-STATE.md。**

### 3.5 与用户的协作约定（已确认，直接遵守）
- 删文件/改全局配置/破坏性git操作 → **先征得确认**；只读检查 → 直接做。
- 回答用中文；改动后跑对应测试验证再提交。
- 报告结果必须区分"已验证"和"未验证"两部分，禁止含糊。

---

## §4 文档体系需求（分级 + 按需读取 + token动态平衡）

### 4.1 目标架构：四层金字塔

```
L0 入口层（每次会话必读，合计≤120行）
   CLAUDE.md / AGENTS.md        ← 只做薄指针，指向L1（见4.3优化项①）
L1 路由层（按需查，单文件≤250行）
   docs/INDEX.md                ← 总目录+任务路由表+问题反向索引
   docs/SESSION-STATE.md        ← 当前状态交接卡
L2 操作层（按任务类型只读1个，单文件≤300行）
   docs/sop/00~10-*.md          ← SOP：陷阱/启动/重构/新功能/bug/DB/插件/pipeline/约束/交接
   docs/MAINTENANCE.md          ← 变更后同步矩阵
L3 参考层（遇到问题才读对应章节，大文档必须有TL;DR头）
   ARCHITECTURE.md / PROJECT_STANDARDS.md / DATABASE_SCHEMA.md
   docs/reference/*.md
L4 归档层（禁止主动读取）
   docs/archive/ · docs/worklog/已完成的 · backups/
```

### 4.2 读取规则（硬约束）
1. **冷启动固定路径**：SESSION-STATE（2分钟）→ INDEX任务路由 → 1个SOP。总量≤800行。
2. **按任务选1个SOP，不许全读**；跨类型任务在计划阶段声明需要哪几个SOP。
3. **L3大文档按章节锚点读**：先读文档头TL;DR（4.3优化项②要求每个L3文档顶部≤40行摘要+章节目录），命中才深入。
4. **反向索引优先**：遇到症状先查INDEX"问题→文档反向索引"，直达根因文档+检测代码，禁止从头翻。
5. **动态平衡条款**：省token的手段是"精准路由"，不是"少验证"。文档阅读可以砍，测试/audit/impact分析一次都不能砍。当两者冲突（比如上下文快满），先落盘（3.4）再开新会话，禁止硬撑导致失忆操作。

### 4.3 对现有文档体系的优化需求（新AI接手后按优先级执行）

| # | 问题 | 优化方案 | 优先级 |
|---|------|---------|--------|
| ① | CLAUDE.md与AGENTS.md内容重复，靠"修改必须同步另一处"的人肉约定，违反自家"单一数据源"原则 | 两个入口文件都瘦身为≤30行薄指针（GitNexus块+一行"接手必读→docs/sop/01"+指向SESSION-STATE），共同内容移入sop/01。同步靠结构消灭，不靠纪律 | 🟠P1 |
| ② | L3大文档（PROJECT_STANDARDS 826行/DATABASE_SCHEMA 1077行）无TL;DR，整读一次≈30K tokens | 每个L3文档顶部加≤40行"TL;DR+章节目录+每章一句话"，配章节锚点；AI按锚点分段读 | 🟠P1 |
| ③ | 根目录污染：tmp_*.js、.tmp-*、debug*.js、client-eslint.json(1MB)、page_screenshot.png、ch1-5-content.txt、*.log | 一次性脚本移`scripts/tmp/`（加.gitignore）或删除（需用户确认）；产物移`output/`；根目录只留权威文档+配置+入口 | 🟡P2 |
| ④ | scripts/上百文件平铺，一次性与永久工具混杂，audit/debug/e2e/migrate难分辨 | 分子目录：`scripts/audit/`（已有，继续归拢）`scripts/debug/` `scripts/e2e/` `scripts/migrate/` `scripts/tmp/`；永久工具在package.json scripts注册，未注册=候选清理对象 | 🟡P2 |
| ⑤ | 反向索引是Markdown表格，只有人能读，脚本/agent无法消费 | 演进为`docs/registry/troubleshooting.json`（症状→根因文档→检测代码→修复SOP），MD表格由脚本生成，保证单一数据源 | 🟢P3 |
| ⑥ | 文档状态标记（🟢🟡📦❌）靠肉眼维护，过期无告警 | 加front-matter元数据（status/lastVerified/maxAgeDays），扩展audit-doc-sync.js检查"过期未核对"自动降级为🟡 | 🟢P3 |
| ⑦ | worklog只有任务日志，缺"决策记录"——为什么选A不选B经常丢失 | worklog模板增加"关键决策"节（决策/理由/否决的备选），重大决策沉淀为ADR式条目 | 🟢P3 |

**§4.3 进展（2026-10-11 文档瘦身批次）**：
- ③ 根目录污染 → ✅ 已处理：`_*.png`/`_*.log`/`tmp_*`/`.tmp-*`/`client-eslint.json`/`v8-engine.html`/`page_screenshot.png` 等已移出根目录（备份于 `backups/docs-cleanup-2026-10-11/`）。
- ① 入口薄指针 → 🟡 部分：`.trae/rules/project_rules.md` 已从 72KB 瘦身为薄指针（旧文冻结到 `docs/archive/trae-project-rules-legacy.md`）；`CLAUDE.md`/`AGENTS.md` 已加"按层加载"指引，gitnexus 块保留（工具生成）。
- **额外完成**：`docs/SESSION-STATE.md` 从 582 行**瘦身为索引层**（当前状态 + 会话索引表，136 行），历史结论迁出到 `docs/archive/session-conclusions-archive.md`；完成任务的 worklog 移 `docs/archive/worklog/`；`docs/INDEX.md` 状态总览改为"按层导航"（不再逐文件记日期）；`verifyDocFreshness` 由 18 errors → **0 errors**。

**文档体系维护五原则（继承INDEX.md，保留）**：单一数据源 / 反向索引优先 / **索引与详情分离** / 归档不删除 / 重复>30%即合并。

---

## §5 模块化架构需求（增删模块不动全身）

### 5.1 现状评估
项目已经是"注册表+插件"风格，方向正确，需要的是**收口和补契约**，不是推翻。已验证的既有模块化资产：
- 题材插件：`server/services/genres/` 目录式插件 + 白名单audit强制校验。
- 铁律规则：`scripts/lib/ironLawRules.js` 唯一定义源，场景化block/warn/skip。
- LLM供应商：`providerDefs.js` + `providerRegistry.js`，步骤分配表`DEFAULT_STEP_ASSIGNMENTS`。
- 检测器：`detectors/detect*.js` 独立文件，被pipeline与auditor双消费。
- 配置元数据：`configManifest.js` 唯一注册表。

### 5.2 模块化契约（新AI做任何增删必须遵守）

**"一个模块 = 一个目录/文件 + 一处注册 + 零处散改"**：

| 扩展点 | 新增时只改 | 删除时只改 | 验证命令 |
|--------|-----------|-----------|---------|
| 题材插件 | `genres/`新目录 + 白名单注册 | 删目录 + 白名单摘除 | `audit-genre-whitelist.js` + sop/06 |
| pipeline步骤 | step定义 + `pipelineContract.js`输入契约 + `pipelineOutputContract.js`输出契约 + `dataFlowSpec.js`声明 | 反向摘除4处 | sop/07 + 契约测试 |
| 检测器 | `detectors/`新文件 + **同时**接入pipeline与chapterAuditor（3.2原则5） | 反向摘除 | 对应单测 |
| API路由 | `routes/`新文件 + 路由挂载点1处 | 反向摘除 | `auditApiRegistry.js` |
| 约束词 | constraint-presets配置 + `constraintDetectionRegistry.js` | 反向摘除 | sop/08 + `verify:constraint` |
| 前端页面 | `client/src/pages/`新目录 + App.jsx路由1处 | 反向摘除 | uiBugCheck巡检 |

**硬性要求**：
1. 任何新模块必须能回答："删掉它需要改几个文件？" 答案>3 → 设计不合格，先解耦再合入。
2. 模块间通信只走契约（输入/输出schema），禁止跨模块import内部函数。
3. 新扩展点（以后要频繁增删的东西）必须配：注册表 + audit脚本 + 至少1个契约测试。三件套不齐不算交付。
4. **允许的冗余**：同一检测逻辑在pipeline与auditor双实现属于"对齐型冗余"，允许但必须过一致性audit。**禁止的冗余**：同一状态/配置在多处定义（违反单一数据源）。

---

## §6 多Agent协作模型（主Agent编排 + 子Agent执行）

### 6.1 方法论选型结论（调研见§7）
采用 **主从编排（Orchestrator-Worker）+ 轻量Spec驱动**，不采用BMAD式重角色流水线。
理由：本项目任务粒度以"修bug/加模块/纠偏"为主，主Agent+按需派工比固定角色流水线开销小；但大任务（如"53路由加输入验证"）天然可并行分片，子Agent收益明显。

### 6.2 角色定义

```
主Agent（Orchestrator，即当前Claude Code会话）
  职责：需求理解→任务分解→派发→汇总→集成测试→向用户汇报→落盘
  独占权：git提交、修改SESSION-STATE/INDEX、与用户对话、跨模块集成
子Agent（.claude/agents/*.md，独立上下文窗口）
  ├─ explorer    只读探索：GitNexus查询/读代码/产出影响面报告（禁写、禁危险bash）
  ├─ planner     产出实施计划：读探索报告→输出分步方案+验收标准（禁写代码）
  ├─ implementer 单模块实施：按计划改1个模块+配套单测（禁跨模块、禁提交）
  ├─ tester      验证：跑单测/audit/端到端，产出实测数字报告（禁改业务代码）
  └─ doc-sync    文档同步：按MAINTENANCE矩阵更新文档+状态标记（禁改代码）
```

### 6.3 协作规则
1. **派发必带边界**：主Agent给子Agent的任务书必须含：目标一句话、允许改动的文件清单、禁止事项、出口条件（怎么算完成）。
2. **子Agent结果必须回到主Agent汇总**：主Agent负责合并冲突、跑集成测试（`npm run test:unit` + 相关audit），子Agent各自的"局部绿"不等于"全局绿"。
3. **并行上限与隔离**：同时改代码的implementer ≤ 2个，且文件清单不相交；保证不了不相交就用git worktree隔离分支再合。
4. **上下文经济**：探索类工作（读大文件、翻历史）一律派给子Agent，让token消耗发生在隔离窗口里，主Agent只收摘要报告——这是本项目多Agent的第一动机（省主上下文），第二动机才是并行提速。
5. **落地形式**：子Agent定义为`.claude/agents/<name>.md`（含角色prompt、工具白名单、模型档位）；主Agent编排逻辑写进新增的`docs/sop/11-多Agent协作.md`并在INDEX注册。

### 6.4 模型分层（配合Claude Code Switch）
- 规划/调试/根因分析 → 强模型档。
- 机械实施/文档同步/测试跑批 → 便宜档或本地LM Studio档。
- 用Claude Code Switch维护多套provider配置，按任务档切换；切换动作记入worklog（避免"为什么这个会话输出质量差"的无头案）。

---

## §7 AI编程方法论调研与采纳决策

> 结论先行：**采纳4项、部分采纳2项、拒绝2项**。拒绝理由和本项目适配性比方法论本身更重要。

| 方法论/工具 | 核心思想 | 决策 | 理由与落地形式 |
|---|---|---|---|
| **Anthropic Claude Code最佳实践**（CLAUDE.md记忆、探索→计划→编码→提交、TDD、子代理、hooks） | 与工具原生能力对齐的工作流 | ✅全采纳 | 已体现在§3.1生命周期、§6子Agent、§9.2 hooks门禁 |
| **上下文工程/渐进披露**（just-in-time检索、压缩、结构化笔记、子代理隔离） | 把上下文当稀缺资源管理 | ✅全采纳 | §4四层文档金字塔+token预算；§6.3规则4探索外包；sop/10结构化笔记（已有，验证有效） |
| **轻量Spec驱动**（GitHub Spec Kit：specify→plan→tasks→implement；Kiro的EARS需求句式） | 先写规格再写码，规格即验收标准 | ✅采纳轻量版 | 不引入Spec Kit工具链本身；规则化为：≥3文件的改动必须先落盘计划（含验收标准）再动手，计划即spec，存worklog |
| **AGENTS.md开放标准** | 跨工具单一agent入口文件 | ✅采纳 | 与CLAUDE.md一起瘦身为薄指针指向同一L1/L2源（§4.3①），天然兼容Codex/Cursor等其他AI工具接手 |
| **Hooks确定性护栏**（PreToolUse/PostToolUse/Stop） | 把"必须做"从自觉变成机制 | 🟡部分采纳 | 已有pre-commit五关（git层）；补Claude Code层：Stop hook提醒"SESSION-STATE未更新不许结束"、PreToolUse拦截危险命令（rm -rf/git push --force）。hooks过多会拖慢每次操作，只加高价值3-5个 |
| **BMAD-METHOD**（analyst/PM/architect/dev/QA重角色流水线） | 完整软件公司角色扮演 | 🟡部分借鉴 | 拒绝其重流程（每任务跑全角色链=token灾难）；借鉴其角色分离思想→§6.2五个轻量子Agent |
| **Ralph Wiggum循环**（while true自动跑prompt直到完成） | 无人值守暴力循环 | ❌拒绝 | 本项目单章生成20-40分钟、有真实API成本、用户约定破坏性操作需确认——无人值守循环风险>收益 |
| **全自动PR流水线**（headless CI agent自动改码提PR） | 云端自动修复 | ❌暂缓 | 单人本地项目，无远端仓库（且密钥还在git历史里未清理），前提不具备 |

**配套工具矩阵（当前环境：Claude Code + Claude Code Switch + VS Code）**：

| 工具 | 用途 | 状态 |
|---|---|---|
| Claude Code（VS Code集成） | 主开发环境，Plan Mode用于中大型任务 | ✅在用 |
| Claude Code Switch | 多provider/多档位切换（§6.4模型分层） | ✅在用，切换需记录 |
| GitNexus MCP | 代码智能：impact/query/context/rename/detect_changes | ✅已索引（14852符号），改码前强制用 |
| `.claude/agents/` | 子Agent定义（§6.2五个角色） | ❌待建，P1 |
| `.claude/settings.json` hooks | Stop提醒落盘/危险命令拦截 | ❌待建，P1 |
| git worktree | 并行implementer隔离 | 按需使用 |
| Playwright（scripts/uiBugCheck.js） | 前端22页巡检 | ✅已有 |
| audit脚本族（iron-law/hardcode/cascade/doc-sync/config-test-sync/genre-whitelist/api-registry） | 机器可执行的质量门禁 | ✅已有，本项目核心资产 |

---

## §8 调试与问题定位规范（能定位到具体行）

### 8.1 五层定位法（按顺序收缩，禁止跳层乱猜）

```
① 复现：最小复现命令/数据（复现不了=先解决复现，不许盲修）
② 定层：前端？路由？服务？pipeline？LLM？存储？
   工具：curl http://localhost:3001/api/health → npm run check（20项自检）
③ 定文件：INDEX反向索引（症状→文档→检测代码）→ GitNexus query/context
④ 定函数：GitNexus impact上游追调用链 / 加临时日志（带[DEBUG-任务名]前缀，修完必删）
⑤ 定根因：区分症状vs病因（§3.2原则3），修复+回归测试+陷阱清单登记
```

### 8.2 分层排查速查

| 层 | 第一命令 | 常见根因入口 |
|---|---|---|
| 服务不起 | `npm run check` + serverStart日志 | 端口占用(`npm run kill:port`)/.env缺失/PG连不上 |
| 前端异常 | 浏览器console + `node scripts/uiBugCheck.js` | .env.local覆盖.env导致403（ARCHITECTURE§一）/通配符路由 |
| API行为 | curl直打3001对照契约 | POST返{success,data}、GET返数组的格式差异（陷阱#23） |
| pipeline | `scripts/debugQueryPipelineLogs.js` / `debugQueryTaskLog.js` | 契约不匹配/污染守卫拦截/genre=null裸奔 |
| LLM输出 | `node scripts/modelBakeoff.js --models A,B --dry-run` / `curl localhost:3001/api/health`（看 llm-latency） | 思考吃光tokens(#94)/超时链/限流(errorRecovery.js) |
| 数据 | `scripts/debugQueryChapters.js` / audit-cascade-delete | 孤儿数据/PG静默降级(store.js _backendStatus) |

### 8.3 调试硬规则
1. **修复必须附回归测试**：bug修复的交付物=修复代码+能抓住该bug复发的测试用例。
2. **新陷阱必须登记**：修复中发现的新坑→追加`sop/00-陷阱清单.md`（编号递增），症状→根因映射进INDEX反向索引。
3. **debug脚本治理**：新写的一次性debug脚本放`scripts/tmp/`并加日期前缀；有长期价值的归拢到`scripts/debug/`并在§8.2表格登记。现存约40个tmp/debug脚本待归档（P2待办）。
4. **禁止静默降级掩盖问题**：FAILED不是正常（sop/01绝对规则1），任何"降级成功"日志出现时必须确认是设计内降级。

---

## §9 质量保障与门禁体系

### 9.1 测试金字塔（现状已达标，维持）
- **单测**（jest，3444用例）：每次改动必跑相关套件，交付前全量 `npm run test:unit`。
- **契约测试**：pipeline输入/输出契约、API契约（apiContractAudit）。
- **集成/E2E**：真实项目数据端到端（`node scripts/verifyNewProject.js <projectId>`），代码改动后必须跑，不许只靠单测（sop/01绝对规则4）。
- **UI巡检**：Playwright 22页（`node scripts/uiBugCheck.js`）。

### 9.2 机器门禁（不依赖自觉的三层防线）
```
第1层 Claude Code hooks（待建，§7）：Stop时检查落盘、PreToolUse拦危险命令
第2层 pre-commit五关（已有）：铁律→eslint→硬编码→级联→标准；被拦修根因禁止绕过
第3层 CI/交付前（已有）：npm run ci:check + audit-iron-law --pre-deliver + 4个audit并行
```

### 9.3 冗余设计原则（"可以冗余但必须稳定"的判据）
- ✅ **允许的冗余**：对齐型双实现（pipeline/auditor，须过一致性audit）、LLM回落链（LM Studio→阿里云）、双保险治理（noThinkMarker+输出纪律prompt）。
- ❌ **禁止的冗余**：同一状态多处记录、同一规则多处定义、同一配置多处硬编码。
- 判据一句话：**冗余用于"失效兜底"，禁止用于"数据定义"。**

### 9.4 Definition of Done（每个任务的验收清单）
```
[ ] 代码改动通过GitNexus impact分析，HIGH/CRITICAL已告知用户
[ ] 相关单测通过 + bug修复附回归测试
[ ] 对应audit脚本通过（hardcode/cascade/doc-sync/config-test-sync按改动类型选）
[ ] 端到端实测（涉及pipeline/LLM/路由的改动）
[ ] 文档同步（MAINTENANCE矩阵对照）
[ ] pre-commit五关通过提交（禁止--no-verify）
[ ] SESSION-STATE.md已刷新（长任务另有worklog恢复锚点）
[ ] 汇报区分"已验证/未验证"
```

---

## §10 接手落地计划（新AI按此顺序执行）

### 阶段0：冷启动（第1个会话，只读不写）
1. 读本文档§0-§3 → 读SESSION-STATE → 读INDEX。
2. 重建基线：`npm run check` + `npm run test:unit` + `node scripts/audit-iron-law.js --self-check`，实测数字对照交接卡（>7天必须复跑）。
3. 向用户汇报：基线是否健康 + 待办优先级是否仍成立 + 本次会话建议做什么。

### 阶段1：还治理债（低风险高收益）
1. §4.3①：CLAUDE.md/AGENTS.md瘦身，消灭双头同步（P1）。
2. §4.3②：三大L3文档加TL;DR头（P1）。
3. §6.3：建`.claude/agents/`五个子Agent + `.claude/settings.json`高价值hooks（P1）。
4. 新增`docs/sop/11-多Agent协作.md`，在INDEX注册（P1）。
5. §4.3③④：根目录/scripts/清污——**列清单先给用户确认再动**（P2）。

### 阶段2：还质量债（按SESSION-STATE P1待办）
1. 5文件覆盖率阈值、健康检查2硬失败（CORS/jsonStore原子写）、53路由输入验证（可并行分片给implementer子Agent，每片≤10路由，文件清单不相交）。
2. frontend vitest覆盖率纳入CI门槛。

### 阶段3：功能推进（P3待办，需用户排优先级）
成本/Token面板（llmMetrics数据已在）→ 质量反馈闭环 → EPUB导出 → 模型分层策略落地（DEFAULT_STEP_ASSIGNMENTS已支持）。

**每阶段出口条件**：DoD清单（§9.4）全过 + SESSION-STATE刷新 + 向用户汇报实测数字。

---

## §11 风险与边界（红线）

| 红线 | 说明 |
|---|---|
| 🔴 密钥 | 5个密钥曾进git历史（SESSION-STATE🔴待办），任何push远端/分享仓库前必须先提醒用户处理；代码/日志/文档中禁止出现明文密钥 |
| 🔴 破坏性git | history rewrite / force push / 删分支必须先单独确认 |
| 🔴 删文件/改全局配置 | 先列清单征得确认；归档优先于删除 |
| 🔴 数据库 | DDL变更走sop/05+migrate脚本，禁止手改生产数据；操作前确认backups/有新鲜备份 |
| 🟠 API成本 | 跑真实LLM的验证（端到端/bakeoff）先报预估消耗，dry-run优先 |
| 🟠 本地模型 | LM Studio慢是硬件现状；uncensored-MTP变体加载会崩（0xC0000409），别反复试 |
| 🟠 无人值守 | 禁止启动无监督的自动改码循环（§7拒绝Ralph的理由） |

---

## 附：本文档维护规则
- 本文档是"需求+宪法"，**不记录时效性状态**（那是SESSION-STATE的职责）。
- 修改本文档 = 修改工作规范，必须：①用户知情 ②对照§4.3/§7检查与其他文档无冲突 ③走MAINTENANCE同步矩阵。
- 每完成§10一个阶段，回来把对应需求标记为✅已落地（保持本文档与现实一致）。
