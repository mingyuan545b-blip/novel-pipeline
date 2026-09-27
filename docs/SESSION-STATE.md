# SESSION-STATE — 跨窗口接手状态卡

> 新窗口/新AI接手时：先读本文件（2分钟），再按任务读 docs/INDEX.md 对应SOP。
> 长任务必须遵守 docs/sop/10-上下文交接规范.md（状态落盘+恢复锚点，防上下文压缩失忆）。
> 本文件只记录"当前状态与待办"，架构细节看 ARCHITECTURE.md。
> 最后更新：2026-09-27（积压批次落库 + 实体中心 UX 重构 P1–P5：
> 详细恢复锚点见 docs/worklog/2026-09-27-实体中心UX重构.md）

---

## 一、当前结论（重要）

0g. **（2026-09-27 本会话）积压批次落库 + 实体中心 UX 重构（P1–P5）**（新窗口优先读本节）
   - **积压落库**：跨三批会话的未提交改动走五关门禁提交为 `f3e001d`（207 文件；含藏经阁PG化/
     Token 账本面板/许可证机器码/字数与轮次修复/拆超 200 行与超 100 行函数）；运行时 `data/` 未入库。
   - **实体中心 UX 重构**（用户诉求"多个 tab 大杂烩、要更人性化"）：
     P1 通用分类浏览器→装备/功法/宠物/仆人；P2 限知分类+人物/章节/搜索；P3 世界域归属归一+可读化；
     P4 关系复合聚合+中心视图；P5 摘要/状态追踪分主次；
     **P6（用户第二轮反馈返工）自研 SVG 人物关系图**（中心+放射+带标签箭头，点谁谁变中心展开，带返回栈）
     + 世界域实体按 (类型,名字) 跨章去重（137→112，卡片显 Ch2–16）+ 关系按姓名合并重复人物节点。
   - **提交**：f3e001d / e18aaf0 / c1d34b1 / 75d9c39 / a40dd54 / 4a56e49
   - **验证（实测）**：单测 **214 套件/3601 用例全绿**；vite build 通过；`verifyFrontendComplexity` 0 error；
     Playwright **13 个 tab 全部 0 console 报错**。
   - **顺带修的真实缺陷**：卡片外层 button 内嵌按钮（React 告警）；世界域 `worldId` 恒为 main-world 导致
     "0 归属"、实体名空白/穿越统计错（字段 entityName/status 与实际 name/isVisitor 不符）；
     关系中心视图取 characters[].id 与关系 UUID 不同源 → 0 结果。
   - **待办（下一轮）**：P6 道具 `itemRole`(常驻/一次性/伏笔)+`foreshadowChapterRange`+归档+
     伏笔按章节情景加载；编年史/跨世界溯源/系统 三个 tab 未做同类改造。
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
- [ ] **复验长度锚点效果**：本次新增"大纲四段节拍 + 执笔中途检查点"，需重跑 1~2 章看字数是否稳定 ≥2500
      （命令：`node scripts/run20ChapterE2E.js --resume 5d512269-3b0b-4e33-bb7d-ac7310bbe73d --only 4,15 --force`）
- [ ] 剩余 7 章低于 2500 字（2,084~2,415）是否回炉重跑（末轮宽限已保住成品，非阻塞）
- [ ] **改动走五关门禁提交**（本轮修复 + 上一批16文件）→ 提交后刷新本卡
- [ ] genre命名混乱（目录 `high-martial-crossplane` / 插件id `high-martial-comedy` / label "万界debug·反套路喜剧"）统一评估

### 🔴 需用户本人操作
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
