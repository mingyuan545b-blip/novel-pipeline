# 2026-10-11 验证会话状态（对话落盘，防上下文压缩失忆）

## 任务
在 novel-pipeline 新建 10 章项目，验证前序修改是否有效：取名标准性 / 人物设计 / 章节质量 /
每个 agent 的前后工序资料交接 / 职责划分；问题按【根因】修复，不补丁堵漏。

## 已完成
1. **OOM 根因定位与修复（P0，阻塞级）**
   - 现象：`POST /api/projects/initialize` 时后端 OOM 崩溃（heap used 12.2GB / limit 13GB）。
   - 取证：崩溃转储 external 仅 4MB → 是 **JS 堆**被撑爆，非 native。
   - 对照实验：`node server/index.js > file`（stdout→文件）与 `serverStart.js > file` 均**稳定 ~50MB**；
     生产 `serverStart.js stdio:'inherit'`（stdout 为调用方管道）在后台任务/管道读端停摆时 **必崩**。
   - 根因：daemon 继承了调用方的 stdout 管道；读端停摆 → Node 把 stdout 写入缓存在 JS 堆无限堆积；
     `--trace-gc` 持续刷屏把增长放大 → 12GB OOM。
   - 修复：`scripts/serverStart.js` 改为 **daemon 化**：`detached:true` + stdout/stderr 重定向到
     `logs/server.out.log`/`server.err.log`（不继承调用方管道）；`--trace-gc` 改为 `TRACE_GC=1` 才开。
   - 验证：修复后 initialize 全程 heap ~40-70MB，服务存活。

2. **静态核对（20_agents.js）**：Agent 职责/交接契约 68/71。
   - 缺口①：`intent-planner`、`consistency-constraint` 在 `KNOWN_STEP_KEYS` 但 **dataFlowSpec 无条目**。
   - 缺口②：`reader.constraintNeeds = {}`（职责声明不完整）。
   - 闸门漏洞：`audit-vocabulary-consistency.js#checkDataFlowSpec` 只校验 `StepRegistry.getMigratedSteps()`（11 步），
     未迁移步骤（intent-planner/consistency-constraint）**漏检** → 规范可漂移。

## 待办
- [ ] 修复契约漂移（补 dataFlowSpec 条目 + 闸门改按权威步骤集校验）
- [ ] 待选一个干净项目跑 10 章，收集动态证据（交接/质量/取名/人物设计）
- [ ] 动态验证：context-assembly 每 agent 装载、章节质量 M1-M11、取名体检
