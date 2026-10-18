# G-04: pipeline.js 路由拆分改造清单

> 文件: `server/routes/pipeline.js` | 行数: ~1085→342 | 优先级: P0

## 改造步骤

### PR-01: 提取无限流水线路由 ✅
- [x] 创建 `server/routes/pipeline/infiniteRoutes.js` (~75行)
- [x] 移入: POST /, POST /stop, POST /reset, GET /status/:projectId
- [x] 导出 Express Router
- [x] 验证: npm run check + npm test 通过

### PR-02: 提取工具查询路由 ✅
- [x] 创建 `server/routes/pipeline/toolRoutes.js` (~230行)
- [x] 移入: context-budget, rule-stack, hook-budget, chapter-intent, context-trace, hook-budget/register, hook-budget/sync, rule-stack/extract, prompt-audit, prompt-audit-latest, injection-map
- [x] 导出 Express Router
- [x] 验证: npm run check + npm test 通过

### PR-03: 提取素材管理路由 ✅
- [x] 创建 `server/routes/pipeline/materialRoutes.js` (~240行)
- [x] 移入: toggle-material-lock, set-volume-subplane, generate-subplane-materials
- [x] 导出 Express Router
- [x] 验证: npm run check + npm test 通过

### PR-04: 提取模板生成路由 ✅
- [x] 创建 `server/routes/pipeline/templateRoutes.js` (~130行)
- [x] 移入: supplement-outlines, generate-from-template, shuangwen-oneclick（注：shuangwen-oneclick已随爽文模式移除）
- [x] 导出 Express Router
- [x] 验证: npm run check + npm test 通过

### PR-05: 提取任务管理路由 ✅
- [x] 创建 `server/routes/pipeline/taskRoutes.js` (~100行)
- [x] 移入: task/:taskId, clear-chapters-after, pipeline-logs（含定时清理逻辑和asyncTasks）
- [x] 导出 Express Router + _asyncTasks共享
- [x] 验证: npm run check + npm test 通过

### PR-06: 重写主路由 ✅
- [x] 修改 pipeline.js 为路由聚合器（1095→342行）
- [x] `router.use('/infinite', infiniteRoutes)` 等
- [x] 保留 POST /step 和 POST /full 在主文件
- [x] `server/index.js` 无需修改

### PR-07: 清理验证 ✅
- [x] 运行 `npm run check` 通过（19项全通过）
- [x] 运行 `npm test` 通过（237测试全通过）
- [x] 运行 `vite build` 通过（367模块，3.07秒）

## 最终结构
```
server/routes/
├── pipeline.js                    (342行, 路由聚合+核心运行端点+辅助端点)
└── pipeline/
    ├── infiniteRoutes.js          (~75行, 无限流水线)
    ├── toolRoutes.js              (~230行, 工具查询+审计+注入图)
    ├── materialRoutes.js          (~240行, 素材管理+次位面生成)
    ├── templateRoutes.js          (~130行, 模板生成，原爽文一键已移除)
    └── taskRoutes.js              (~100行, 任务管理+日志+清理)
```

## G-04改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| pipeline.js | 1095行(单文件) | 342行(路由聚合器) | ✅已拆分 |
| + infiniteRoutes.js | - | ~75行 | ✅新增 |
| + toolRoutes.js | - | ~230行 | ✅新增 |
| + materialRoutes.js | - | ~240行 | ✅新增 |
| + templateRoutes.js | - | ~130行 | ✅新增 |
| + taskRoutes.js | - | ~100行 | ✅新增 |
