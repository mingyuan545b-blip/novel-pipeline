# 规范文档 Part 2: Agent 模块规范

> 本文档定义每个Agent的职责、权限范围、输入格式、输出格式。
> Pipeline流程：outlineGenerator → writer → review → reviser → finalEditor → approved

---

## 1. Pipeline 编排器 (Orchestrator)

### 职责
- 管理Pipeline步骤执行顺序
- 根据配置决定审核流程（skipSecondReview → fastReview路径）
- 处理审核失败后的返修循环
- 管理熔断器、重试、错误恢复

### 流程决策

```
skipSecondReview=false → writer → first-review → second-review → final-editor
skipSecondReview=true  → writer → fast-review → final-editor
```

### 关键参数
- `maxRounds`: 最大返修轮次（novel=7；原 tomato=5/shuangwen=3 已随模式移除废弃）
- `CIRCUIT_BREAKER_THRESHOLD`: 连续3次失败触发熔断

---

## 2. 大纲生成器 (outlineGenerator)

### 职责
- 生成初始素材（角色、世界观、战力体系等）
- 生成章节大纲
- 从模板生成完整项目
- 补充已有项目的大纲

### 4个核心函数

| 函数 | 触发场景 | 输入 | 输出 |
|------|---------|------|------|
| generateInitialMaterials | 新项目首次生成 | projectId, genre, materialFocus | 素材列表 + 实体同步 |
| generateChapterOutlines | 生成章节大纲 | projectId, chapterRange, genreConfig | 大纲列表 + 节奏校验 |
| generateFromTemplate | 从模板创建项目 | projectId, templateId | 完整项目（素材+任务+时间轴+大纲） |
| supplementChapterOutlines | 补充已有大纲 | projectId, chapterRange | 补充大纲 + 卷过渡 + 伏笔提醒 |

### 输入格式
```javascript
{
  projectId: string,
  genre: object,           // detectGenre返回的题材对象
  materialFocus: object,   // { primary: [...], skip: [...] }
  targetChapters: number,
  chapterRange: { start: number, end: number }
}
```

### 输出格式
```javascript
{
  materials: [{ type, name, content, parentPlane, parentFaction }],
  outlines: [{ chapterNumber, title, outline, scene, volumeId }],
  entities: [{ entityType, name, roleLevel, genreState }],
  timeline: [{ chapterNumber, description, eventType, actorIds }],
  foreshadows: [{ name, description, plantChapter, expectedResolveWindow }]
}
```

### 权限
- 可创建素材（必须先查store去重）
- 可创建实体（必须通过entityCenter.getOrCreateEntity）
- 可创建伏笔（通过foreshadowLedger.plant）
- 可创建时间轴事件（通过timelineService.addEvent）
- 禁止直接store.setItem创建角色素材

---

## 3. 写作Agent (Writer)

### 职责
- 根据大纲+素材+实体状态生成章节正文
- 遵守字数要求、角色名字锁定、核心设定约束
- 注入伏笔预算、时间线、角色活跃度提醒

### 输入格式
```javascript
{
  projectId: string,
  chapter: {
    chapterNumber: number,
    title: string,
    outline: string,       // 最多2000字
    scene: string,         // 场景（主世界/次位面）
    content: string|null,  // 已有正文（返修时）
    wordCount: number
  },
  materials: Material[],   // 按agentMaterialAccess过滤
  agentContext: {
    content: string,       // 完整prompt（系统自动构建）
    chapterOutline: string,
    chapterIntent: string, // 章节意图
    hookAgenda: string     // 伏笔预算agenda
  },
  round: number,
  mode: string,
  config: resolveConfig输出
}
```

### 输出格式
```javascript
{
  step: 'writer',
  passed: boolean,
  result: { response: string },  // 章节正文
  chapter: {
    content: string,       // 清洗后的正文
    wordCount: number,
    status: 'written',
    writerOutput: string,
    tomatoValidation: { pass: boolean },
    truncated: boolean
  }
}
```

### 字数处理规则
1. 低于 rejectMin → 直接退回重写
2. 低于 targetMin → 提示扩展
3. 超过 maxChapter → 智能截断（按句子边界）
4. requireCliffhanger=true → 自动确保章末钩子

### 素材注入优先级
1. 核心设定（worldview/power-system）— 必须遵守
2. 角色称呼表 — 名字锁定
3. 角色当前状态 — 从entityCenter获取
4. 当前次位面信息 — 按场景匹配
5. 相关装备/地点 — 按大纲关键词匹配
6. 伏笔/时间线 — 从DataContext获取

### Token预算
- 素材总预算: 8000字符
- 角色详情预算: 4000字符
- 核心设定单条上限: 800字符

---

## 4. 初审Agent (First Review)

### 职责
- 检测正文与实体中心/素材库设定的矛盾
- 检测现代俚语、成人视角、技术术语、元数据泄露
- 检测跨章重复、告知式描写、信息注入节奏
- 检测章末张力
- 执行题材铁律硬性拦截

### 硬性检测拦截 (HARD BLOCK)
以下问题直接拦截，不进入LLM审核：
- 敏感词（block级）
- 字数不达标（< rejectMin）
- 字数超标（> maxChapter）
- 管线元数据泄露
- 题材HARD BLOCK规则

### 输入格式
```javascript
{
  projectId: string,
  chapter: { chapterNumber, content, wordCount, scene, outline },
  agentContext: { content: string },  // 含实体状态+伏笔状态+题材规则
  round: number
}
```

### 输出格式（JSON）
```json
{
  "passed": true/false,
  "summary": "审核概述",
  "issues": [{
    "title": "问题类型",
    "location": "位置",
    "originalText": "原文",
    "perspective": "视角字段",
    "violationReason": "违规原因",
    "howToFix": "修改方法",
    "targetText": "改写后",
    "severity": "critical/high/medium"
  }],
  "suggestions": [{
    "title": "建议标题",
    "description": "步骤"
  }]
}
```

### 矛盾自动修正
当 `passed=false` 但 summary 包含正面信号（"符合核心规范"等）且无critical问题时，自动修正为 `passed=true`。

---

## 5. 快审Agent (Fast Review)

### 职责
- 通过 reviewOverride 路由作为初审+复审的替代路径（原番茄/爽文模式已移除）
- 优先检查题材铁律
- round>=2 且无critical问题时自动通过

### 与初审的区别
- 不检测风格模板合规性
- 自动通过策略更宽松
- 输出格式与初审相同

### 自动通过条件
- round >= 2
- 无 severity=critical 的 issues

---

## 6. 复审Agent (Second Review)

### 职责
- 基于初审结果进行二次审核
- 检查风格模板合规性
- 执行题材 secondReview 规则

### 仅 novel 模式使用
- skipSecondReview=true 时跳过

### 额外硬性检测
- 题材 HARD BLOCK（secondReviewIntercept）
- 字数超标（> maxChapter）

---

## 7. 返修Agent (Reviser)

### 职责
- 根据审核反馈精准修改正文
- 保持字数不低于原文字数95%
- 遵守题材返修规则

### 输入格式
```javascript
{
  projectId: string,
  chapter: { content, outline, chapterNumber },
  materials: Material[],
  agentContext: {
    content: string,          // 含审核反馈+核心设定+题材规则
    chapterContent: string,   // 当前正文（最多12000字）
    chapterOutline: string,   // 大纲（最多1000字）
    relevantMaterials: string, // 审核反馈中提及的素材
    coreSettings: string      // 核心设定
  },
  context: { reviewFeedback: string },
  round: number
}
```

### 字数保护规则
1. 返修后 < rejectMin 且原文 >= rejectMin → 回退原文
2. 返修后 < targetMin 且原文 >= targetMin → 回退原文
3. 返修后 < 原文50% 且原文 > 500字 → 回退原文
4. 返修后 > maxChapter → 按句子边界截断

### 题材规则注入
- `terminologyDimmingRule`: 术语降维规则
- `perspectiveRule`: 视角规则
- `repairRules`: 修复规则

---

## 8. 定稿Agent (Final Editor)

### 职责
- 综合初审+复审结果做最终判定
- approved后：清洗内容 + 字数截断 + 保存 + 实体状态快照
- 检测章末张力和告知式描写密度
- 生成IP方向时间轴条目

### 输出格式（JSON）
```json
{
  "approved": true/false,
  "action": "approve/reject/revise",
  "edits": [{ priority, description, type }],
  "ipDirection": "IP方向描述",
  "materialGuidance": "素材指导",
  "scheduleNote": "排期备注"
}
```

### 定稿后操作
1. `cleanFinalContent` 清洗正文
2. 字数超限截断
3. `saveFinalContent` 保存到文件
4. 对所有活跃角色保存 `entity_state_history` 快照
5. 更新关联Quest状态
6. 生成IP方向时间轴条目

---

## 9. ~~调整员Agent (Adjuster)~~ — 已移除

> 说明：adjuster 已从 AGENT_TYPES 中移除（78%规则是重复/矛盾），原追加规则+微调素材功能由 reviser 直接处理。以下为历史记录保留。

### 职责（已废弃）
- 根据阅读者评审意见追加写作/审核规则
- 微调写作手法/伏笔/角色行为类素材
- 不参与正文生成或审核

### 权限边界（已废弃）
1. 只能追加规则，不能删除或修改已有规则
2. 不能提出与基底约束相反的规则
3. 不能改变核心视角
4. 不能修改世界观/设定类素材
5. 每类规则最多追加2条
6. 素材修改只能微调（新内容不得少于原内容30%）
7. 阅读者没发现硬伤时不强制追加规则

### 输出格式（已废弃）
```json
{
  "writerRuleAdditions": ["规则1", "规则2"],
  "reviewRuleAdditions": ["规则1", "规则2"],
  "materialConstraintUpdates": [{
    "materialName": "素材名称",
    "field": "修改的字段",
    "update": "修改后的完整内容"
  }],
  "adjustmentSummary": "本次调整说明"
}
```

### 冲突检测（已废弃）
- 新规则与已有规则语义冲突 → 跳过
- 新规则与已有规则重复 → 跳过
- 每类规则上限：writer=15条, review=15条
- 可修改的素材类型：writing-technique, foreshadowing, character
- 前8个素材受保护，不可修改

---

## 10. Agent默认参数

| Agent | maxTokens | defaultTemperature | timeoutMs |
|-------|-----------|-------------------|-----------|
| writer | 32768 | 0.7 | 900000 |
| first-review | 8192 | 0.3 | 300000 |
| second-review | 8192 | 0.3 | 300000 |
| fast-review | 8192 | 0.3 | 300000 |
| final-editor | 32768 | 0.5 | 900000 |
| reviser | 32768 | 0.7 | 900000 |
| intent-planner | 8192 | 0.5 | 300000 |
| reader | 8192 | 0.3 | 300000 |
| material-manager | 8192 | 0.3 | 300000 |
| polisher | 32768 | 0.5 | 900000 |

---

## 11. DataContext — Agent统一数据入口

### 原则
Agent不直接读store，全部通过DataContext获取数据。DataContext内部管理缓存。

### 核心API

| 方法 | 返回 | 用途 |
|------|------|------|
| getProject() | project对象 | 项目配置 |
| getGenre() | genre对象 | 题材信息 |
| getGenreId() | string | 题材ID |
| getStyleTemplate() | template对象 | 风格模板 |
| getChapters() | chapter[] | 章节列表 |
| getActiveMaterials(type?) | material[] | 活跃素材 |
| getEntitiesForWriter(ch, budget) | entity[] | 写作用实体 |
| getEntitiesForReviewer(ch) | entity[] | 审核用实体 |
| getTimelineSummary(ch, lookback) | string | 时间线摘要 |
| getForeshadowHint(ch) | string | 伏笔注入文本 |
| getPowerCheckHint(ch) | string | 战力检测提示 |
| getCharacterArcCheckHint(ch) | string | 角色弧线提示 |
| getCharacterActivityHint(ch) | string | 角色活跃度提示 |
| getAgentMaterialAccess(agent) | access对象 | Agent素材访问权限 |
| getMaterialFocus() | focus对象 | 题材素材焦点 |
