# 规范文档 Part 1: 项目创建规范（统一长篇模式）

> 本文档定义新项目创建的必要内容、格式要求。系统已统一为长篇模式（novel），原番茄短篇(tomato-short)和爽文(shuangwen)模式已移除。
> 所有配置值必须从 `config/index.js` 统一入口读取，禁止硬编码。

---

## 1. 项目创建必要字段

### 1.1 项目核心字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 项目名称 |
| genre | string | 是 | 题材名称（如"甜宠匠心"） |
| mode | string | 是 | 创作模式：`novel`（统一长篇模式，原 tomato-short/shuangwen 已移除） |
| targetChapters | number | 是 | 目标章数 |
| styleProfile | object | 是 | 风格档案（含genre字段，供detectGenre解析） |
| wordConfig | object | 否 | 字数覆盖配置（优先级最高） |
| genreProfile | string | 否 | 题材档案ID（如"甜宠匠心"） |
| subgenre | string | 否 | 子题材（如"tomato-sweet-artisan"） |
| season | number | 否 | 季号（多季项目用） |
| parentProjectId | string | 否 | 父项目ID（多季项目用） |

### 1.2 styleProfile 格式

```json
{
  "genre": "甜宠匠心",
  "materialFocus": {
    "primary": ["character", "relationship", "foreshadowing"],
    "skip": ["technology", "geography"]
  }
}
```

- `genre` 字段是 detectGenre 的输入，必须与题材注册表中的 id 或 label 匹配
- `materialFocus.primary` 定义该题材优先生成的素材类型
- `materialFocus.skip` 定义该题材跳过的素材类型

### 1.3 wordConfig 格式（可选，覆盖默认值）

```json
{
  "targetMin": 2200,
  "targetMax": 2800,
  "rejectMin": 1850,
  "maxWords": 3500
}
```

> wordConfig 优先级最高，覆盖 genre.pipelineConfig 和 genreDefaults。

---

## 2. 创作模式（统一长篇模式）

> 说明：系统已统一为长篇模式（novel），原番茄短篇(tomato-short)和爽文(shuangwen)模式已移除。

### 2.1 模式定义

| 模式 | ID | 适用场景 | 典型章数 | 典型总字数 |
|------|-----|---------|---------|-----------|
| 长篇小说 | `novel` | 百章以上长篇 | 100+ | 20万-500万字 |

### 2.2 配置项（统一长篇模式 novel）

> 说明：原 tomato-short/shuangwen 模式已移除，所有项目使用 novel 长篇模式。字数阈值由 `server/config/wordConfigSchema.js` + `project.wordConfig` 动态管理。

| 配置项 | novel |
|--------|-------|
| **字数配置** | |
| targetMinWords | 2200 |
| targetMaxWords | 2800 |
| rejectMinWords | 1800 |
| maxChapterWords | 3500 |
| **流程配置** | |
| totalChapters | 100 |
| maxRounds | 7 |
| chaptersPerBatch | 5 |
| skipSecondReview | false |
| requireCliffhanger | false |
| requireTrendingMemes | false |
| **校验配置** | |
| openingHookRange | 100字 |
| dialogueRatioMax | 0.28 |
| sweetPointRequired | false |
| reversalRequired | false |
| **Hook预算** | |
| rangeScale | 1.0 |
| **读者触发** | |
| readerTriggers | [5,10,15,20] |

> 说明：原 `adjusterMaxWriterRules`/`adjusterMaxReviewRules`/`adjusterMaxMaterialUpdates` 配置项随 adjuster 移除而废弃。

### 2.3 审核流程

```
novel: writer → first-review → second-review → final-editor → approved
       （可通过 reviewOverride 路由 fast-review 替代 first-review + second-review）
```

- `skipSecondReview=true` 时，使用 fast-review 替代 first-review + second-review
- fast-review 在 round>=2 且无 critical 问题时自动通过

### 2.4 Hook预算

| 配置项 | novel |
|--------|-------|
| 伏笔过期阈值(章) | 30 |
| 伏笔紧急阈值(章) | 5 |
| 最大活跃伏笔数 | 12 |

> rangeScale 影响伏笔的预期回收窗口计算：
> `expectedPayoff = defaultRange * rangeScale`
> 说明：原 tomato-short rangeScale=0.35、爽文 rangeScale=0.4 的差异配置随模式移除而废弃。

---

## 3. 配置优先级体系

### 3.1 三层配置架构

```
┌─────────────────────────────────────┐
│  project.wordConfig (最高优先级)      │  ← 用户手动覆盖
├─────────────────────────────────────┤
│  genre.pipelineConfig               │  ← 题材插件定义
├─────────────────────────────────────┤
│  genreDefaults (最低优先级)          │  ← 系统默认值
└─────────────────────────────────────┘
```

### 3.2 resolveConfig 输出结构

```javascript
const config = resolveConfig(genre, project);
// config.word:     { targetMin, targetMax, rejectMin, maxChapter }
// config.chapter:  { total, maxRounds, chaptersPerBatch }
// config.flow:     { skipSecondReview, requireCliffhanger, requireTrendingMemes }
// config.validation: { openingHookRange, dialogueRatioMax, ... }
// config.milestones: { [chapterNumber]: milestoneDescription }
// config.hook:     { rangeScale }
// config.reader:   { triggers: [chapterNumbers] }
// config.adjuster: 已移除（原 maxWriterRules/maxReviewRules/maxMaterialUpdates 随 adjuster 废弃）
// config.seasons:  { [seasonNumber]: { name, talismans, shadows } }
// config.genre:    { id, label }
```

### 3.3 milestones 三级 fallback

```
genre.pipelineConfig.milestones
  → genre.entitySchema.milestones
    → genreDefaults.milestones (通常为 {})
```

---

## 4. 题材注册与发现

### 4.1 detectGenre 输入格式

```javascript
// 正确
detectGenre({ genre: '甜宠匠心' })
detectGenre(styleProfile)  // styleProfile包含genre字段

// 错误
detectGenre('甜宠匠心')  // 纯字符串，返回null
```

### 4.2 题材ID前缀规则

- `tomato-` 前缀 → 自动使用 TOMATO_DEFAULTS
- 其他 → 根据 project.mode 推断

### 4.3 双主角题材

以下题材ID允许双主角（最多2个protagonist）：
- `tomato-sweet`
- `tomato-sweet-artisan`

其他题材只允许1个protagonist，超出自动降级为supporting。

---

## 5. 新项目创建检查清单

- [ ] mode 已设置为 `novel`（统一长篇模式，原 tomato-short/shuangwen 已移除）
- [ ] styleProfile.genre 与题材注册表匹配
- [ ] targetChapters 在长篇模式合理范围内（novel: 50+）
- [ ] wordConfig 已配置（如需覆盖默认值）
- [ ] subgenre 已设置（番茄项目必须，如 `tomato-sweet-artisan`）
- [ ] genreProfile 已设置（如 `甜宠匠心`）
- [ ] constraintOverrides 已填充（题材特定约束）
- [ ] pipelineConfig 包含题材 MILESTONES 定义
