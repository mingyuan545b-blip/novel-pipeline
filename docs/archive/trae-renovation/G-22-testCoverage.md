# G-22: 测试覆盖补充改造清单

> 涉及: `tests/` 目录 | 优先级: P2

## 改造步骤

### TC-01: outlineGenerator 单元测试 ✅
- [x] 创建 `tests/unit/outlineGenerator.test.js` (18个测试)
- [x] 测试: parseMarkdownOutlines 解析正确性
- [x] 测试: cleanJsonArrayResponse JSON清理
- [x] 测试: validateTemplateInput 模板验证
- [x] 测试: parseTemplateResponse 模板响应解析

### TC-02: reviewOverride 单元测试 ✅
- [x] 创建 `tests/unit/reviewOverride.test.js` (33个测试)
- [x] 测试: 4种覆盖场景(字数幻觉/方言误判/风格误判/幽默误判)
- [x] 测试: 红线违规不覆盖场景
- [x] 测试: 边界条件(空输入/混合场景)

### TC-03: infinitePipeline 单元测试 ✅
- [x] 创建 `tests/unit/infinitePipeline.test.js` (31个测试)
- [x] 测试: 状态管理(start/stop/reset)
- [x] 测试: 陈旧状态清理
- [x] 测试: MAX_STATE_ENTRIES限制
- [x] 测试: persistState持久化

### TC-04: agentPrompts 单元测试 ✅
- [x] 创建 `tests/unit/agentPrompts.test.js` (31个测试)
- [x] 测试: getAgentPrompt 输出结构
- [x] 测试: 不同agent类型返回不同prompt
- [x] 测试: novel/shuangwen/tomato-short模式（注：shuangwen/tomato-short已移除，仅保留novel）
- [x] 测试: 约束预设和去重

### TC-05: materialManager 单元测试 ✅
- [x] 创建 `tests/unit/materialManager.test.js` (33个测试)
- [x] 测试: 方言/风格标签解析(parseFlavorTag/applyFlavorTags)
- [x] 测试: 素材去重(determineAction/findExistingMaterial)
- [x] 测试: INTENSITY_MAP常量

### TC-06: Bug修复 ✅
- [x] 修复 stateManager.js logger路径错误
- [x] 修复 materialFlavorParser.js archetype正则非贪婪匹配bug

### TC-07: 清理验证 ✅
- [x] `npm run check` 通过（19项全通过）
- [x] `npm test` 通过（391测试全通过，含154新增）

## G-22改造成果总结

| 文件 | 测试数 | 状态 |
|------|--------|------|
| outlineGenerator.test.js | 18 | ✅新增 |
| reviewOverride.test.js | 33 | ✅新增 |
| infinitePipeline.test.js | 31 | ✅新增 |
| agentPrompts.test.js | 31 | ✅新增 |
| materialManager.test.js | 33 | ✅新增 |
| **总计新增** | **154** | ✅ |
| **总测试数** | **391** | ✅ |
