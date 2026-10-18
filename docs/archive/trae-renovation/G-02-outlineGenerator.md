# G-02: outlineGenerator.js 拆分改造清单

> 文件: `server/services/pipeline/outlineGenerator.js` | 行数: ~1354→253 | 优先级: P0

## 改造步骤

### OG-01: 提取大纲格式化器 ✅
- [x] 创建 `server/services/pipeline/outlineFormatter.js` (~155行)
- [x] 移入: parseMarkdownOutlines, cleanJsonArrayResponse, buildMaterialSummary, loadOutlineChecklist, buildChapterOutlineSystemPrompt

### OG-02: 拆分 generateFromTemplate ✅
- [x] 创建 `server/services/pipeline/outlineTemplateExpander.js` (~340行)
- [x] 移入: buildStyleInjection, buildConstraintInjection, buildTemplatePrompt, createTemplateEntities, associateTemplateEntities
- [x] 创建 `server/services/pipeline/outlineTemplateValidator.js` (~80行)
- [x] 移入: validateTemplateInput, repairAndParseJson, parseTemplateResponse
- [x] generateFromTemplate 保留为薄编排层

### OG-03: 提取大纲补充器 ✅
- [x] 创建 `server/services/pipeline/outlineSupplementer.js` (~310行)
- [x] 移入: supplementChapterOutlines 全部逻辑
- [x] Bug修复: 添加缺失的getVolumeOrder导入

### OG-04: 提取初始素材生成器 ✅
- [x] 创建 `server/services/pipeline/initialMaterialGenerator.js` (~95行)
- [x] 移入: generateInitialMaterials 全部逻辑

### OG-05: 重写主入口 ✅
- [x] outlineGenerator.js 从1354行缩减为253行
- [x] 从各子模块导入函数并重新导出
- [x] 保持导出接口不变

### OG-06: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（237测试全通过）

## 最终结构
```
server/services/pipeline/
├── outlineGenerator.js           (253行, 编排层+导出)
├── outlineFormatter.js           (~155行, 解析+格式化)
├── outlineTemplateExpander.js    (~340行, 模板扩展)
├── outlineTemplateValidator.js   (~80行, 模板校验)
├── outlineSupplementer.js        (~310行, 大纲补充)
└── initialMaterialGenerator.js   (~95行, 初始素材)
```

## G-02改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| outlineGenerator.js | 1354行(单文件) | 253行(编排层) | ✅已拆分 |
| + outlineFormatter.js | - | ~155行 | ✅新增 |
| + outlineTemplateExpander.js | - | ~340行 | ✅新增 |
| + outlineTemplateValidator.js | - | ~80行 | ✅新增 |
| + outlineSupplementer.js | - | ~310行 | ✅新增 |
| + initialMaterialGenerator.js | - | ~95行 | ✅新增 |
