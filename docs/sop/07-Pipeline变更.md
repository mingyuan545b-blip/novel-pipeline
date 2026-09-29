# Pipeline变更SOP

> 触发条件：step/契约/数据流/Agent变更
> 前置：已读 [00-陷阱清单.md](00-陷阱清单.md)（特别关注#20-#22契约陷阱）

---

## 一、Pipeline架构概览

```
runFullPipeline（单章完整流水线）
1. chapterIntent  → 章节意图(goal/mustKeep/mustAvoid)
2. hookBudget     → 伏笔议程(推进/回收/预算)
3. ruleStack      → 规则栈(L1-L4分层约束)
4. beatAllocator  → 节拍分配(每章3-8个节拍+技法绑定)
5. runPipelineStep → 执行Agent步骤
   ├── writer        → 生成正文
   ├── first-review  → 初审(或fast-review)
   ├── second-review → 复审
   ├── final-editor  → 定稿
   ├── reviser       → 返修(审核不通过时)
   ├── material-manager → 素材提取/更新
   ├── polisher      → 润色
   └── reader        → 阅读评审
6. memory.updateAfterChapter → 更新5层记忆
7. consistency.quickCheck → 一致性检查
8. stateSnapshot → 创建快照
9. imageGen → 生成插图(可选)
```

---

## 二、三层防线（禁止绕过）

### 2.1 输入契约（pipelineContract.js）
- 覆盖所有10个agent的输入校验
- 契约错误码格式：[步骤前缀]-[序号]（如W-001/P-001）
- 阈值必须来自systemConfig.js的PIPELINE_CONTRACT常量（见陷阱#22）

### 2.2 输出契约（pipelineOutputContract.js）
- 覆盖所有agent的输出格式+内容合规
- 禁止写空壳检查（见陷阱#21）

### 2.3 污染检测（pipelinePollutionGuard.js）
- 检测角色名污染/素材重复/设定偏移
- 偏移就是Bug，不是"自由创作"（见陷阱#20）

---

## 三、Agent变更路径

### 3.1 新增Agent
1. 在 `server/services/pipeline/steps/` 创建agent文件
2. 定义输入契约 → pipelineContract.js追加校验
3. 定义输出契约 → pipelineOutputContract.js追加校验
4. 声明数据流 → dataFlowSpec.js追加PUSH/PULL
5. 定义错误码 → pipelineErrors.js追加
6. 注册到orchestrator或chapterExecutor的步骤序列

### 3.2 修改Agent prompt
1. 所有prompt组装必须走统一agent prompt assembly system
2. 关系阶段守卫注入在prompt最前面（见sop/01第六节）
3. 题材约束通过constraintInjector统一注入，禁止独立注入
4. 风格约束通过styleInjector统一注入

### 3.3 Agent路由变更
- LLM路由配置在providerRegistry.js
- 新模型必须检查enable_thinking默认值（见陷阱#8/#11）
- TPM限流通过rateLimiter.js的TokenBucketLimiter

---

## 四、数据流变更路径

### 4.1 PUSH/PULL声明
文件：`server/services/pipeline/dataFlowSpec.js`
```js
{
    agent: 'writer',
    PUSH: ['chapters', 'materials'],  // 写入的表
    PULL: ['chapters', 'materials', 'memory-layers']  // 读取的表
}
```

### 4.2 上下游同步
- 修改数据结构必须同步上下游
- 新增输出字段必须同步下游agent的PULL声明
- 删除字段必须确认无下游依赖

---

## 五、契约变更路径

### 5.1 新增契约校验
```js
// pipelineContract.js
writer: {
    requiredInputs: ['outline', 'materials', 'memory'],
    validate: (inputs) => {
        const errors = [];
        if (!inputs.outline) errors.push({ code: 'W-001', msg: '大纲缺失' });
        return { valid: errors.length === 0, errors };
    }
}
```

### 5.2 契约错误码规范
- 格式：[步骤前缀]-[序号]
- 前缀：W=writer, FR=first-review, SR=second-review, FE=final-editor, RV=reviser, MM=material-manager, PL=polisher, RD=reader
- 错误码必须注册到pipelineErrors.js

### 5.3 契约阈值
- 所有阈值必须来自systemConfig.js的PIPELINE_CONTRACT
- 禁止硬编码（见陷阱#22）

---

## 六、验证清单

### 6.1 契约验证
- [ ] pipelineContract.js覆盖新增agent
- [ ] pipelineOutputContract.js覆盖新增agent
- [ ] pipelineErrors.js追加错误码
- [ ] dataFlowSpec.js声明PUSH/PULL
- [ ] 所有阈值引用PIPELINE_CONTRACT常量

### 6.2 运行验证
- [ ] npm run restart 服务器能启动
- [ ] /api/health返回200
- [ ] /api/pipeline/dataflow/spec 返回完整数据流图
- [ ] /api/pipeline/dataflow/graph 返回完整依赖图
- [ ] /api/pipeline/output-contracts 返回所有输出契约
- [ ] /api/pipeline/full-diagnose 返回健康

### 6.3 端到端验证
- [ ] 用真实项目跑一章（runFullPipeline）
- [ ] preflight检查通过
- [ ] postflight检查通过
- [ ] pollutionCheck通过
- [ ] 章节内容生成正常
- [ ] 素材提取正常

---

## 七、常见陷阱

### 7.1 genre=null裸奔
- 根因：未用resolveGenreFromProject（见陷阱#23）
- 修复：所有Pipeline代码必须用resolveGenreFromProject(project)

### 7.2 契约空壳检查
- 根因：check直接return true（见陷阱#21）
- 修复：删除空壳检查或实现真实校验

### 7.3 阈值硬编码
- 根因：契约阈值写死在代码里（见陷阱#22）
- 修复：引用systemConfig.js的PIPELINE_CONTRACT常量

### 7.4 绕过统一调度
- 根因：独立调用buildGenreOutlineInjection等（见陷阱）
- 修复：必须通过constraintInjector + styleInjector统一调度

---

## 何时更新本文件

- Pipeline步骤序列变化 → 更新第一节架构概览
- 新增Agent → 追加到第三节Agent变更路径
- 契约规范变化 → 更新第五节契约变更路径
- 三层防线规则变化 → 更新第二节
- 发现Pipeline相关新陷阱 → 追加到 [00-陷阱清单.md](00-陷阱清单.md) 模块与契约类

**更新后必读**：[MAINTENANCE.md](../MAINTENANCE.md) 确认是否还需更新 [reference/题材插件规范.md](../reference/题材插件规范.md)。

---

## 二、轮次与字数（2026-09-21 补充，改动前必读）

### 轮次语义（双轨）
- `round` = **跨运行累计轮次**（`startRound = chapter.round + 1`，`chapter.round` 由 writer/reviser/final-editor 推进）
- `runRound` = **本次运行第几轮**（由 `server/shared/runContext.js` 的 AsyncLocalStorage 透传）
- pipeline 日志与 reviews **都必须带两者**；reviews 的 `runRound` 由 `store.setItem` 单点注入，新增 review 写入点无需手动补
- 前端展示：`第{runRound}轮(累计{round})`

### 字数门禁（四道，必须共享同一宽限口径）
| 顺序 | 位置 | 说明 |
|---|---|---|
| 1 | 执笔自检 `writerPostProcess` | 低于 rejectMin → 该轮失败 |
| 2 | `checkWordCountHardLimit` | first/fast/second-review 前硬拦 |
| 3 | 初审硬性检测 `checkWordCountGate` | 原为不可覆盖 hardBlock |
| 4 | 输出契约 PO-001 | 润色后 ≥ 输入 80% |

- **末轮宽限**：`LAST_ROUND_GRACE_RATIO = 0.8`（唯一定义源 `pipelineHelpers/pipelineWordCount.js`）。
  已无重试轮次且缺口 ≤20% → 不硬拦，交由审核链"系统覆盖"判定；改阈值只改这一处。
- **严重不足区**：`needsShortfallSalvage`（≥30% 目标下限）→ 走 reviser 结构化扩写，不再整章重生成。
- **润色守卫**：`polisher.guardPolishedLength` —— 正文已低于下限时，润色只许持平或变长。
- 新增任何"改写类"步骤（polisher/rewriter/...）都必须加绝对下限守卫（陷阱 #109）。

### 技法注入数据源（2026-09-21 变更）

- **注入链未变**：`techniqueScheduler.scheduleTechniques()` 仍按 injection_point/sceneTypes/phase/feedbackRates
  打分取 Top5 拼进 writer/polisher prompt。
- **数据源变了**：藏经阁技法由 JSON 文件改为 **PG 表 `library_techniques`**，通过
  `techIndex.js` 在启动时载入**内存视图**（`server/index.js` → `techIndex.initFromPg()`），
  对外保持**同步**API（scheduler 是同步调用，不能直接 await PG）。
- **改技法后必须刷新**：任何写入/删除技法（提取入库、前端编辑、元数据更新）都要 `await techIndex.reload()`，
  否则内存视图与PG不一致，注入链会用旧数据（`libraryStore`/`validationEngine` 已内置）。
- **兜底**：PG 不可用或为空时自动回落 `server/data/library/*.json`（`techIndexJsonSeed.js`），
  注入链不会因存储异常而断，但此时数据可能与PG不一致（日志会 WARN）。
- 详情见 [ARCHITECTURE.md §十五](../../ARCHITECTURE.md)。

### 任务终止态
- 只认 `asyncTaskManager.isTerminal(status)`；看门狗超时写 `status='timeout'`，前端/脚本必须按终止态处理（陷阱 #107）。

### 项目预算熔断接入 llm.chat（2026-09-30）

**改 Pipeline 时必须知道**：所有 LLM 调用（含 agentRunner 之外的材料/大纲生成）都经过
`services/llm.js` 的 `chat()`，那里有一道项目预算闸门：

```
llm.chat → llmBudgetGuard.begin(options)
              ├─ resolveProjectId：options.projectId > runContext(ALS).projectId
              └─ assertProjectBudget：超限抛 BudgetExceededError（code=BUDGET_EXCEEDED）
         → 请求成功 → llmBudgetGuard.record(...) 累加到 project-spend
```

改动须知：
- **新增 Agent/调用方要传 `projectId`**（或确保在 `runWithContext({projectId})` 内），
  否则该调用不受预算约束、也不计入累计消耗（静默漏账比报错更危险）。
- **不要把预算断言搬回 agentRunner**：那样会重新漏掉 `outlineGenerator` 这类直连 llm.chat 的调用方
  （2026-09-30 实测：限额 1 token 时 generate-materials 仍跑通）。
- `BudgetExceededError` **不应重试**（不是网络抖动）。上游若做重试，必须先判 `err.isBudgetExceeded`。
- 流水线停机：`infinite/stopConditions.js` 在章节边界查预算，超限时优雅停机并写日志。
- `usageStep` 用于把消耗归属到具体步骤（预算报表的 byStep），agentRunner 已自动带上。
