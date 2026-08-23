# G-07: KnowledgePage.jsx 拆分改造清单

> 文件: `client/src/pages/KnowledgePage.jsx` | 行数: ~1176→257 | 优先级: P1

## 改造步骤

### KN-01: 提取常量 ✅
- [x] 创建 `client/src/pages/knowledge/knowledgeConstants.js` (~17行)
- [x] 移入: KNOWLEDGE_TABS, SEVERITY_COLORS, DIMENSION_LABELS

### KN-02: 提取总览面板 ✅
- [x] 创建 `client/src/pages/knowledge/OverviewPanel.jsx` (~55行)
- [x] 移入: 统计网格+素材分布+刷新按钮

### KN-03: 提取记忆面板 ✅
- [x] 创建 `client/src/pages/knowledge/MemoryPanel.jsx` (~85行)
- [x] 移入: 5层金字塔+上下文组装器

### KN-04: 提取图表面板 ✅
- [x] 创建 `client/src/pages/knowledge/GraphPanel.jsx` (~260行)
- [x] 移入: 力导向SVG图+节点/边交互+图例

### KN-05: 提取战力追踪面板 ✅
- [x] 创建 `client/src/pages/knowledge/PowerTracker.jsx` (~170行)
- [x] 移入: 战力体系+对比图+成长曲线

### KN-06: 提取伏笔管理面板 ✅
- [x] 创建 `client/src/pages/knowledge/ForeshadowPanel.jsx` (~110行)
- [x] 移入: 活跃/已回收伏笔追踪+生命周期

### KN-07: 额外提取 ✅
- [x] 创建 `client/src/pages/knowledge/ConsistencyPanel.jsx` (~105行)
- [x] 创建 `client/src/pages/knowledge/SnapshotPanel.jsx` (~90行)

### KN-08: 重写主页面 ✅
- [x] KnowledgePage.jsx 从1176行缩减为257行
- [x] Tab切换框架+状态管理+数据加载

### KN-09: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（237测试全通过）
- [x] `vite build` 通过（386模块）

## 最终结构
```
client/src/pages/
├── KnowledgePage.jsx          (257行, Tab切换框架)
└── knowledge/
    ├── knowledgeConstants.js  (~17行, 常量)
    ├── OverviewPanel.jsx      (~55行, 总览)
    ├── MemoryPanel.jsx        (~85行, 记忆)
    ├── GraphPanel.jsx         (~260行, 图谱)
    ├── PowerTracker.jsx       (~170行, 战力)
    ├── ForeshadowPanel.jsx    (~110行, 伏笔)
    ├── ConsistencyPanel.jsx   (~105行, 一致性)
    └── SnapshotPanel.jsx      (~90行, 快照)
```

## G-07改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| KnowledgePage.jsx | 1176行(单文件) | 257行(Tab框架) | ✅已拆分 |
| + knowledgeConstants.js | - | ~17行 | ✅新增 |
| + OverviewPanel.jsx | - | ~55行 | ✅新增 |
| + MemoryPanel.jsx | - | ~85行 | ✅新增 |
| + GraphPanel.jsx | - | ~260行 | ✅新增 |
| + PowerTracker.jsx | - | ~170行 | ✅新增 |
| + ForeshadowPanel.jsx | - | ~110行 | ✅新增 |
| + ConsistencyPanel.jsx | - | ~105行 | ✅新增 |
| + SnapshotPanel.jsx | - | ~90行 | ✅新增 |
