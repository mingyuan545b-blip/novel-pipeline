# G-08: PublishPage.jsx 拆分改造清单

> 文件: `client/src/pages/PublishPage.jsx` | 行数: ~1100→285 | 优先级: P1

## 改造步骤

### PB-01: 提取发布配置面板 ✅
- [x] 创建 `client/src/pages/publish/PublishConfigPanel.jsx` (~260行)
- [x] 移入: 平台选择+参数配置+发布启动+登录控制+状态卡片+执行日志

### PB-02: 提取发布队列面板 ✅
- [x] 创建 `client/src/pages/publish/PublishQueuePanel.jsx` (~110行)
- [x] 移入: 批量配置+章节列表+格式复制+队列表格

### PB-03: 提取读者互动面板 ✅
- [x] 创建 `client/src/pages/publish/InteractionPanel.jsx` (~175行)
- [x] 移入: 添加互动表单+统计卡片+互动列表+回复输入

### PB-04: 提取自定义Hook ✅
- [x] 创建 `client/src/pages/publish/usePublish.js` (~280行)
- [x] 移入: 全部状态管理+API调用+轮询逻辑+辅助函数
- [x] 导出MULTI_PLATFORMS和defaultConfig常量

### PB-05: 重写主页面 ✅
- [x] PublishPage.jsx 从1100行缩减为285行
- [x] Tab切换+统计头部+3个面板组合+平台管理Tab(保留)+更新对话框(保留)

### PB-06: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（237测试全通过）
- [x] `vite build` 通过（390模块）

## 最终结构
```
client/src/pages/
├── PublishPage.jsx             (285行, 编排层+平台管理Tab)
└── publish/
    ├── usePublish.js           (~280行, 状态管理Hook)
    ├── PublishConfigPanel.jsx  (~260行, 发布配置)
    ├── PublishQueuePanel.jsx   (~110行, 发布队列)
    └── InteractionPanel.jsx    (~175行, 读者互动)
```

## G-08改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| PublishPage.jsx | 1100行(单文件) | 285行(编排层) | ✅已拆分 |
| + usePublish.js | - | ~280行 | ✅新增 |
| + PublishConfigPanel.jsx | - | ~260行 | ✅新增 |
| + PublishQueuePanel.jsx | - | ~110行 | ✅新增 |
| + InteractionPanel.jsx | - | ~175行 | ✅新增 |
