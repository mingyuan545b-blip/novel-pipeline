# G-09: Legacy文件清理改造清单

> 涉及6个Legacy文件 | 优先级: P1(低风险高收益)

## 待清理文件

### L-01: _pipelineLegacy.js (~932行 → 248行)
- [x] 确认是否仍被引用: 搜索 `require.*_pipelineLegacy` 或 `from.*_pipelineLegacy` → 被3处引用
- [x] 如果被引用: 确认调用方是否可以切换到 `fullPipeline.js` → 已切换
  - `routes/pipeline.js` 改为引用 `pipeline` 代理层（不再直接引用Legacy）
  - `pipelineRegistry.js` 改为引用 `pipeline` 代理层（不再直接引用Legacy）
  - `services/pipeline.js` 代理层保持不变
- [x] 拆分内联step handler为独立文件:
  - 提取 `server/services/pipeline/steps/finalEditor.js` (定稿人)
  - 提取 `server/services/pipeline/steps/reviser.js` (返修员)
  - 提取 `server/services/pipeline/steps/polisher.js` (润色员)
  - 提取 `server/services/pipeline/steps/reader.js` (阅读者)
  - 提取 `server/services/pipeline/steps/adjuster.js` (调整员，注：后续已移除)
- [x] 重写 _pipelineLegacy.js 为薄代理层 (932→248行)
- [x] 验证: `npm run check` + `npm test` 通过 (19项check全通过, 237个test全通过)

### L-02: _chapterAuditorLegacy.js (~1105行)
- [x] 确认是否仍被引用: 被 `chapterAuditor.js` 代理层引用，被 `routes/chapterAudit.js` 使用
- [x] 如果被引用: 确认调用方是否可以切换到新的审核系统 → 无替代审核系统
- [ ] 拆分计划: 需要后续单独拆分（不属于G-09范围）
- [x] 验证: 当前状态不影响系统运行

### L-03: _agentPromptsLegacy.js (~813行)
- [x] 确认是否仍被引用: 被 `agentPrompts.js` 代理层和 `routes/agents.js` 引用
- [x] `routes/agents.js` 已改为引用 `agentPrompts.js` 代理层（不再直接引用Legacy）
- [ ] 如果被引用且无法删除: 按Agent类型拆分 → 属于G-13范围
  - [ ] 提取 `server/services/prompts/writerPrompts.js`
  - [ ] 提取 `server/services/prompts/reviewerPrompts.js`
  - [ ] 提取 `server/services/prompts/editorPrompts.js`
  - [ ] 提取 `server/services/prompts/promptBuilder.js` (公共构建逻辑)
  - [ ] 重写 _agentPromptsLegacy.js 为薄代理层
- [x] 验证: 当前状态不影响系统运行

### L-04: _multiPlatformPublisherLegacy.js (~2334行)
- [x] 此文件仍被 `multiPlatformPublisher.js` 代理层引用，不能直接删除
- [ ] 按G-01清单执行拆分后，原文件变为薄代理层
- [ ] 拆分完成后可考虑删除或保留为兼容层

### L-05: _consistencyLegacy.js (~755行)
- [x] 确认是否仍被引用 → 是，被 `consistency.js` 代理层引用，且被多个pipeline模块使用
- [x] 功能复杂（ConsistencyEngine类，含AI辅助检查），不能删除
- [ ] 拆分计划: 需要后续单独拆分（不属于G-09范围）

### L-06: _projectsLegacy.js (~775行)
- [x] 确认是否仍被引用 → 是，被 `routes/projects.js` 直接引用
- [x] 功能复杂（775行路由，含风格分析/清理/模型配置等），不能删除
- [ ] 拆分计划: 需要后续单独拆分（不属于G-09范围）

## 执行顺序
1. ~~先执行 L-01~L-06 的引用检查(只读操作)~~ ✅
2. ~~删除确认无引用的文件~~ → 无可直接删除的文件（全部仍被引用）
3. ~~对仍有引用的文件制定拆分计划~~ ✅
4. ~~每删一个文件后立即验证构建~~ → L-01拆分后已验证通过

## 风险评估
- 删除未引用的Legacy文件: **零风险** → 无此场景
- 拆分仍有引用的Legacy文件: **中等风险** → L-01已成功拆分并验证

## G-09改造成果总结

### 已完成
| 文件 | 改造前 | 改造后 | 状态 |
|------|--------|--------|------|
| _pipelineLegacy.js | 932行(含820行runPipelineStep) | 248行(薄代理层) | ✅已拆分 |
| + finalEditor.js | - | 新增(定稿人handler) | ✅新增 |
| + reviser.js | - | 新增(返修员handler) | ✅新增 |
| + polisher.js | - | 新增(润色员handler) | ✅新增 |
| + reader.js | - | 新增(阅读者handler) | ✅新增 |
| + adjuster.js | - | 新增(调整员handler，后续已移除) | ✅新增 |
| routes/pipeline.js | 直接引用_pipelineLegacy | 改为引用pipeline代理层 | ✅已修复 |
| pipelineRegistry.js | fallback到_pipelineLegacy | 改为fallback到pipeline代理层 | ✅已修复 |
| routes/agents.js | 直接引用_agentPromptsLegacy | 改为引用agentPrompts代理层 | ✅已修复 |

### 保留（属于其他改造项目范围）
| 文件 | 原因 | 对应改造项目 |
|------|------|-------------|
| _chapterAuditorLegacy.js | 无替代审核系统，功能完整 | 需单独规划 |
| _agentPromptsLegacy.js | 需按Agent类型拆分 | G-13 |
| _multiPlatformPublisherLegacy.js | 需按平台拆分 | G-01 |
| _consistencyLegacy.js | ConsistencyEngine功能复杂 | 需单独规划 |
| _projectsLegacy.js | 路由功能复杂 | 需单独规划 |
