# G-13: _agentPromptsLegacy.js 拆分改造清单

> 文件: `server/services/_agentPromptsLegacy.js` | 行数: ~813→1 | 优先级: P1

## 改造步骤

### AP-01: 提取Prompt构建器 ✅
- [x] 创建 `server/services/prompts/promptBuilder.js` (~280行)
- [x] 移入: getAgentPrompt, getAgentTemplate, getFoundationPrompt, buildFoundationPrompt, deduplicateSystemPrompt

### AP-02: 提取约束注入器 ✅
- [x] 创建 `server/services/prompts/constraintInjector.js` (~120行)
- [x] 移入: BASE_CONSTRAINT_PRESETS, getConstraintPresets, buildConstraintInjection

### AP-03: 提取风格注入器 ✅
- [x] 创建 `server/services/prompts/styleInjector.js` (~210行)
- [x] 移入: getStyleProfileByKey, getAllStyleProfiles, getStyleProfileForProject, buildStyleInjection, buildStyleProfileInjection

### AP-04: 提取方言/风格注入器 ✅
- [x] 创建 `server/services/prompts/flavorInjector.js` (~40行)
- [x] 移入: buildFlavorInjection (方言+说话风格组合注入)

### AP-05: 提取题材注入器 ✅
- [x] 创建 `server/services/prompts/genreInjector.js` (~85行)
- [x] 移入: buildGenreInjection (题材/命名/梗词典/世界观模板/人设/系统人格)

### AP-06: 重写主入口 ✅
- [x] 创建 `server/services/prompts/index.js` (~35行)
- [x] _agentPromptsLegacy.js 缩减为1行代理: `module.exports = require('./prompts/index');`
- [x] 保持导出接口不变

### AP-07: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（237测试全通过）

## 最终结构
```
server/services/prompts/
├── promptBuilder.js        (~280行, 主构建器)
├── constraintInjector.js   (~120行, 约束注入)
├── styleInjector.js        (~210行, 风格注入)
├── flavorInjector.js       (~40行, 方言/风格注入)
├── genreInjector.js        (~85行, 题材注入)
└── index.js                (~35行, 统一导出)
```

## G-13改造成果总结

| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| _agentPromptsLegacy.js | 813行(单文件) | 1行(代理) | ✅已拆分 |
| + promptBuilder.js | - | ~280行 | ✅新增 |
| + constraintInjector.js | - | ~120行 | ✅新增 |
| + styleInjector.js | - | ~210行 | ✅新增 |
| + flavorInjector.js | - | ~40行 | ✅新增 |
| + genreInjector.js | - | ~85行 | ✅新增 |
| + index.js | - | ~35行 | ✅新增 |
