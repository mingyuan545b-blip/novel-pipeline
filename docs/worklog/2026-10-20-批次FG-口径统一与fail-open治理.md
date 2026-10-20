# 2026-10-20 · 批次 F/G：lint 口径统一 + fail-open 声明式治理

> 承接 `2026-10-19-批次E-门禁可信化施工.md`。用户指令：**"先统一口径，然后把后面的一起做了"**（授权删死代码）。
> 本文件记录：G18/G19 口径统一、G1 fail-open 治理，以及 H（数据侧）的现实评估。

---

## 一、口径统一（G18/G19）

### 真相：所谓 "client lint 392 errors" 里 371 条是构建产物
`npm run lint`（client `eslint .`）报 372 errors，其中 **371 条来自 `client/dist_backup/assets/*.js`**
—— 历史构建产物备份（未跟踪、但 `client/eslint.config.js` 只忽略了 `dist`/`coverage`，没忽略 `dist_backup`），
即把一个压缩后的 bundle 当源码 lint。剩余 1 条是 `vite.config.js` 的 `process` no-undef。

### 统一前：同一仓库四套 lint 调用（互不等价、互不覆盖）
| 入口 | 命令 | 问题 |
|---|---|---|
| 根 `lint` | `eslint server/{services,core,config,middleware,shared}` | 只扫 server 的 5 个子目录（漏 routes/scripts） |
| 根 `lint:tests` | `eslint tests --max-warnings=0` | **不在 CI 任何 job 里** |
| CI backend-lint | `eslint server --max-warnings=0` | 与根 `lint` 不同 |
| CI frontend-lint | `eslint src --ignore-pattern "__tests__"` | 该 ignore 写法对嵌套路径**无效** |

### 统一后：一域一命令，本地与 CI 同源
```
lint:server = eslint server --max-warnings=0          → CI backend-lint 第 1 步
lint:tests  = eslint tests --ext .js --max-warnings=0 → CI backend-lint 第 2 步（新增，G19 关闭）
lint:client = npm --prefix client run lint（eslint .）→ CI frontend-lint（含配置文件与测试）
lint        = 三者串联（本地一键）
```
配套：client 忽略 `dist/dist_backup/node_modules` + 配置文件用 node globals（修掉 `process` 报错）；
根 eslint 登记项目内断言辅助函数 `verifyTrim` 与测试块别名 `dbTest`/`covTest`；
删除本地构建残留 `client/dist`、`client/dist_backup`、`.next`（未跟踪、可重建）。

### tests/ 的 76 处测试质量告警 → 0（且首次进 CI 校验）
58 条件内 expect / 14 零断言 / 3 standalone / 1 valid-expect，逐条按语义修正（不是加 disable）：
- 前置条件 → 无条件断言（29 处，前提先实测确认成立）；
- 环境相关条件 → **蕴含断言**（19 处，如 `expect(result.ok || result.error !== undefined).toBe(true)`）；
- 循环内 expect → 收集后整体断言；零断言测试 → 补真断言（storeLock 改为**测锁语义**：
  互斥阻塞、不同 key 不互阻；metricsPersistence 用 fake timers 断言 timer 不叠加…）。

**顺带挖出 3 个被"条件内 expect"长期掩盖的真问题**：
1. `materialLifecycleService` 相似度夹具算错（注释称 0.8，实为 Jaccard 3/5=0.6）；
2. `lockMechanism` 断言的 `store._lockQueues` **该内部早已移除** → 整测静默跳过；
3. `lockMechanism` 写入 `projects` 时 `name` 被字段裁剪丢弃 → 改用 `materials`（列含 name）。
另：`tests/e2e/e2eMaterialInjection` 里"reviser 入口"试探的三个名字**全不存在**（真导出是 `buildReviserContext`）
→ 该用例长期空转，已改为调用真实导出。

---

## 二、G1 fail-open 治理：从"计数基线"升级为"站点级声明式降级"

旧门禁（`audit-failopen.js`）只做全仓**计数**并与基线比"不上升"，盲区：
①新增一处 fail-open、别处少一处 → 计数不变，抓不到；②无法表达"这处降级是否可接受"。

本次：
1. 新增 `scripts/lib/failopenSites.js`：口径下沉到**站点**（file:line + 片段），
   支持**声明式降级** —— catch 行内写 `// DEGRADE: 影响=… 可见性=…` 即为已声明。
2. 重写 `audit-failopen.js`：`--strict` 下"未声明且不在基线清单" = **ERROR（源头拦截新增）**；
   存量未声明 = WARN；计数仍只许下降。`--update-baseline` 写"存量未声明站点清单"。已接入 `ci:check`。
3. 全仓 **247 处**（pipeline 137）逐站点补声明，文本**事实性**：由所在 try 的真实调用名派生
   （如 `影响=ctx.detectTimelineConflicts 失败→本步跳过… 可见性=仅日志`），
   自动定位不到的 32 处**逐个手工阅读后命名**，**0 处空话**。
   采用**行内**写法（与 catch 同行）→ 不增加行数（首版曾顶破 3 个文件的 200 行门禁，已修）。
4. 顺手修 2 处**既有铁律违规**（status 字面量散落）：`routes/chapters.js`、`infinite/stateManager.js`
   改用 `STATUS_VALUES` 常量（因本次注释改动使这两文件进入提交，pre-commit 才扫到）。

**验收**：反向验证（注入一处只 log 的 catch → `--strict` 立即 ERROR 并列出站点）；
`--strict` 通过；247/247 已声明；`npm run lint` 三域绿；`test:unit` 290 套件/4098 例绿；200 行 0 超限；
真 CI **11/11 全绿**（含 gates 全链）。

---

## 三、遗留（诚实清单）

| 编号 | 内容 | 卡点 |
|---|---|---|
| **G1-可见化** | 声明只说明影响，降级仍只进日志文件；要让"本章初审少了 X 检查"对用户可见，需定落点（章节字段 / 审计表 / UI 面板） | **需设计决策**（按铁律：没有明确消费者的代码不许写，故不动行为） |
| **G1-真处理** | 137 处 pipeline 降级里，涉及**数据/状态**的（如落库失败）应改为上抛或告警，而非仅声明 | 需逐处判断影响面，建议分批 |
| **G20** | CI `frontend-test` 曾一次性失败（942 例全过、覆盖率门槛也满足，仅退出码 1；本地 3/3 全绿，重跑即过） | 疑 runner 侧抖动，需持续观察 |
| **G16** | `server/shared/debugPgWriter.js` 覆盖率取决于"有无真 PG"（环境耦合） | 宜改为可注入 |
| **G15** | `rateLimiter*` / `tokenBucketLimiter` 用真实 `setTimeout/Date.now`，负载高时漏分支 → 覆盖率抖动（已用粒度容差兜住） | 建议改 fake timers |
| **H** | 数据侧：技法卡 184 条缺 `implementation_rules`、224 条 `judgement_test` 覆盖 0；工艺存量 104 实体/114 处违规 | **卡在数据源与成本**：真实源小说仅 2 本，且既有裁决是"不回炉、旧条目走重新提取（源小说+LLM）" → 需用户决定是否投入 LLM 重提取，或继续"源头门禁 + 自然淘汰" |
