# G-05: MaterialsPage.jsx 拆分改造清单

> 文件: `client/src/pages/MaterialsPage.jsx` | 行数: ~1498→462 | 优先级: P0

## 改造步骤

### MA-01: 提取常量和工具函数 ✅
- [x] 创建 `client/src/pages/materials/materialConstants.js`
- [x] 移入: MATERIAL_TYPE_LABELS, MATERIAL_TYPE_COLORS, DOMAIN_CATEGORIES, toBeijingTime, buildDomainTree, 以及所有QUEST/TIMELINE/ARCHIVE常量
- [x] 验证: 常量导入正确

### MA-02: 提取素材树视图组件 ✅
- [x] 创建 `client/src/pages/materials/MaterialTreePanel.jsx`
- [x] 移入: 素材树渲染逻辑（主世界/次位面/创作规范三分区）
- [x] Props: filteredMaterials, selectedMaterialId, selectMaterial, collapsedTypes, expandedPlanes等
- [x] 验证: 树视图正常显示和交互

### MA-03: 提取素材编辑器组件 ✅
- [x] 创建 `client/src/pages/materials/MaterialEditor.jsx`
- [x] 移入: 素材编辑表单+方言/风格选择器+预览+命名规范+人设模板
- [x] Props: mat, editForm, availableDialects, availableStyles等
- [x] 验证: 编辑功能正常

### MA-04: 提取任务管理组件 ✅
- [x] 创建 `client/src/pages/materials/QuestPanel.jsx`
- [x] 移入: 任务列表+创建+编辑+删除+子任务
- [x] Props: quests, questStatusFilter, currentProject等
- [x] 验证: 任务管理功能正常

### MA-05: 提取时间线管理组件 ✅
- [x] 创建 `client/src/pages/materials/TimelinePanel.jsx`
- [x] 移入: 时间线列表+创建+编辑+删除
- [x] Props: timelineEvents, timelineTypeFilter, currentProject等
- [x] 验证: 时间线功能正常

### MA-06: 提取创建素材表单 ✅
- [x] 创建 `client/src/pages/materials/CreateMaterialForm.jsx`
- [x] 移入: CreateMaterialForm 组件
- [x] Props: onSubmit, onCancel
- [x] 验证: 创建素材功能正常

### MA-07: 提取自定义Hook ✅
- [x] 创建 `client/src/pages/materials/useMaterials.js`
- [x] 移入: useState/useEffect/useCallback 逻辑（30+状态，所有CRUD操作）
- [x] 返回: 所有状态和操作
- [x] 验证: 所有状态和操作正常

### MA-08: 重写主页面 ✅
- [x] 修改 MaterialsPage.jsx 为薄编排层（1584→462行）
- [x] 从子组件导入并组合
- [x] 验证: 全部功能正常

### MA-09: 清理验证 ✅
- [x] 运行 `vite build` 通过（374模块，3.25秒）
- [x] 运行 `npm run check` 通过（19项全通过）
- [x] 运行 `npm test` 通过（237测试全通过）

## 最终结构
```
client/src/pages/
├── MaterialsPage.jsx              (462行, 薄编排层+模态框)
└── materials/
    ├── materialConstants.js       (~100行, 常量+工具)
    ├── useMaterials.js            (~200行, 状态管理Hook)
    ├── MaterialTreePanel.jsx      (~350行, 素材树)
    ├── MaterialEditor.jsx         (~300行, 编辑器)
    ├── QuestPanel.jsx             (~200行, 任务管理)
    ├── TimelinePanel.jsx          (~120行, 时间线)
    └── CreateMaterialForm.jsx     (~50行, 创建表单)
```

## G-05改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| MaterialsPage.jsx | 1584行(单文件) | 462行(薄编排层) | ✅已拆分 |
| + materialConstants.js | - | ~100行 | ✅新增 |
| + useMaterials.js | - | ~200行 | ✅新增 |
| + MaterialTreePanel.jsx | - | ~350行 | ✅新增 |
| + MaterialEditor.jsx | - | ~300行 | ✅新增 |
| + QuestPanel.jsx | - | ~200行 | ✅新增 |
| + TimelinePanel.jsx | - | ~120行 | ✅新增 |
| + CreateMaterialForm.jsx | - | ~50行 | ✅新增 |
