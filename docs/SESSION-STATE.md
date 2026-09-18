# SESSION-STATE — 跨窗口接手状态卡

> 新窗口/新AI接手时：先读本文件（2分钟），再按任务读 docs/INDEX.md 对应SOP。
> 长任务必须遵守 docs/sop/10-上下文交接规范.md（状态落盘+恢复锚点，防上下文压缩失忆）。
> 本文件只记录"当前状态与待办"，架构细节看 ARCHITECTURE.md。
> 最后更新：2026-09-06（会话中断交接：详细恢复锚点见 docs/worklog/2026-09-06-token-plan接入与新项目E2E.md）

---

## 一、当前结论（重要）

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
     ③分层记忆L0-L4冗余（长期记忆由 memory-pyramid 承担）④licence机器绑定含内存导致换内存即失效


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
- 端到端验证项目：**`仙师好评_云端E2E` f48c77ad-f289-4166-ab64-e1143be0a014**（ch2✅2761字素材已更新；ch1/ch3待续跑，见worklog锚点）；旧项目守灵人f91ea3b0弃用不复跑（用户决策）
- 桌面按钮：`小说流水线-启动.bat` / `小说流水线-停止.bat`（一键起停+开浏览器）
- UI巡检：`node scripts/uiBugCheck.js`（Playwright，22页，报告在output/ui-bugcheck/）
- 已知非bug：/comic/config 报 503 "ComfyUI not running" = 外部服务未装的预期提示
- 已知未修：health-check 2项失败（CORS配置、jsonStore写后验证）= 下方P1，非新问题

## 四、待办（按优先级）

### ⚡ 进行中（下个窗口最优先，锚点见worklog）
- [ ] 续跑ch1（**不要reset**，2213字在抢救区）→ ch1过后跑ch3 → verifyNewProject全链路 → 前端数据关联检查（项目/章节/素材/实体/知识/上下文装配图/藏经阁/审核各页API+uiBugCheck）→ **16文件改动走五关门禁提交** → 刷新本卡
- [ ] E2E全绿后：genre标签异常排查（ASSEMBLE日志"万界debug·反套路喜剧"≠项目subGenre high-martial-comedy，疑似detectGenre(styleProfile)反模式，连带worldScope hook报错）；章节reset接口"materialIndex is not a constructor"小bug

### 🔴 需用户本人操作
- [ ] **轮换对话中明文出现的token-plan key**（sk-sp-开头，E2E验证完成后）+ 删除Windows User级环境变量残留的旧ALIYUN_CODING_API_KEY（38字符，已被override:true中和但建议清理）
- [ ] **轮换5个进过git历史的密钥**：阿里云key、DeepSeek key、REQUEST_SECRET、ENCRYPTION_SECRET、DB密码（历史提交7a79780之前含明文，未来push远端前建议 git filter-repo 清理）
- [ ] LM Studio中试加载uncensored-MTP版（先卸载标准版腾显存，崩溃码0xC0000409待复现定位）；或接受标准版
- [ ] 决定 modelBakeoff 候选模型名单并授权消耗少量API额度

### 🟠 P1 质量与CI
- [ ] 5文件覆盖率阈值：genreConfig/healthCheckers/healthMonitor/materials路由/initializeRoutes
- [ ] 健康检查2硬失败：CORS配置、jsonStore写后验证（原子写）
- [ ] 53个核心路由缺输入验证（express-validator已是依赖）
- [ ] frontend vitest 覆盖率纳入CI门槛

### 🟡 P2 治理
- [ ] PG单轨收尾：data/ 运行时JSON目录（139个未跟踪文件）归档策略
- [ ] scripts/ 约40个 tmp_*/debug* 一次性脚本归档
- [ ] 死文件清理：server/routes/apiKeyRoutes.js（未挂载，真实路由是apiKeys.js）、client中pipelineConstants重复定义待评估
- [ ] materialFinder.findCharacterMaterial 与 materialCharacterFinder 语义合并评估（陷阱清单原则1已知违反项）
- [ ] 数据备份制度：pg_dump 定时（backups/ 目前仅1份5-21的）

### 🟢 P3 功能
- [ ] 成本/Token面板（llmMetrics数据已在）
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
node scripts/tmp_verify_aliyun.js                    # token-plan网关连通验证（须 env -u ALIYUN_CODING_API_KEY 前缀防旧环境变量遮蔽，或直接跑——override已修）
```

## 六、协作约定（用户已确认）

- 删除文件/改全局配置/改安装前先征得确认；只读检查可直接做
- 用户已授权按本文件计划推进修复，但破坏性git操作（history rewrite）仍需单独确认
- 回答用中文；改动后跑对应测试验证再提交；提交走pre-commit五关门禁
- **长任务必须建工作日志**（docs/worklog/），上下文压缩前先落盘（见 sop/10）
