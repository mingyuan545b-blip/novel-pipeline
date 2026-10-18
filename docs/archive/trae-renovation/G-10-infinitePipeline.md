# G-10: infinitePipeline.js 重构改造清单

> 文件: `server/services/pipeline/infinitePipeline.js` | 行数: ~936→1 | 优先级: P1

## 改造步骤

### IP-01: 提取状态管理器 ✅
- [x] 创建 `server/services/pipeline/infinite/stateManager.js` (~170行)
- [x] 移入: INFINITE_PIPELINE_STATE, getState, setState, cleanupStale, persistState, getInfinitePipelineStatus, forceResetPipeline, MAX_STATE_ENTRIES

### IP-02: 提取批量执行器 ✅
- [x] 创建 `server/services/pipeline/infinite/batchExecutor.js` (~680行)
- [x] 移入: runInfinitePipeline, stopInfinitePipeline, 核心循环逻辑

### IP-03: 提取心跳监控 ✅
- [x] 创建 `server/services/pipeline/infinite/heartbeat.js` (~50行)
- [x] 移入: startHeartbeat, clearHeartbeat

### IP-04: 重写主入口 ✅
- [x] 创建 `server/services/pipeline/infinite/index.js` (~18行)
- [x] infinitePipeline.js 缩减为1行代理: `module.exports = require("./infinite/index")`
- [x] 保持导出接口不变

### IP-05: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（237测试全通过）

## 最终结构
```
server/services/pipeline/
├── infinitePipeline.js              (1行, 代理)
└── infinite/
    ├── stateManager.js              (~170行, 状态管理)
    ├── batchExecutor.js             (~680行, 批量执行)
    ├── heartbeat.js                 (~50行, 心跳监控)
    └── index.js                     (~18行, 统一入口)
```

## G-10改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| infinitePipeline.js | 936行(单文件) | 1行(代理) | ✅已拆分 |
| + stateManager.js | - | ~170行 | ✅新增 |
| + batchExecutor.js | - | ~680行 | ✅新增 |
| + heartbeat.js | - | ~50行 | ✅新增 |
| + index.js | - | ~18行 | ✅新增 |
