# SESSION-STATE — 跨窗口接手状态卡

> 新窗口/新AI接手时：先读本文件（2分钟），再按任务读 docs/INDEX.md 对应SOP。
> 本文件只记录"当前状态与待办"，架构细节看 ARCHITECTURE.md。
> 最后更新：2026-08-23

---

## 一、当前结论（重要）

1. **项目骨架健康，不需要大重构**：3496/3496 单测通过、213/213套件、eslint 0错误、前端6秒构建。问题都是"漂移型"（测试/文档与代码失同步、仓库卫生），做纠偏即可。
2. **文档记录不完全可信**：此前由降智模型编写，陷阱清单等需以代码和测试实测为准（本会话已发现并修复9处记录与代码矛盾）。
3. **铁律系统已重建**（2026-08-23）：规则唯一定义源 `scripts/lib/ironLawRules.js`；场景化 block/warn/skip 处置；`node scripts/audit-iron-law.js --self-check` 做互斥自检。改规则必须先过自检。

## 二、本会话已完成（git log 2026-08-23，全部过五关pre-commit门禁）

| 提交 | 内容 |
|---|---|
| 7a79780 | .env/密钥/产物移出git跟踪，.gitignore强化（含6641个node_modules文件） |
| fe5b3e4~20a0266 | 悬空重构代码分4组落库（文档/后端/前端/基建） |
| 3d4ec9d | 铁律系统重建：共享规则+场景分支+互斥自检+钩子统一(.githooks) |
| 2abb66f | 4个超200行文件拆分（零行为变更）+ 过期题材测试修复 |
| 66fef17 | modelBakeoff.js 模型对比评测脚本 |
| b86d84b | UI大面积加载失败修复：全局限流200→1200/分（123处429根因）+ settings页8处裸fetch改鉴权api（401根因） |
| 5f6af62 | 桌面启动/停止按钮（launcher/，桌面有副本） |

## 三、运行时状态

- 后端3001：`npm start`（scripts/serverStart.js），PostgreSQL(USE_PG=true)，健康
- 前端5173：`cd client && npm run dev`，Vite+React19
- 桌面按钮：`小说流水线-启动.bat` / `小说流水线-停止.bat`（一键起停+开浏览器）
- UI巡检：`node scripts/uiBugCheck.js`（Playwright，22页，报告在output/ui-bugcheck/）
- 已知非bug：/comic/config 报 503 "ComfyUI not running" = 外部服务未装的预期提示

## 四、待办（按优先级）

### 🔴 需用户本人操作
- [ ] **轮换5个进过git历史的密钥**：阿里云key、DeepSeek key、REQUEST_SECRET、ENCRYPTION_SECRET、DB密码（历史提交7a79780之前含明文，未来push远端前建议 git filter-repo 清理）
- [ ] 决定 modelBakeoff 候选模型名单并授权消耗少量API额度

### 🟠 P1 质量与CI
- [ ] 2个超100行函数拆分：orchestratorStepLoop.js executeStepLoop(106行)、agentPromptAssembler.js assembleAgentPrompt(115行) —— CI `--max-warnings=0` 因此红
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
node scripts/modelBakeoff.js --models A,B --dry-run  # 模型对比(先dry-run)
npm start / npm stop       # 后端起停
```

## 六、协作约定（用户已确认）

- 删除文件/改全局配置/改安装前先征得确认；只读检查可直接做
- 用户已授权按本文件计划推进修复，但破坏性git操作（history rewrite）仍需单独确认
- 回答用中文；改动后跑对应测试验证再提交；提交走pre-commit五关门禁
