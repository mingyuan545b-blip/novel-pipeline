# G-06: Dashboard.jsx 拆分改造清单

> 文件: `client/src/pages/Dashboard.jsx` | 行数: ~1242→735 | 优先级: P1

## 改造步骤

### DB-01: 提取项目卡片组件 ✅
- [x] 创建 `client/src/pages/dashboard/ProjectCard.jsx` (~50行)
- [x] 移入: 单个项目卡片的渲染+操作按钮
- [x] Props: project, isActive, onSelect, onDelete, onCleanup, chapters, materials, variant

### DB-02: 提取素材生成面板 ✅
- [x] 创建 `client/src/pages/dashboard/MaterialGenerator.jsx` (~18行)
- [x] 移入: 初始素材生成表单
- [x] Props: currentProject, generating, onGenerate, errorMsg

### DB-03: 提取大纲生成面板 ✅
- [x] 创建 `client/src/pages/dashboard/OutlineGenerator.jsx` (~24行)
- [x] 移入: 大纲生成表单+导航按钮
- [x] Props: currentProject, generating, onGenerate, errorMsg

### DB-04: 提取自定义Hook ✅
- [x] 创建 `client/src/pages/dashboard/useDashboard.js` (~310行)
- [x] 移入: 50+状态声明, 2个useEffect, 25+处理函数
- [x] 导出MODE_LABELS常量

### DB-05: 重写主页面 ✅
- [x] Dashboard.jsx 从1242行缩减为735行
- [x] 从子组件导入并组合
- [x] 模态框保留在主页面（franchise/cleanup/product/style/flavor编辑器耦合度高）

### DB-06: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（237测试全通过）
- [x] `vite build` 通过（378模块）

## 最终结构
```
client/src/pages/
├── Dashboard.jsx              (735行, 编排层+模态框)
└── dashboard/
    ├── useDashboard.js        (~310行, 状态管理Hook)
    ├── ProjectCard.jsx        (~50行, 项目卡片)
    ├── MaterialGenerator.jsx  (~18行, 素材生成)
    └── OutlineGenerator.jsx   (~24行, 大纲生成)
```

## G-06改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| Dashboard.jsx | 1242行(单文件) | 735行(编排层+模态框) | ✅已拆分 |
| + useDashboard.js | - | ~310行 | ✅新增 |
| + ProjectCard.jsx | - | ~50行 | ✅新增 |
| + MaterialGenerator.jsx | - | ~18行 | ✅新增 |
| + OutlineGenerator.jsx | - | ~24行 | ✅新增 |
