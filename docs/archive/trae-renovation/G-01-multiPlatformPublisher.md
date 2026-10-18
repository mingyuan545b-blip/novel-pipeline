# G-01: _multiPlatformPublisherLegacy.js 拆分改造清单

> 文件: `server/services/_multiPlatformPublisherLegacy.js` | 行数: ~2334→1 | 优先级: P0

## 改造步骤

### MP-01: 提取发布器基类 ✅
- [x] 创建 `server/services/publishers/PublisherBase.js` (~340行)
- [x] 提取公共方法: connectBrowser, ensureLogin, closeBrowser, checkLoginStatus, waitForLogin, dismissEditorGuides, handleInterceptors, debugPageInputs, takeScreenshot, stopPublish, closeAllBrowsers
- [x] 提取公共状态管理: publishStates, getPlatformState, getAllStates, addLog
- [x] 提取PLATFORMS配置常量

### MP-02: 提取番茄小说发布器 ✅
- [x] 创建 `server/services/publishers/fanqiePublisher.js` (~310行)
- [x] 移入 fillSerialInput, fillTitleInput, publishChapterToFanqie, verifyFanqiePublished

### MP-03: 提取七猫小说发布器 ✅
- [x] 创建 `server/services/publishers/qimaoPublisher.js` (~640行)
- [x] 移入 publishChapterToQimao, updateChapterToQimao, updateChaptersToQimao

### MP-04: 提取敏感词处理 ✅
- [x] 创建 `server/services/publishers/sensitiveWordFilter.js` (~20行)
- [x] 移入 filterContent 包装函数

### MP-05: 重写主入口 ✅
- [x] 创建 `server/services/publishers/index.js` (~240行)
- [x] _multiPlatformPublisherLegacy.js 缩减为1行代理: `module.exports = require('./publishers/index');`
- [x] 保持导出接口不变，routes/publish.js无需修改

### MP-06: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（237测试全通过）

## 最终结构
```
server/services/publishers/
├── PublisherBase.js          (~340行, 基础设施+公共方法)
├── fanqiePublisher.js        (~310行, 番茄小说)
├── qimaoPublisher.js         (~640行, 七猫小说)
├── sensitiveWordFilter.js    (~20行, 敏感词过滤)
└── index.js                  (~240行, 统一入口+路由调度)
```

## G-01改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| _multiPlatformPublisherLegacy.js | 2334行(单文件) | 1行(代理) | ✅已拆分 |
| + PublisherBase.js | - | ~340行 | ✅新增 |
| + fanqiePublisher.js | - | ~310行 | ✅新增 |
| + qimaoPublisher.js | - | ~640行 | ✅新增 |
| + sensitiveWordFilter.js | - | ~20行 | ✅新增 |
| + index.js | - | ~240行 | ✅新增 |
