# SESSION-STATE — 跨窗口接手状态卡（L1 索引层）

> 新窗口冷启动：**先读本文件（约2分钟）**，再按任务读 `docs/INDEX.md` 选对应 SOP。
> **本文件只放"当前状态 + 会话索引"，不放细节**（瘦身原则，全文 ≤200 行）。细节只留"一句话结论 + 详情路径"。
> - 历史结论全文（08-27→10-11 逐会话）→ `docs/archive/session-conclusions-archive.md`
> - 任务细节（含根因/证据/恢复锚点）→ `docs/worklog/<日期>-<主题>.md`
> 长任务/上下文将压缩时：先落盘 worklog（恢复锚点），再刷新本卡（见 `docs/sop/10-上下文交接规范.md`）。
> 最后更新：2026-10-19

---

## 一、当前状态（只保留最新一条）

- **2026-10-19 · 真 CI 打通（E6）**：gh 2.102.0 便携安装 + SSH 密钥 + 私有仓库
  `mingyuan545b-blip/novel-pipeline`（本机 github.com:443 被墙，走 api.github.com + SSH:22）。
  推送即触发 CI。**首跑 4 个 job 红**，暴露三处"本地能跑、干净环境必挂"：①`uuid`/`multer` 只声明在
  `server/package.json` 而 CI 只装根依赖；②形状基线用 Windows 反斜杠键 → Linux 全判"新增写入点"；
  ③`checkMemory` 断言依赖 runner 内存。前两处 + ③已修，**现 CI 10/11 绿（含 gates 全链 32 步）**，
  仅 `frontend-lint` 红（36 处，已精确盘点：9 个零断言假测试 + 7 条件内 expect + 3 expect 参数 +
  9 React Compiler memo + 3 set-state-in-effect + 2 react-refresh + 其他）。
  → 详情：`docs/worklog/2026-10-19-批次E-门禁可信化施工.md` §六
- **2026-10-19 · 批次 E「门禁可信化」（E1–E5，8 个提交）**：承接第三轮审查 G1–G12。让门禁从装饰品变成守门人：
  `npm run ci:check`（32 步）**首次全绿**并接进 GitHub Actions（新增 `gates` job + 触发分支补 `milestone/**`）
  + `.githooks/pre-push` 本地兜底。修掉门禁自身 5 处说谎/空绿/影子规则：E1 API 契约 37 条全误报（前缀表陈旧 +
  加防漂移硬断言）、E2c 数据侧"空绿"（读不到数据必须显式声明未覆盖）、E3a CI 行数门禁是影子规则、E5 铁律自检假红；
  并连带修 2 个真实功能缺陷：**G13** 叙事承诺字段名分叉（PG 中 4 项目有 3 个在写手提示词里只剩 1/4 条 → 已单一源+别名兼容）、
  **G14** 数据侧校验从未真正读过数据。**E4 覆盖率账本诚实化**：口径由 80 文件白名单 → 全量 server（600 文件），
  真实水位 ≈ global 42.94%/31.71%/39.56%/46.02%（旧"91%"只描述 8.5% 的后端），并新增"每文件只升不降"棘轮
  （`docs/coverage-baseline.json` + `verifyCoverageRatchet.js`）。顺带把"环境残留决定覆盖率"的
  `jsonStoreHelpers` 改为确定性覆盖。
  → 详情：`docs/worklog/2026-10-19-批次E-门禁可信化施工.md`（含真实覆盖债清单 216 个文件 + 遗留 G15–G17）
- - **2026-10-19 · 假成果修复·批次 A（P0 止血）+ 治理门禁 C1/C2/C3**：执行 `2026-10-17-假成果审查`
  §五「统一执行」的批次 A 全部 + 批次 C 可落地部分。修 **F2**（`constraintFeedbackModule` offValue `'on'→'off'`，
  默认档位抽到单一源 `server/config/moduleDefaults.js`）、**F6**（`_buildTechniqueHints` 的 `detectGenre` 未定义 →
  改经 store+`resolveGenreFromProject` 且 try 兜底）、**F1**（T0 元约束接入 pipeline 初审硬阻断 `collectMetaConstraintIssues`）、
  **F4**（新增 `ValidationEngine.recordTechniqueResults` 并在 `recordReviewFeedback` 调用，技法成功率不再死数据）。
  新增 3 道门禁：`verifyReachability.js`（关键导出可达性）/`verifyModuleSwitchDefaults.js`（开关矩阵）/
  `audit-failopen.js`（降级基线，只许下降），前两道进 pre-commit，三道进 `ci:check`。`npm run test:unit` 3959 例全绿。
  同日续做**批次 B（用户裁决"删表"）**：`craft_materials` 删表（migration `v0008` 已 DROP，代码+文档清理）；
  `worldScope` onWriterPrompt 补真（改用真实 `buildWorldScopePrompt`）、onReaderCheck 下线；
  交付 `audit-technique-cards.js`。**数据侧待做**：114 处工艺违规回炉 + 184 条技法补规则/判定测试。
  → 详情：`docs/worklog/2026-10-19-假成果修复-批次A与治理门禁.md`
- **2026-10-18 · 模型固定 DeepSeek 官方 V4.1 Flash · 1017**：默认 provider 从
  `bailian/qwen3.8-max` 切到 `deepseek/deepseek-flash`（官方 API，1,048,576 上下文）。
  根因：启动器 `--setting-sources project,local` 排除 user settings 的 modelPicker，
  且未注入 `ANTHROPIC_CUSTOM_MODEL_OPTION`，导致会话内自定义模型不可选。已补注入、
  重建 cc-switch profiles、移除 `CLAUDE_CODE_SIMPLE`，并修正 `.claude/settings.json`
  两条无效 allow 通配符。实测 `/anthropic/v1/messages` HTTP 200，7 个 MCP 全部 Connected。
  → 详情：`docs/worklog/2026-10-18-模型固定DeepSeek官方1017.md`
- **2026-10-18 · AI 工具链部署（Claude Code / VS Code / 质量门禁）**：修复启动器 `--bare` +
  `CLAUDE_CODE_SIMPLE=1` 导致 CLAUDE.md/hooks/plugins/LSP 失效；GitNexus 重新索引
  （17,832 nodes / 41,599 edges / 300 flows，FTS 因网络不可用）；接入 MCP
  （gitnexus/eslint/vitest/postgres/chrome-devtools，首次需交互批准）；新增 `.claude/{settings,commands,agents,skills}`、
  `.vscode/*`、Stryker（validateQuotes 71.43%）、checkJs 基线 210、测试质量规则基线 72；CI Node 24 +
  npm audit/gitleaks；root/server/client 三处生产依赖 0 漏洞。顺手修复 dialectRegistry fallback 正则误匹配 +
  3 个前端过期测试。`server/node_modules` 误跟踪已从索引移除（磁盘保留，`.gitignore` 已显式忽略）。
  后端 261/3944、前端 129/962 全绿。→ 详情：`docs/worklog/2026-10-18-AI工具链部署.md`
- **2026-10-17 · 假成果审查（只统计，不修复 → 下一窗口统一执行）**：定位"门禁为什么形同虚设"的
  结构根因 R1–R4（门禁只验文本不验**运行时可达** / 子系统 **0 单测**的空绿 / 验收凭据是文档 ✅ 而非可执行断言 /
  **fail-open 是默认**：256 处只 log 不处理，pipeline 内 130）。查出 **F1–F11** 共 11 条假成果，全部带可复现证据：
  T0 元约束 M1–M5 在 pipeline 内引用数 **0**（只在 UI 手动审计路由）；约束反馈闭环因
  `offValue='on'` 写反**永久禁用**（16 项目 / 137 章 **0 条**反馈数据）；"升级 hardBlock/权重×1.5" 只是提示词文案
  （`constraintWeightResolver`/`constraintHardSpec`/`constraintSoftSpec` 均不存在）；技法库自进化
  `recordTechniqueResult` **0 调用点**（209/224 技法 attempts=0）；`_buildTechniqueHints` 因
  `detectGenre` 未定义**必抛**；`craft_materials` **0 行**；224 技法中 184 条无 `implementation_rules`、
  `judgement_test` **0**、真实源小说仅 **2** 本。
  → 详情 + 复现命令 + 下一窗口批次 A/B/C/D 执行清单：`docs/worklog/2026-10-17-假成果审查-问题统计.md`
- **2026-10-17 · 工艺素材门禁重建 M1（止血）**：把 `craftQualitySpec` 的"高光/名言/魅力"标准
  真正接到**唯一写入点**。新增 `craftWriteGate`（`entityCRUD.getOrCreateEntity/updateEntity` 过滤+告警）；
  加严 `validateQuotes/validateHighlights`（拦"处境混入 quote / 空壳 scene / 标签式 why / 剧情摘要式 what / 缺 cost"）；
  新增只读体检 `scripts/audit-craft-quality.js`（**实测 104 个角色实体中 69 个违规、共 114 处**）。
  `tests/unit` 269 套件/4054 例全绿；lint 通过。→ 详情：`docs/worklog/2026-10-17-工艺素材门禁重建-M1止血.md`
- **2026-10-11 · 新项目10章验证 + 7 处根因修复**：新建项目实跑 10 章；修
  R1 OOM（`serverStart.js` daemon 化，stdout→logs 不继承管道）/ R2 契约漂移（新增 `dataFlowSpecSupplement.js` + 闸门按权威步骤集校验）/
  R3 `parseJsonResponse` 贪婪正则→括号配平 / R4 `craftDesigner` 静默失败（应用后复检 `needsCraft`）/
  R5 题材 `neverDropTypes` 硬编码误报 / R6 内容审核拦截兜底（`isContentInspection` + 备用供应商）/ R7 小预算选材空转（至少给一条）。
  `tests/unit` 全绿；10 章实跑 7 成 3 卡（ch8-10 受 R6 内容审核阻断=环境/合规，非代码缺陷）。
  → 详情：`docs/worklog/2026-10-11-新项目10章验证-根因修复.md`
- **未提交改动**（工作区，分支 `milestone/M5-pipeline`）：6 改（consistencyRoutes/pipelinePostApproval/materialItemProcessor/materialRelationSync/polisher/startup）
  + 3 新（`materialRelationWriter.js`/`tests/unit/pipelineRootCauseFixes.test.js`/`scripts/_session_kuaijie/`）。需走五关门禁提交。
- **待办**见 §四。

---

## 二、会话索引（新→旧，一行一会话；只记"日期 / 主题 / 详情"，不含细节，故不随细节膨胀）

| 日期 | 主题 | 详情文件 |
|------|------|----------|
| 2026-10-19 | 批次 E 门禁可信化（E1–E5：真 CI + 修门禁自欺 + 覆盖率诚实化） | [worklog/2026-10-19-批次E-门禁可信化施工.md](worklog/2026-10-19-批次E-门禁可信化施工.md) |
| 2026-10-19 | 全项目虚有其表审查·第三轮（工具链/门禁自欺/死资产 G1–G12） | [worklog/2026-10-19-全项目虚有其表审查-第三轮（门禁与死资产）.md](worklog/2026-10-19-全项目虚有其表审查-第三轮（门禁与死资产）.md) |
| 2026-10-19 | 假成果修复·批次 A（F1/F2/F4/F6）+ 治理门禁 C1/C2/C3 | [worklog/2026-10-19-假成果修复-批次A与治理门禁.md](worklog/2026-10-19-假成果修复-批次A与治理门禁.md) |
| 2026-10-17 | 假成果审查与问题统计（F1–F11，批次 A/C 已修，B/D 遗留） | [worklog/2026-10-17-假成果审查-问题统计.md](worklog/2026-10-17-假成果审查-问题统计.md) |
| 2026-10-17 | 工艺素材门禁重建 M1（唯一写入点止血） | [worklog/2026-10-17-工艺素材门禁重建-M1止血.md](worklog/2026-10-17-工艺素材门禁重建-M1止血.md) |
| 2026-10-11 | 新项目10章验证 + 7处根因修复 | [worklog/2026-10-11-新项目10章验证-根因修复.md](worklog/2026-10-11-新项目10章验证-根因修复.md) |
| 2026-10-10 | UI章节日志盲区 + 铁律三根因 + AI味M11检测器 | [worklog/2026-10-10-UI盲区与铁律三根因-AI味接入检测器.md](worklog/2026-10-10-UI盲区与铁律三根因-AI味接入检测器.md) |
| 2026-10-09 | 崩溃转储process.report + 并发压测 + AI味高频词审计 | [worklog/2026-10-09-崩溃转储与并发压测-AI味高频词审计.md](worklog/2026-10-09-崩溃转储与并发压测-AI味高频词审计.md) |
| 2026-10-09 | 跨界副本博弈建项 + 20章生产 + 12项问题溯源 | [worklog/2026-10-09-跨界副本博弈-新项目20章-问题溯源.md](worklog/2026-10-09-跨界副本博弈-新项目20章-问题溯源.md) |
| 2026-10-08 | 设计期补设计 + 命名质量 + 口头禅入编年史 | [archive/session-conclusions-archive.md](archive/session-conclusions-archive.md)（0r）|
| 2026-10-08 | 高光/名言/魅力判定标准落地 | [archive/session-conclusions-archive.md](archive/session-conclusions-archive.md)（0q）；`design/角色编年史升级-多维分层与素材质检.md` §十 |
| 2026-10-07 | 素材链路 T1→T6（定位/校验/兜底/省token） | [worklog/2026-10-07-T1至T6-素材链路定位校验兜底与省token.md](worklog/2026-10-07-T1至T6-素材链路定位校验兜底与省token.md) |
| 2026-10-07 | S1→S8 字段单一源与契约闭环施工 | [worklog/2026-10-07-S1至S8-字段单一源与契约闭环施工.md](worklog/2026-10-07-S1至S8-字段单一源与契约闭环施工.md) |
| 2026-10-07 | 字段单一源 & Agent协作完整性体检（只读） | [worklog/2026-10-07-字段与Agent协作完整性体检.md](worklog/2026-10-07-字段与Agent协作完整性体检.md) |
| 2026-10-06 | 勘定交接问题修复 + 复建压测 | [worklog/2026-10-06-勘定交接问题修复与复建压测.md](worklog/2026-10-06-勘定交接问题修复与复建压测.md) |
| 2026-10-05 | 副本带出机制 + 编年史多维升级（P0-P2 开工） | [archive/session-conclusions-archive.md](archive/session-conclusions-archive.md)（0l）；`design/实体中心-副本归属与带出机制.md` |
| 2026-10-05 | 勘定项目建项 + T0 压测（含分支bug修复） | [worklog/2026-10-05-勘定项目建项与T0压测（含分支bug修复）.md](worklog/2026-10-05-勘定项目建项与T0压测（含分支bug修复）.md) |
| 2026-10-05 | 勘定压测问题全量汇总（交接） | [worklog/2026-10-05-勘定压测问题汇总（交接给下个窗口）.md](worklog/2026-10-05-勘定压测问题汇总（交接给下个窗口）.md) |
| 2026-10-04 | 实体中心三处用户反馈修复（前端） | [archive/session-conclusions-archive.md](archive/session-conclusions-archive.md)（0k）|
| 2026-10-01 | 藏经阁重设计 + 运行看板 + 全书设定 | [worklog/2026-10-01-藏经阁重设计-运行看板-全书设定.md](worklog/2026-10-01-藏经阁重设计-运行看板-全书设定.md) |
| 2026-10-01 | 藏经阁来源展开 + 详情完整度修正 | [worklog/2026-10-01-藏经阁来源展开与详情完整度修正.md](worklog/2026-10-01-藏经阁来源展开与详情完整度修正.md) |
| 2026-10-01 | 可观测性持久化链静默降级修复 | [worklog/2026-10-01-持久化链静默降级修复.md](worklog/2026-10-01-持久化链静默降级修复.md) |
| 2026-09-30 | P0 兜底四件套（备份/预算熔断/长程闸门/藏经阁） | [worklog/2026-09-30-P0兜底四件套.md](worklog/2026-09-30-P0兜底四件套.md) |
| 2026-09-29 | 素材单一源 P0-1/2/3 + P1-4 计划书立项 | [worklog/2026-09-29-章节因果门槛与素材装配计划书.md](worklog/2026-09-29-章节因果门槛与素材装配计划书.md) |
| 2026-09-27 | 实体中心 UX 重构（P1–P5） | [worklog/2026-09-27-实体中心UX重构.md](worklog/2026-09-27-实体中心UX重构.md) |
| 2026-09-26 | Token 去向面板 + 许可证机器码修复 | [worklog/2026-09-26-token面板与许可证机器码修复.md](worklog/2026-09-26-token面板与许可证机器码修复.md) |
| 2026-09-21 | 藏经阁 PG 化 + 一键提取 | [worklog/2026-09-21-藏经阁PG化与一键提取.md](worklog/2026-09-21-藏经阁PG化与一键提取.md) |
| 2026-09-21 | 缺陷修复 + 20 章端到端验证 | [worklog/2026-09-21-缺陷修复与20章端到端验证.md](worklog/2026-09-21-缺陷修复与20章端到端验证.md) |
| 2026-09-18 | 上下文装配图重设计 + 地基修复 | [archive/worklog/2026-09-18-上下文装配图重设计与地基修复.md](archive/worklog/2026-09-18-上下文装配图重设计与地基修复.md) |
| 2026-09-06 | Token Plan 接入 + 新项目 E2E | [archive/worklog/2026-09-06-token-plan接入与新项目E2E.md](archive/worklog/2026-09-06-token-plan接入与新项目E2E.md) |
| 2026-08-27 | LM Studio 接入 + 文档体系治理（本地 provider 已弃用） | [archive/worklog/2026-08-27-lmstudio接入与文档治理.md](archive/worklog/2026-08-27-lmstudio接入与文档治理.md) |

> 更早的逐会话结论（含无独立 worklog 的会话）全文见 `docs/archive/session-conclusions-archive.md`。

---

## 三、运行时状态

- 后端 3001：`npm start`（`scripts/serverStart.js`，daemon 化，日志落 `logs/`），PostgreSQL（`USE_PG=true`），健康。
- 前端 5173：`cd client && npm run dev`（Vite + React19）。改前端后若界面不更新：`node scripts/killPort.js 5173` 后重启。
- **LLM**：`aliyunCoding` / `qwen3.6-plus` @ 阿里云 token-plan 网关（`.env` 的 `ALIYUN_CODING_BASE_URL`）。LM Studio 已弃用（27B 太慢）。
- **当前主力验证项目**：`逆江湖_苍生为局_20章` `5d512269-3b0b-4e33-bb7d-ac7310bbe73d`（20/20 章 material-updated）。
- 旧验证项目：`仙师好评_云端E2E`、守灵人 `f91ea3b0`（均弃用不复跑）。
- 孤儿数据：已 `node scripts/scanOrphans.js --clean` 清理；日常体检 `node scripts/scanOrphans.js`。
- 任务/时间线：新项目大纲生成后自动初始化；历史项目 `POST /api/quests/auto-init/:projectId` 补。
- 桌面按钮：`小说流水线-启动.bat` / `小说流水线-停止.bat`。
- UI 巡检：`node scripts/uiBugCheck.js`（Playwright，22 页）。
- 已知非bug：`/comic/config` 报 503 "ComfyUI not running" = 外部服务未装的预期提示。

---

## 四、待办（按优先级）

### 🔴 需用户本人操作
- [ ] 注册每日数据库备份：`scripts\registerBackupTask.bat`（建议 `--out D:/pgbak` 到另一块盘）；季度跑 `npm run backup:restore-test`。
- [ ] 确认后跑 100 章长程验证：`node scripts/run20ChapterE2E.js --chapters 100 --yes`（≈1000万tokens ≈¥20 ≈3.3h）。
- [ ] 给新项目设预算上限（默认不限）：`PUT /api/maintenance/budget/:projectId`。
- [ ] 删除 Windows User 级旧 `ALIYUN_CODING_API_KEY`（38字符，已失效）：`reg delete "HKCU\Environment" /v ALIYUN_CODING_API_KEY /f`。
- [ ] `DEEPSEEK_API_KEY` 仍是占位符（实测 401），备用通道不可用。
- [ ] 轮换 5 个进过 git 历史的密钥（阿里云/DeepSeek/REQUEST_SECRET/ENCRYPTION_SECRET/DB密码）——push 远端前先处理。
- [ ] LM Studio 试加载 uncensored-MTP 版（可选，崩溃码 `0xC0000409` 待复现）；或接受标准版。
- [ ] 决定 modelBakeoff 候选模型名单并授权消耗额度。

### 🟠 P1 质量与 CI
- [x] **假成果批次 B（P1 补真）·代码侧已完成（2026-10-19）**：B3 `craft_materials` **删表**（migration `v0008` 已 DROP，代码+文档清理）；B2 `worldScope` onWriterPrompt **补真**（改用真实 `buildWorldScopePrompt`）+ onReaderCheck **下线**；B1 `craftWriteGate` 已覆盖全部实体写入路径；B4 交付 `scripts/audit-technique-cards.js`。
- [ ] **假成果批次 B（数据侧，待做）**：B1 存量 104 实体 / 114 处工艺违规回炉（`audit-craft-quality --strict` 0 违规）；B4 补 184 条 `implementation_rules` + 224 条 `judgement_test`（需 LLM 重提取/源小说）。脚本与 `--strict` 门禁已就绪。
- [x] **假成果批次 D（小步，2026-10-19 全部完成）**：D1 基础分尺度修正 + 停用技法过滤 + 差分加权（`feedbackDelta`）；D2-a 原子键去重 / D2-b 专名禁令（可扩展配置）/ D2-c 称谓模版 / D3-a 留出集 / D3-b 双盲去标签。锚点：`worklog/2026-10-19-假成果修复-批次A与治理门禁.md` §九。
- [x] **B1/B4「数据侧」决策（2026-10-19）**：**不回炉改写既有内容**（遵从用户定调）；改由源头门禁守护（craftWriteGate / 提取 prompt 强制 judgement_test / audit-* --strict）。
- [ ] C4/C5：验收凭据规范化（✅ 行须可执行断言）/ 陷阱"通用修法"评审关。
- [ ] **P1-4d 密度策略**：新增 `config/densityPolicy.js` + `densityResolver.js`（优先级：点名>区间命中>同场>题材字段>默认），装配记录写 `densityReason`。锚点：`docs/worklog/2026-09-29-章节因果门槛与素材装配计划书.md`、`design/章节因果门槛与单点素材装配（计划书）.md` §八。
- [ ] 复验长度锚点效果（大纲四段节拍 + 执笔中途检查点）：重跑 1~2 章看字数是否稳定 ≥2500。
- [ ] 主力项目剩余 7 章低于 2500 字（2,084~2,415）是否回炉（末轮宽限已保成品，非阻塞）。
- [x] **改动走五关门禁提交**（2026-10-19 批次 A + 治理门禁，走 pre-commit 五关 + 新增两关）。
- [ ] genre 命名混乱统一评估（目录 `high-martial-crossplane` / 插件 id `high-martial-comedy` / label）。
- [ ] 5 文件覆盖率阈值（genreConfig/healthCheckers/healthMonitor/materials路由/initializeRoutes）；53 核心路由缺输入验证；LLM 请求级超时分级；实体/素材不一致自动修复；frontend vitest 覆盖率纳入 CI。

### 🟡 P2 治理
- [ ] PG 单轨收尾：`data/` 运行时 JSON 目录归档策略。
- [ ] `scripts/` 约 40 个 `tmp_*`/`debug*` 一次性脚本归档到 `scripts/tmp/`。
- [ ] 死文件清理：`server/routes/apiKeyRoutes.js`、`server/routes/admin.js`（均未挂载）、client `pipelineConstants` 重复定义。
- [ ] `materialFinder.findCharacterMaterial` 与 `materialCharacterFinder` 语义合并评估。

### 🟢 P3 功能
- [ ] Token 面板后续优化：分层记忆恒定占 40%（按步裁剪/公共前缀缓存）、Agent 提示词 31 处截断丢 9 万（排查约束规则是否被砍，与 sop/08 相关）。
- [ ] 质量反馈闭环 / EPUB 导出 / 模型分层策略落地。

---

## 五、常用命令速查

```bash
npm run check              # 20项健康自检
npm run test:unit          # 单测（必须全绿才算完成）
npm run ci:check           # CI全量
node scripts/audit-iron-law.js --self-check   # 铁律互斥自检（改规则前后必跑）
node scripts/audit-iron-law.js --pre-deliver  # 交付前扫描（含新文件）
node scripts/uiBugCheck.js                    # 前端22页巡检
npm start / npm stop       # 后端起停
node scripts/killPort.js 5173                 # 前端端口占用时释放

# 数据/巡检
node scripts/scanOrphans.js                   # 孤儿数据扫描（干跑，安全）
node scripts/scanOrphans.js --clean           # 实际清理
node scripts/repairRegistryDrift.js           # 数据漂移体检（roleLevel/reviewType/tags/多主角）
node scripts/run20ChapterE2E.js --resume <pid>                 # 20章E2E续跑
node scripts/run20ChapterE2E.js --resume <pid> --only 4,15 --force  # 定向强制复验
```

---

## 六、协作约定（用户已确认）

- **设计理念（用户明确定调，最高优先级）**：**不改已存在的小说内容 → 在源头生成环节解决**；拒绝堵漏式/头痛医头脚痛医脚/打补丁/硬编码；以**开源·模块化·灵活**为设计理念；**每次只改一点点**，不堆屎山；**不追求绝对效率，质量与稳定第一，体验其次，效率最后**。（详见 `PROJECT_STANDARDS.md` §一 原则 10）
- **写代码前的第一问（用户明确定调，最高优先级）**：**这段代码是为谁写的？谁是它的运行时消费者？**
  消费者=真实业务路径上的调用方（路由/pipeline/启动流程/前端页面）；**测试不是消费者**。
  没有消费者的代码不许写；已存在且无效的**直接删**（连同只为它而写的测试）。反模式与自查方式见
  `PROJECT_STANDARDS.md` §一 原则 11、`CLAUDE.md`/`AGENTS.md` 接手必读第 10 条。
- 删除文件/改全局配置/改安装前**先征得确认**；只读检查可直接做。（删死代码已获用户总授权：认定无效无用即删）
- 用户已授权按本文件计划推进修复，但破坏性 git 操作（history rewrite）仍需单独确认。
- 回答用中文；改动后跑对应测试验证再提交；提交走 pre-commit 五关门禁；**命令执行优先 cmd**（本机不支持 PowerShell）。
- **长任务必须建工作日志**（`docs/worklog/`），上下文压缩前先落盘（见 `docs/sop/10-上下文交接规范.md`）。
- **本卡写作纪律**：只写"当前状态 + 一行索引"，细节一律进 `worklog/` 或 `archive/`；全文 ≤200 行，超了说明又在往这塞过程。
