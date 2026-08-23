# 规范文档 Part 3: 素材库 + 知识库 + 实体中心规范

> 本文档定义素材库、知识库、实体中心的格式、字段、使用方式和交互关系。

---

## 1. 素材库 (Materials)

### 1.1 素材类型定义（31种）

#### 世界域 (world)
| 类型ID | 标签 | 图标 | 层级规则 |
|--------|------|------|---------|
| worldview | 世界观 | 🌍 | 无父级要求 |
| power-system | 战力体系 | ⚡ | 无父级要求 |
| faction | 势力 | 🏛 | parentPlane必填 |
| institution | 机构 | 🏯 | parentPlane必填 |
| location | 地点 | 📍 | parentPlane可选 |
| equipment | 装备 | ⚔ | parentPlane可选 |
| character | 人物卡 | 👤 | parentFaction必填 |
| scene | 场景 | 🏞️ | 无 |
| phenomenon | 现象 | ✨ | 无 |
| organization | 组织 | 🏢 | 无 |
| geography | 地理 | 🗺️ | 无 |
| technology | 科技 | 🔬 | 无 |

#### 次位面域 (subplane)
| 类型ID | 标签 | 图标 |
|--------|------|------|
| sub-plane | 次位面 | 🌀 |

#### 创作域 (craft)
| 类型ID | 标签 | 图标 |
|--------|------|------|
| craft | 创作规范 | 📝 |
| writing-technique | 写作手法 | ✍️ |
| narrative-bridge | 叙事衔接 | 🌉 |
| catchphrase | 金句/热梗 | 💬 |
| famous-scene | 名场面 | 🎬 |
| foreshadowing | 伏笔 | 🔮 |
| growth-history | 成长史 | 📈 |
| relationship | 人物关系 | 🔗 |
| mechanism | 机制 | ⚙️ |
| index | 索引 | 📑 |
| other | 其他 | 📋 |

#### 角色子类型
| 类型ID | 标签 | 图标 |
|--------|------|------|
| character-psychology | 人物心理 | 🧠 |
| character-combat | 人物战斗 | 💥 |
| character-personality | 人物性格 | 🎭 |
| character-relationship | 人物关系详情 | 🤝 |
| character-dialogue | 人物对话 | 🗣️ |
| character-behavior | 人物行为 | 🏃 |
| material | 材料 | 🧪 |

### 1.2 素材必检标准 (MATERIAL_STANDARDS)

4种类型有必填字段校验：

| 类型 | 必填字段 | 校验规则 |
|------|---------|---------|
| character | 核心欲望、内在矛盾、行为模式 | 正则匹配关键词 |
| worldview | 边界条件、违反后果 | 正则匹配关键词 |
| power-system | 升级条件、代价/限制 | 正则匹配关键词 |
| foreshadowing | 预期回收窗口、关联角色 | 正则匹配关键词 |

### 1.3 素材通用字段

```javascript
{
  id: string,               // 唯一ID
  projectId: string,        // 项目ID
  type: string,             // 素材类型（VALID_MATERIAL_TYPES之一）
  name: string,             // 素材名称
  initialContent: string,   // 初始内容
  currentContent: string,   // 当前内容（原 adjuster 已移除，由 reviser 修改）
  archived: string,         // 归档状态（空=活跃）
  isLocked: boolean,        // 是否锁定（锁定不可修改）
  isCoreSetting: boolean,   // 是否核心设定
  parentPlane: string,      // 所属位面ID
  parentFaction: string,    // 所属势力ID
  refNames: object,         // 角色称呼表 { narrator, byChild, byAdult, pronoun }
  tags: string[],           // 标签
  changeLog: [{ from, to, reason, chapterNumber, timestamp }],
  createdAt: string,
  updatedAt: string
}
```

### 1.4 层级关系规则

```
sub-plane (次位面)
  └── faction (势力) — parentPlane必填
       └── character (人物) — parentFaction必填
  └── institution (机构) — parentPlane必填
  └── equipment (装备) — parentPlane可选
  └── location (地点) — parentPlane可选
```

### 1.5 素材类型自动推断

当素材类型未指定时，根据内容关键词自动推断：

| 关键词(>=2个命中) | 推断类型 |
|------------------|---------|
| 结构/功能/触发/装置/机制 | mechanism |
| 身份/性格/动机/角色/行为模式 | character |
| 边界/法则/世界观/设定/规则 | worldview |
| 升级/突破/战力/代价/限制 | power-system |
| 预期回收/伏笔/悬念/钩子 | foreshadowing |
| 关系/羁绊/互动/信任/对立 | relationship |

---

## 2. 知识库 (Knowledge Base)

### 2.1 记忆金字塔 (MemoryPyramid)

四级记忆衰减体系：

| 层级 | 名称 | 衰减率 | 最大年龄 | 最低重要性 | 用途 |
|------|------|--------|---------|-----------|------|
| L0 | 核心设定 | 0（永不衰减） | ∞ | 0 | 世界观铁律、角色核心设定 |
| L1 | 近期关键 | 0.05 | 5章 | 60 | 当前活跃剧情线、近期角色变化 |
| L2 | 中期参考 | 0.02 | 15章 | 30 | 已完成但可能回调的剧情 |
| L3 | 远期存档 | 0.01 | 50章 | 10 | 历史事件、已回收伏笔 |

#### 事实条目格式

```javascript
{
  id: string,
  projectId: string,
  level: 'L0'|'L1'|'L2'|'L3',
  category: string,         // plot/character/worldview/...
  entityId: string|null,    // 关联实体ID
  chapterNumber: number,    // 记录章节
  factText: string,         // 事实文本
  importance: number,       // 0-100
  accessCount: number,      // 访问次数
  lastAccessedChapter: number,
  decayScore: number,       // 0.0-1.0
  expiresAtChapter: number|null
}
```

#### 衰减计算

```
decayScore = max(0, 1.0 - age * decayRate)
```

- age = currentChapter - fact.chapterNumber
- L0永远为1.0

#### 自动降级规则

当 age > maxAge 且 importance < minImportance 时：
- L1 → L2
- L2 → L3
- L3 不再降级

#### Token预算注入

`getFactsForPrompt(projectId, chapterNumber, tokenBudget=2000)`:
按层级排序(L0→L3)，同层级按decayScore降序，截断至tokenBudget。

### 2.2 叙事追踪器 (NarrativeTracker)

每章一条叙事状态记录：

```javascript
{
  id: string,               // narr-{projectId}-ch{chapterNumber}
  projectId: string,
  chapterNumber: number,
  phase: string,            // setup/rising/climax/falling/resolution
  tension: number,          // 0-100
  pacing: string,           // slow/moderate/fast
  activePlotThreads: string[],
  completedPlotThreads: string[],
  milestone: string,        // 当前里程碑
  emotionalArc: object,     // { [characterId]: emotion }
  readerExpectation: object,
  notes: string
}
```

#### 阶段检测

1. 优先匹配 genreMilestones[chapterNumber]
2. 其次按进度计算：`phaseIndex = floor(progress * phases.length)`

### 2.3 一致性校验器 (ConsistencyChecker)

```javascript
{
  id: string,
  projectId: string,
  chapterNumber: number,
  checkType: string,        // name/foreshadow/power/character_arc
  severity: string,         // warning/critical
  entityId: string|null,
  description: string,
  expectedValue: string,
  actualValue: string,
  isResolved: boolean,
  resolvedChapter: number|null
}
```

#### 名称一致性检测

- 主角在正文中被称呼为非标准名 → warning
- 支持变体匹配（首字、末字）

---

## 3. 实体中心 (EntityCenter)

### 3.1 核心原则

- **entityCenter.getOrCreateEntity 是角色实体唯一创建入口**
- 找到已有实体时必须合并更新而非直接返回
- entityRegistry 只是同步缓存，禁止独立创建
- 创建前必须从store直接查询是否已有同名素材

### 3.2 实体格式

```javascript
{
  id: string,
  projectId: string,
  entityType: string,       // character/pet-entity/servant-entity/location/...
  name: string,
  briefName: string,        // name.substring(0,4)
  roleLevel: string,        // protagonist/supporting/npc
  genreId: string,          // 题材ID
  isActive: boolean,
  isLocked: boolean,
  firstAppearChapter: number,
  lastAppearChapter: number,
  appearCount: number,
  parentEntityId: string|null,
  tags: string[],

  // 通用状态
  hp: number,               // 默认100
  combatPower: number,      // 默认0
  position: string,         // 职位/身份
  factionName: string,      // 阵营
  personality: string,      // 性格
  speakingTone: string,     // 说话语气
  signatureDetail: string,  // 标志性细节

  // 题材特有状态（JSONB）
  genreState: object,       // { cultivationStage, jobTitle, ... }

  // 静态档案
  profile: {
    appearance: string,     // 外貌
    background: string,     // 背景
    motivation: string,     // 核心动机
    gender: string,         // 性别
    refNames: object        // 称呼表
  },

  // 缓存摘要
  bindsSummary: [{ name, type, masteryLevel, brief, status }],
  relationsSummary: [{ targetName, relType, relLabel, strength }],

  // 预计算提示词
  briefText: string,        // 一行摘要
  briefTokens: number,
  summaryText: string,      // 多行摘要
  summaryTokens: number,
  detailText: string,       // 完整详情
  detailTokens: number,

  sourceContent: string,    // 原始素材内容
  version: number,
  sourceChapter: number|null,
  archived: string,
  data: object
}
```

### 3.3 三种提示词粒度

| 粒度 | 用途 | 内容 |
|------|------|------|
| brief | IntentPlanner | 名字+身份+关键状态值 |
| summary | Writer(主角/配角) | 多行状态+持有物+关系 |
| detail | Reviewer | 完整状态+外貌+背景+绑定物+关系 |

### 3.4 角色等级追踪策略

| 等级 | 追踪范围 | 更新频率 |
|------|---------|---------|
| protagonist | 所有字段 | 每章更新 |
| supporting | 重要字段+基础字段 | 重要章节更新 |
| npc | 仅基础身份字段 | 出场章节更新 |

### 3.5 去重机制

1. **精确匹配**: 同projectId + 同entityType + 同name → 合并更新
2. **模糊匹配**: 去除空格/分隔符后比较（仅character类型）
3. **主角数限制**: 甜宠/言情题材最多2个protagonist，其他最多1个

### 3.6 合并更新规则

找到已有实体时：
- `position/personality/speakingTone/signatureDetail/sourceContent`: 新值覆盖旧值
- `genreState/profile`: 深度合并（新值覆盖同key旧值）
- `roleLevel`: 只升不降（protagonist > supporting > npc）

### 3.7 关系管理

```javascript
// 关系格式
{
  id: string,
  projectId: string,
  fromEntityId: string,
  toEntityId: string,
  relType: string,          // ally/enemy/rival/family/friend/subordinate/mentor/...
  relLabel: string,         // 关系描述（如"青梅竹马"）
  strength: number,         // 0-100，默认50
  trustLevel: number,       // 0-100，默认50
  startChapter: number,
  endChapter: number|null,
  isSecret: boolean,        // 秘密关系
  cognitiveOnly: boolean,   // 仅认知差异（A认为B是朋友，B不认为）
  notes: string
}
```

#### 关系类型推断

从关系素材内容中按关键词推断relType：

| relType | 关键词 |
|---------|--------|
| ally | 盟友/合作/友好/信任 |
| enemy | 敌人/敌对/对抗/仇/恨 |
| rival | 对手/竞争 |
| family | 家人/父母/兄弟/姐妹 |
| friend | 朋友/友谊/闺蜜 |
| subordinate | 下属/手下 |
| mentor | 导师/师父/师傅 |

### 3.8 状态快照

定稿通过后，对所有活跃角色保存状态快照：

```javascript
{
  id: string,               // snap-{entityId}-ch{chapterNumber}
  entityId: string,
  projectId: string,
  chapterNumber: number,
  baseState: { hp, combatPower, position, factionName, personality, speakingTone, signatureDetail },
  genreState: object,
  delta: object,            // 与上一章的差异
  changedFields: string[],
  bindsSnapshot: object[],
  relationsSnapshot: object[],
  briefText: string,
  summaryText: string,
  detailText: string,
  isValid: boolean,
  computedAt: string
}
```

---

## 4. 题材状态Schema (genreEntitySchemas)

### 4.1 动态生成机制

题材entitySchema数据定义在对应的genre插件文件中，genreEntitySchemas.js提供统一查询API。

### 4.2 默认Schema

```javascript
{
  id: 'default',
  label: '通用',
  entityTypes: ['character', 'location', 'relationship', 'foreshadowing', 'equipment', 'faction', 'worldview'],
  genreStateKeys: {},
  relationTypes: ['ally', 'enemy', 'rival', 'family', 'friend', 'subordinate', 'mentor'],
  narrativePhases: ['setup', 'rising', 'climax', 'falling', 'resolution'],
  milestones: {}
}
```

### 4.3 题材特有状态字段

| 题材ID | 额外字段 |
|--------|---------|
| high-martial | mp, cultivationStage, combatPowerLevel, spiritualRoot, meridianStatus, magicTreasures, techniques, sectRank |
| urban-reality | energy, wealth, jobTitle, company, education, socialStatus, skills, psychologicalState |
| sci-fi-apocalypse | stamina, radiation, combatPowerLevel, weapons, vehicle, mutation, supplies, missionStatus |
| tomato-talisman | talismanCount, activeTalisman, talismanEnergy, shadowLegion, cultivationStage, combatPowerLevel, petrificationLevel |
| tomato-system | systemLevel, checkinDays, systemPoints, abilities, cultivationStage, combatPowerLevel |
| high-martial-crossplane | mp, cultivationStage, combatPowerLevel, spiritualRoot, magicTreasures, techniques, currentPlane, sectRank |

### 4.4 角色状态基础字段（所有题材共有）

| 字段 | 标签 | 类型 | 默认值 | NPC追踪 | 配角追踪 |
|------|------|------|--------|---------|---------|
| hp | 生命值 | number | 100 | 否 | 是 |
| combatPower | 战力 | number | 0 | 否 | 是 |
| position | 职位/身份 | string | '' | 是 | 是 |
| factionName | 阵营 | string | '' | - | - |
| personality | 性格 | string | '' | - | - |
| speakingTone | 说话语气 | string | '' | - | - |
| signatureDetail | 标志性细节 | string | '' | 否 | 是 |
| protagonistMirror | 主角镜像 | string | '' | 否 | 是 |
| independentStance | 独立立场 | string | '' | 否 | 是 |
| fateArc | 命运弧光 | string | '' | 否 | 是 |
| innerConflict | 内在矛盾 | string | '' | 否 | 是 |

### 4.5 API

| 函数 | 返回 |
|------|------|
| getGenreEntitySchema(genreId) | 完整schema |
| getGenreStateKeys(genreId) | genreStateKeys映射 |
| getGenreRelationTypes(genreId) | 关系类型列表 |
| getGenreRelationTypeKeywords(genreId) | 关系类型关键词映射 |
| getGenreNarrativePhases(genreId) | 叙事阶段列表 |
| getGenreMilestones(genreId) | 里程碑映射 |
| buildGenreStateDefaults(genreId) | 题材状态默认值对象 |
| validateGenreState(genreId, state) | 校验错误列表 |
