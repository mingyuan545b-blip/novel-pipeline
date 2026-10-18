# Novel Pipeline 数据库结构说明

> **维护规则**：每次修改表结构（增删列、改类型、改索引）时，必须同步更新本文档。
> **最后更新**：2026-09-21
> **Schema源文件**：`server/db/pgSchema.js`（业务表20张 + 实体扩展表）、`server/db/knowledgeSchema.js`（知识库表9张）、`server/db/pgSchemaLibrary.js`（藏经阁表1张）
> **Extract函数源文件**：`server/db/database-pg.js`

---

## 存储架构

所有专用表采用**双存储模式**：
- **专用列**：用于SQL WHERE/ORDER BY/INDEX查询
- **`data` JSON列**：保存原始完整对象，读取时只解析此列

```
写入: extractXxxFields(data) → 拆分为专用列 + data列
读取: SELECT data FROM xxx → safeParse(data) → 返回原始对象
```

路由别名映射（`TABLE_ALIASES`）：

| 路由名 | PG表名 |
|--------|--------|
| api-keys | api_keys |
| agent-bindings | agent_bindings |
| state-kv-index | state_kv_index |
| character-states | character_states |
| character-state-cache | character_state_cache |
| entity-registry | entity_registry |
| item-definitions | item_definitions |
| character-binds | character_binds |
| character-relations | character_relations |
| pet-entities | pet_entities |
| servant-entities | servant_entities |
| library-techniques | library_techniques |

未在 `DEDICATED_TABLES` 中的类型自动存入 `kv_store` 通用表。

---

## 表关系图

```
projects (1) ──┬── (N) chapters
                ├── (N) materials
                ├── (N) quests
                ├── (N) timelines
                ├── (N) pipeline_logs
                ├── (N) infinite_pipeline_state
                │
                ├── entity_registry (1) ──┬── (N) character_binds ─── item_definitions
                │       entityType=       ├── (N) character_relations
                │       'character'       ├── (N) pet_entities
                │                         └── (N) servant_entities
                │
                ├── item_definitions (1) ──── (N) character_binds
                │       defType=
                │       'equipment'/'technique'
                │
                ├── character_state_cache (per character per chapter)
                ├── character_states (delta log)
                └── state_kv_index (KV索引)

api_keys (1) ──── (N) agent_bindings
reviews (per chapter per reviewType)

─── 知识库表 ───

entities (1) ──┬── (N) entity_state_history (per chapter)
               ├── (N) entity_relations ──── entities (双向)
               ├── (N) entity_binds ──── entities (目标实体)
               └── (N) foreshadow_ledger (relatedEntityIds)

knowledge_facts (per project, L0-L3 分层)
narrative_state (per chapter, 唯一)
consistency_checks (per chapter per checkType)
craft_materials (per project per craftType)
timeline (per project per chapter)
```

---

## 表详细说明

### 1. projects — 项目

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 项目ID |
| mode | TEXT | 'novel' | 模式：novel（统一长篇模式，原 tomato-short 已移除） |
| targetChapterCount | INTEGER | NULL | 目标章数 |
| targetWordCount | INTEGER | NULL | 目标字数 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**data列包含**：title, description, styleProfile, genre, outline, settings, hookBudget, ruleStack 等全部项目配置

**索引**：idx_projects_mode(mode)

---

### 2. chapters — 章节

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 章节ID |
| projectId | TEXT | — | 所属项目 |
| chapterNumber | INTEGER | 0 | 章节序号 |
| status | TEXT | 'outlined' | outlined/draft/reviewed/approved/published |
| title | TEXT | '' | 章节标题 |
| wordCount | INTEGER | 0 | 字数 |
| round | INTEGER | 0 | 审核轮次 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**data列包含**：content, normalContent, outline, intent, reviews[], readerOutput, writerOutput 等

**索引**：
- idx_chapters_project(projectId, chapterNumber)
- idx_chapters_project_number UNIQUE(projectId, chapterNumber)
- idx_chapters_status(status)
- idx_chapters_wordcount(wordCount)

---

### 3. materials — 素材

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 素材ID |
| projectId | TEXT | — | 所属项目 |
| type | TEXT | 'other' | character/worldview/foreshadowing/equipment/technique/other |
| name | TEXT | '' | 素材名称 |
| parentPlane | TEXT | NULL | 所属位面 |
| parentFaction | TEXT | NULL | 所属势力 |
| archived | BOOLEAN | false | 是否归档 |
| dialectRegion | TEXT | NULL | 方言区域 |
| dialectIntensity | TEXT | 'medium' | 方言强度 |
| speechStyle | TEXT | NULL | 说话风格 |
| speechStyleIntensity | TEXT | 'medium' | 风格强度 |
| namingStyle | TEXT | NULL | 命名风格 |
| namingStyleIntensity | TEXT | 'medium' | 命名强度 |
| archetype | TEXT | NULL | 原型标签 |
| currentPlaneId | TEXT | NULL | 当前所在位面ID |
| isLocked | BOOLEAN | false | 是否锁定（锁定后不可被素材管理器修改） |
| version | INTEGER | 1 | 版本号 |
| sourceChapter | INTEGER | NULL | 来源章节 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**data列包含**：initialContent, currentContent, changeReason, dialectContent, speechStyleContent 等全部素材内容

**索引**：
- idx_materials_project(projectId)
- idx_materials_type(type, archived)
- idx_materials_parent(parentPlane, parentFaction)
- idx_materials_dialect(dialectRegion)
- idx_materials_style(speechStyle)
- idx_materials_locked(isLocked)
- idx_materials_version(version)
- idx_materials_project_type_name UNIQUE(projectId, type, name)

---

### 4. entity_registry — 实体注册表

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 实体ID |
| projectId | TEXT | — | 所属项目 |
| entityType | TEXT | 'character' | character/item/location/event/other |
| name | TEXT | '' | 实体名称 |
| briefName | TEXT | '' | 简称 |
| roleLevel | TEXT | 'npc' | protagonist/main/supporting/minor/npc |
| isActive | BOOLEAN | true | 是否活跃 |
| firstAppearChapter | INTEGER | 0 | 首次出场章节 |
| lastAppearChapter | INTEGER | 0 | 最后出场章节 |
| appearCount | INTEGER | 0 | 出场次数 |
| parentPlane | TEXT | NULL | 所属位面 |
| parentFaction | TEXT | NULL | 所属势力 |
| tags | TEXT | '[]' | JSON数组标签 |
| description | TEXT | '' | 实体描述 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_registry_project_type(projectId, entityType)
- idx_registry_project_active(projectId, isActive)
- idx_registry_project_name(projectId, name)
- idx_registry_appear(projectId, lastAppearChapter DESC)

---

### 5. item_definitions — 物品定义

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 物品ID |
| projectId | TEXT | — | 所属项目 |
| defType | TEXT | 'equipment' | equipment/technique/artifact/consumable |
| name | TEXT | '' | 物品名称 |
| rarity | TEXT | 'common' | common/uncommon/rare/epic/legendary |
| briefDesc | TEXT | '' | 简要描述 |
| summaryDesc | TEXT | '' | 摘要描述 |
| detailDesc | TEXT | '' | 详细描述 |
| loreDesc | TEXT | '' | 背景故事 |
| briefTokens | INTEGER | 0 | 简要token数 |
| summaryTokens | INTEGER | 0 | 摘要token数 |
| detailTokens | INTEGER | 0 | 详细token数 |
| loreTokens | INTEGER | 0 | 背景token数 |
| propertiesJson | TEXT | '{}' | JSON属性 |
| constraintsJson | TEXT | '{}' | JSON约束 |
| sourceChapter | INTEGER | NULL | 来源章节 |
| tags | TEXT | '[]' | JSON数组标签 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_itemdef_project_type(projectId, defType)
- idx_itemdef_project_rarity(projectId, rarity)
- idx_itemdef_project_name(projectId, name)

---

### 6. character_binds — 角色绑定（角色↔物品关联）

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 绑定ID |
| projectId | TEXT | — | 所属项目 |
| characterId | TEXT | — | → entity_registry.id (entityType='character') |
| defId | TEXT | — | → item_definitions.id |
| bindType | TEXT | 'equipment' | equipment/technique/artifact |
| bindStatus | TEXT | 'active' | active/lost/destroyed |
| acquiredChapter | INTEGER | 0 | 获得章节 |
| lostChapter | INTEGER | NULL | 失去章节 |
| masteryLevel | TEXT | '初学' | 熟练度等级 |
| masteryProgress | INTEGER | 0 | 熟练度进度 |
| personalNotes | TEXT | '' | 个人备注 |
| customName | TEXT | '' | 自定义名称 |
| slotPosition | TEXT | '' | 装备槽位 |
| bindOrder | INTEGER | 0 | 排序 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_bind_character(characterId, bindType)
- idx_bind_project(projectId, bindType)
- idx_bind_def(defId)
- idx_bind_status(projectId, bindStatus)
- idx_bind_unique UNIQUE(characterId, defId, bindType)

---

### 7. character_relations — 角色关系

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 关系ID |
| projectId | TEXT | — | 所属项目 |
| fromCharacterId | TEXT | — | → entity_registry.id (发起方) |
| toCharacterId | TEXT | — | → entity_registry.id (目标方) |
| relType | TEXT | 'other' | ally/enemy/mentor/lover/rival/family/other |
| relLabel | TEXT | '' | 关系标签描述 |
| strength | INTEGER | 50 | 关系强度 0-100 |
| trustLevel | INTEGER | 50 | 信任度 0-100 |
| startChapter | INTEGER | 0 | 关系开始章节 |
| endChapter | INTEGER | NULL | 关系结束章节 |
| isSecret | BOOLEAN | false | 是否秘密关系 |
| notes | TEXT | '' | 备注 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_rel_from(fromCharacterId)
- idx_rel_to(toCharacterId)
- idx_rel_project(projectId, relType)
- idx_rel_unique UNIQUE(fromCharacterId, toCharacterId, relType)

---

### 8. pet_entities — 宠物实体

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 宠物ID |
| projectId | TEXT | — | 所属项目 |
| ownerId | TEXT | — | → entity_registry.id (主人) |
| name | TEXT | '' | 宠物名称 |
| species | TEXT | '' | 物种 |
| petClass | TEXT | 'beast' | beast/spirit/construct/undead |
| rarity | TEXT | 'common' | common/uncommon/rare/epic/legendary |
| growthStage | TEXT | '幼体' | 幼体/成长期/成熟期/完全体 |
| level | INTEGER | 1 | 等级 |
| hp | INTEGER | 100 | 生命值 |
| mp | INTEGER | 50 | 魔法值 |
| loyalty | INTEGER | 80 | 忠诚度 0-100 |
| intelligence | INTEGER | 30 | 智力 |
| abilitiesJson | TEXT | '[]' | JSON技能数组 |
| equipmentSlots | TEXT | '[]' | JSON装备槽数组 |
| briefDesc | TEXT | '' | 简要描述 |
| summaryDesc | TEXT | '' | 摘要描述 |
| detailDesc | TEXT | '' | 详细描述 |
| acquiredChapter | INTEGER | 0 | 获得章节 |
| isActive | BOOLEAN | true | 是否活跃 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_pet_owner(ownerId)
- idx_pet_project(projectId, isActive)
- idx_pet_species(projectId, species)

---

### 9. servant_entities — 仆从实体

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 仆从ID |
| projectId | TEXT | — | 所属项目 |
| masterId | TEXT | — | → entity_registry.id (主人) |
| name | TEXT | '' | 仆从名称 |
| servantType | TEXT | 'retainer' | retainer/guard/servant/advisor/companion |
| loyalty | INTEGER | 70 | 忠诚度 0-100 |
| competence | INTEGER | 50 | 能力值 0-100 |
| specialty | TEXT | '' | 专长 |
| personality | TEXT | '' | 性格 |
| briefDesc | TEXT | '' | 简要描述 |
| summaryDesc | TEXT | '' | 摘要描述 |
| detailDesc | TEXT | '' | 详细描述 |
| recruitedChapter | INTEGER | 0 | 招募章节 |
| dismissedChapter | INTEGER | NULL | 解雇章节 |
| isActive | BOOLEAN | true | 是否活跃 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_servant_master(masterId)
- idx_servant_project(projectId, isActive)
- idx_servant_type(projectId, servantType)

---

### 10. character_state_cache — 角色状态缓存

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 缓存ID |
| characterId | TEXT | — | → entity_registry.id |
| projectId | TEXT | — | 所属项目 |
| chapterNumber | INTEGER | 0 | 章节序号 |
| roleLevel | TEXT | 'npc' | 当前角色等级 |
| briefText | TEXT | '' | 简要状态文本 |
| briefTokens | INTEGER | 0 | 简要token数 |
| summaryText | TEXT | '' | 摘要状态文本 |
| summaryTokens | INTEGER | 0 | 摘要token数 |
| detailText | TEXT | '' | 详细状态文本 |
| detailTokens | INTEGER | 0 | 详细token数 |
| stateJson | TEXT | '{}' | JSON状态快照 |
| bindsJson | TEXT | '[]' | JSON绑定列表 |
| relationsJson | TEXT | '[]' | JSON关系列表 |
| deltaJson | TEXT | '{}' | JSON与上章差异 |
| changedFields | TEXT | '[]' | JSON变更字段列表 |
| isValid | BOOLEAN | true | 缓存是否有效 |
| computedAt | TIMESTAMPTZ | NOW() | 计算时间 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_cache_character(characterId, chapterNumber)
- idx_cache_project_ch(projectId, chapterNumber)
- idx_cache_project_ch_role(projectId, chapterNumber, roleLevel)
- idx_cache_unique UNIQUE(characterId, chapterNumber)
- idx_cache_stale(projectId, isValid) WHERE isValid = false

---

### 11. character_states — 角色状态增量日志

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 日志ID |
| projectId | TEXT | — | 所属项目 |
| characterId | TEXT | — | → entity_registry.id |
| characterName | TEXT | '' | 角色名称（冗余） |
| chapterNumber | INTEGER | 0 | 章节序号 |
| delta | TEXT | '{}' | JSON增量变更 |
| stateChangedFields | TEXT | '[]' | JSON变更字段列表 |
| previousChapterState | TEXT | NULL | 上一章状态快照 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_char_state_project(projectId, characterId)
- idx_char_state_chapter(projectId, chapterNumber)

---

### 12. state_kv_index — 状态KV索引

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 索引ID |
| projectId | TEXT | — | 所属项目 |
| scope | TEXT | '' | 作用域(character/worldview/plot) |
| entityKey | TEXT | '' | 实体键 |
| dataKey | TEXT | '' | 数据键 |
| dataValue | TEXT | '' | 数据值 |
| dataType | TEXT | 'string' | string/number/boolean/json |
| chapterUpdated | INTEGER | 0 | 更新章节 |
| isHot | BOOLEAN | false | 是否热点数据 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_kv_project_scope(projectId, scope)
- idx_kv_entity(projectId, entityKey)
- idx_kv_hot(projectId, scope, isHot)

---

### 13. quests — 任务/线索

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 任务ID |
| projectId | TEXT | — | 所属项目 |
| parentId | TEXT | NULL | 父任务ID（自关联） |
| status | TEXT | 'planned' | planned/active/completed/abandoned |
| priority | TEXT | 'normal' | low/normal/high/critical |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_quests_project(projectId)
- idx_quests_parent(parentId)
- idx_quests_status(status)

---

### 14. timelines — 时间线事件

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 事件ID |
| projectId | TEXT | — | 所属项目 |
| eventType | TEXT | 'plot' | plot/character/worldview/battle/other |
| importance | TEXT | 'normal' | minor/normal/major/critical |
| isKeyEvent | BOOLEAN | false | 是否关键事件 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_timelines_project(projectId)
- idx_timelines_type(eventType)

---

### 15. reviews — 审核记录

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 审核ID |
| chapterId | TEXT | — | → chapters.id |
| projectId | TEXT | — | 所属项目 |
| reviewType | TEXT | 'first-review' | first-review/second-review/reader/reviser |
| passed | BOOLEAN | false | 是否通过 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_reviews_chapter(chapterId)
- idx_reviews_project(projectId)
- idx_reviews_type(reviewType)

---

### 16. pipeline_logs — Pipeline执行日志

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 日志ID |
| projectId | TEXT | — | 所属项目 |
| chapterId | TEXT | — | → chapters.id |
| step | TEXT | — | 步骤名(writer/first-review/second-review/reader等) |
| status | TEXT | 'running' | running/completed/error |
| round | INTEGER | 0 | 审核轮次 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_pipeline_logs_project(projectId)
- idx_pipeline_logs_chapter(chapterId)

---

### 17. infinite_pipeline_state — 无限Pipeline状态

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 状态ID |
| projectId | TEXT UNIQUE | — | 所属项目（唯一） |
| running | BOOLEAN | false | 是否运行中 |
| phase | TEXT | — | 当前阶段 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：idx_infinite_pipeline_project(projectId)

---

### 18. api_keys — API密钥

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 密钥ID |
| apiKey | TEXT | '' | API密钥（可能加密） |
| groupId | TEXT | '' | 分组ID |
| model | TEXT | '' | 模型名 |
| provider | TEXT | '' | 提供商(openai/anthropic/deepseek等) |
| baseURL | TEXT | '' | API基础URL |
| name | TEXT | '' | 显示名称 |
| _encrypted | BOOLEAN | false | 是否已加密 |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_api_keys_provider(provider)

---

### 19. agent_bindings — Agent密钥绑定

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 绑定ID |
| agentType | TEXT | '' | → Agent类型(writer/reader等) |
| keyId | TEXT | '' | → api_keys.id |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_agent_bindings_keyId(keyId)
- idx_agent_bindings_agentType(agentType)

---

### 20. kv_store — 通用KV存储

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | TEXT | — | 数据类型（联合主键） |
| id | TEXT | — | 数据ID（联合主键） |
| data | TEXT | — | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**主键**：PRIMARY KEY(type, id)

**索引**：idx_kv_type(type)

**存储的数据类型**：hook_budget, rule_stack, context_trace, prompt_config, genre_config, reader-schedule 等无专用表的数据

---

## 知识库表（knowledgeSchema.js）

> 以下9张表由 `server/db/knowledgeSchema.js` 定义，通过 `store-pg.js` 的 knowledge 表 handler 路由。
> 知识库表统一使用 JSONB 类型存储扩展数据（而非 TEXT+safeParse）。

### 21. entities — 统一实体表

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 实体ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| entityType | TEXT NOT NULL | — | character/item/location/event/other |
| name | TEXT NOT NULL | '' | 实体名称 |
| briefName | TEXT | '' | 简称 |
| roleLevel | TEXT NOT NULL | 'npc' | protagonist/main/supporting/minor/npc |
| genreId | TEXT | '' | 题材ID |
| isActive | BOOLEAN | true | 是否活跃 |
| isLocked | BOOLEAN | false | 是否锁定 |
| firstAppearChapter | INTEGER | 0 | 首次出场章节 |
| lastAppearChapter | INTEGER | 0 | 最后出场章节 |
| appearCount | INTEGER | 0 | 出场次数 |
| parentEntityId | TEXT | NULL | 父实体ID（层级关系） |
| tags | JSONB | '[]' | 标签数组 |
| hp | INTEGER | 100 | 生命值 |
| combatPower | INTEGER | 0 | 战力值 |
| position | TEXT | '' | 位置/职位 |
| factionName | TEXT | '' | 势力名称 |
| personality | TEXT | '' | 性格 |
| speakingTone | TEXT | '' | 说话语气 |
| signatureDetail | TEXT | '' | 标志性细节 |
| genreState | JSONB | '{}' | 题材特有状态（修仙→cultivationStage, 都市→jobTitle等） |
| profile | JSONB | '{}' | 静态档案（外貌、背景等不随章节变化的内容） |
| bindsSummary | JSONB | '[]' | 当前绑定物摘要（缓存） |
| relationsSummary | JSONB | '[]' | 当前关系摘要（缓存） |
| briefText | TEXT | '' | 简要提示词文本 |
| briefTokens | INTEGER | 0 | 简要token数 |
| summaryText | TEXT | '' | 摘要提示词文本 |
| summaryTokens | INTEGER | 0 | 摘要token数 |
| detailText | TEXT | '' | 详细提示词文本 |
| detailTokens | INTEGER | 0 | 详细token数 |
| sourceContent | TEXT | '' | 素材原文（保留原始素材内容） |
| version | INTEGER | 1 | 版本号 |
| sourceChapter | INTEGER | NULL | 来源章节 |
| archived | TEXT | '' | 归档状态 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_ent_project(projectId)
- idx_ent_project_type(projectId, entityType)
- idx_ent_project_active(projectId, isActive)
- idx_ent_project_name(projectId, name)
- idx_ent_project_role(projectId, roleLevel)
- idx_ent_parent(parentEntityId)
- idx_ent_genre(projectId, genreId)
- idx_ent_project_type_name UNIQUE(projectId, entityType, name) WHERE isActive = true
- idx_ent_genre_state GIN(genreState)
- idx_ent_profile GIN(profile)

**设计说明**：一个角色/地点/势力/物品 = 一条记录，不再每章创建新记录。状态变化走 entity_state_history。

---

### 22. entity_state_history — 实体状态历史

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 记录ID |
| entityId | TEXT NOT NULL | — | → entities.id |
| projectId | TEXT NOT NULL | — | 所属项目 |
| chapterNumber | INTEGER NOT NULL | — | 章节序号 |
| baseState | JSONB | '{}' | 该章结束时的基础状态快照 |
| genreState | JSONB | '{}' | 该章结束时的题材状态快照 |
| delta | JSONB | '{}' | 与上一章的差异 |
| changedFields | JSONB | '[]' | 变更字段列表 |
| bindsSnapshot | JSONB | '[]' | 绑定物快照 |
| relationsSnapshot | JSONB | '[]' | 关系快照 |
| briefText | TEXT | '' | 简要提示词 |
| summaryText | TEXT | '' | 摘要提示词 |
| detailText | TEXT | '' | 详细提示词 |
| isValid | BOOLEAN | true | 缓存是否有效 |
| computedAt | TIMESTAMPTZ | NOW() | 计算时间 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_esh_entity_ch UNIQUE(entityId, chapterNumber)
- idx_esh_project_ch(projectId, chapterNumber)
- idx_esh_project_ch_role(projectId, chapterNumber)
- idx_esh_stale(projectId, isValid) WHERE isValid = false

**设计说明**：每章每个实体一条记录，替代旧版 character_states + character_state_cache 的 per-chapter 数据。

---

### 23. entity_relations — 实体关系图谱

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 关系ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| fromEntityId | TEXT NOT NULL | — | → entities.id（发起方） |
| toEntityId | TEXT NOT NULL | — | → entities.id（目标方） |
| relType | TEXT NOT NULL | — | 关系类型（题材插件定义，如ally/enemy/mentor等） |
| relLabel | TEXT | '' | 关系标签描述 |
| strength | INTEGER | 50 | 关系强度 0-100 |
| trustLevel | INTEGER | 50 | 信任度 0-100 |
| startChapter | INTEGER | 0 | 关系开始章节 |
| endChapter | INTEGER | NULL | 关系结束章节 |
| isSecret | BOOLEAN | false | 是否秘密关系 |
| cognitiveOnly | BOOLEAN | false | 是否仅认知差异（A认为B是朋友，B认为A是利用者） |
| notes | TEXT | '' | 备注 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_erel_from(fromEntityId)
- idx_erel_to(toEntityId)
- idx_erel_project(projectId, relType)
- idx_erel_unique UNIQUE(fromEntityId, toEntityId, relType)
- idx_erel_project_ch(projectId, startChapter)

**设计说明**：替代旧版 character_relations，扩展到所有实体类型。支持有向图 + 认知差异。

---

### 24. entity_binds — 实体绑定关系

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 绑定ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| entityId | TEXT NOT NULL | — | → entities.id（持有方） |
| targetEntityId | TEXT NOT NULL | — | → entities.id（目标实体） |
| bindType | TEXT NOT NULL | — | 绑定类型（equipment/technique/artifact等） |
| bindStatus | TEXT | 'active' | active/lost/destroyed |
| permanence | TEXT | 'semi-permanent' | permanent/semi-permanent/temporary |
| acquiredChapter | INTEGER | 0 | 获得章节 |
| lostChapter | INTEGER | NULL | 失去章节 |
| masteryLevel | TEXT | '' | 熟练度等级 |
| masteryProgress | INTEGER | 0 | 熟练度进度 |
| personalNotes | TEXT | '' | 个人备注 |
| customName | TEXT | '' | 自定义名称 |
| slotPosition | TEXT | '' | 装备槽位 |
| bindOrder | INTEGER | 0 | 排序 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_ebind_entity(entityId, bindType)
- idx_ebind_project(projectId, bindType)
- idx_ebind_target(targetEntityId)
- idx_ebind_status(projectId, bindStatus)
- idx_ebind_unique UNIQUE(entityId, targetEntityId, bindType)

**设计说明**：替代旧版 character_binds，扩展到所有实体类型。

---

### 25. foreshadow_ledger — 伏笔账本

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 伏笔ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| name | TEXT NOT NULL | — | 伏笔名称 |
| description | TEXT | '' | 伏笔描述 |
| status | TEXT NOT NULL | 'planted' | planted/advanced/resolved/abandoned |
| plantChapter | INTEGER | 0 | 埋设章节 |
| lastAdvanceChapter | INTEGER | 0 | 最后推进章节 |
| resolveChapter | INTEGER | NULL | 回收章节 |
| expectedResolveWindow | TEXT | '' | 预期回收窗口 |
| importance | TEXT | 'normal' | normal/important/critical |
| relatedEntityIds | JSONB | '[]' | 关联实体ID列表 |
| relatedPlotThreads | JSONB | '[]' | 关联剧情线列表 |
| advanceLog | JSONB | '[]' | 推进日志 |
| resolutionNotes | TEXT | '' | 回收备注 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_foreshadow_project(projectId)
- idx_foreshadow_status(projectId, status)
- idx_foreshadow_importance(projectId, importance)
- idx_foreshadow_chapter(projectId, plantChapter)

**设计说明**：追踪每个伏笔的完整生命周期：埋设→推进→回收。ForeshadowGuard 读取此表检测超期伏笔。

---

### 26. knowledge_facts — 记忆金字塔

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 事实ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| level | TEXT NOT NULL | 'L2' | L0=核心设定(永不衰减) L1=近期关键(5章内) L2=中期参考(15章内) L3=远期存档(按需) |
| category | TEXT NOT NULL | 'plot' | plot/character/worldview/mechanic |
| entityId | TEXT | NULL | → entities.id |
| chapterNumber | INTEGER | 0 | 记录章节 |
| factText | TEXT NOT NULL | '' | 事实内容 |
| importance | INTEGER | 50 | 重要性 0-100 |
| accessCount | INTEGER | 0 | 被引用次数 |
| lastAccessedChapter | INTEGER | 0 | 最后引用章节 |
| decayScore | REAL | 1.0 | 衰减分数（0-1，越低越不重要） |
| expiresAtChapter | INTEGER | NULL | 过期章节 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_kfact_project(projectId)
- idx_kfact_project_level(projectId, level)
- idx_kfact_project_category(projectId, category)
- idx_kfact_entity(entityId)
- idx_kfact_decay(projectId, decayScore)
- idx_kfact_chapter(projectId, chapterNumber)

**设计说明**：MemoryPyramid 管理4层记忆，runDecayCycle 按章节推进衰减。

---

### 27. narrative_state — 叙事状态

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 状态ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| chapterNumber | INTEGER NOT NULL | — | 章节序号 |
| phase | TEXT NOT NULL | 'setup' | setup/rising_action/climax/falling_action/resolution |
| tension | INTEGER | 50 | 张力值 0-100 |
| pacing | TEXT | 'moderate' | slow/moderate/fast |
| activePlotThreads | JSONB | '[]' | 活跃剧情线 |
| completedPlotThreads | JSONB | '[]' | 已完成剧情线 |
| milestone | TEXT | '' | 里程碑标记 |
| emotionalArc | JSONB | '{}' | 情感弧线 |
| readerExpectation | JSONB | '{}' | 读者预期 |
| notes | TEXT | '' | 备注 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_narr_project_ch UNIQUE(projectId, chapterNumber)
- idx_narr_project_phase(projectId, phase)

**设计说明**：每章一条，记录故事处于起承转合哪个阶段。NarrativeTracker 管理此表。

---

### 28. consistency_checks — 一致性校验结果

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 检查ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| chapterNumber | INTEGER NOT NULL | — | 章节序号 |
| checkType | TEXT NOT NULL | 'name' | name/power/timeline/foreshadow/character_arc |
| severity | TEXT NOT NULL | 'warning' | warning/error/critical |
| entityId | TEXT | NULL | → entities.id |
| description | TEXT NOT NULL | '' | 问题描述 |
| expectedValue | TEXT | '' | 期望值 |
| actualValue | TEXT | '' | 实际值 |
| isResolved | BOOLEAN | false | 是否已解决 |
| resolvedChapter | INTEGER | NULL | 解决章节 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_ccheck_project(projectId)
- idx_ccheck_project_ch(projectId, chapterNumber)
- idx_ccheck_severity(projectId, severity)
- idx_ccheck_unresolved(projectId, isResolved) WHERE isResolved = false

**设计说明**：正文 vs 知识库交叉比对，记录所有不一致。ConsistencyChecker 管理此表。

---

### 29. craft_materials — 创作规范素材

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 素材ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| craftType | TEXT NOT NULL | — | catchphrase/famous-scene/writing-technique/craft/mechanism等 |
| name | TEXT NOT NULL | '' | 素材名称 |
| content | TEXT | '' | 素材内容 |
| archived | TEXT | '' | 归档状态 |
| tags | JSONB | '[]' | 标签数组 |
| metadata | JSONB | '{}' | 元数据 |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_craft_project(projectId)
- idx_craft_project_type(projectId, craftType)
- idx_craft_project_name(projectId, name)

**设计说明**：替代 materials 中 catchphrase/famous-scene/writing-technique/craft/mechanism 等非实体类素材。

---

### 30. timeline — 时间轴事件表

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | TEXT PK | — | 事件ID |
| projectId | TEXT NOT NULL | — | 所属项目 |
| chapterNumber | INTEGER NOT NULL | 0 | 章节序号 |
| eventTime | TEXT | '' | 故事内时间 |
| eventType | TEXT NOT NULL | 'event' | battle/meeting/discovery/travel/death/birth/ceremony/betrayal/alliance/breakthrough/custom |
| actorIds | JSONB | '[]' | 参与者实体ID列表 |
| locationId | TEXT | '' | 地点实体ID |
| description | TEXT NOT NULL | '' | 事件描述 |
| precedingEventIds | JSONB | '[]' | 前置事件ID列表（因果链） |
| duration | TEXT | '' | 持续时间 |
| significance | TEXT | 'normal' | critical/major/normal/minor |
| data | JSONB | '{}' | JSON完整对象 |
| createdAt | TIMESTAMPTZ | NOW() | |
| updatedAt | TIMESTAMPTZ | NOW() | |

**索引**：
- idx_timeline_project(projectId)
- idx_timeline_project_chapter(projectId, chapterNumber)
- idx_timeline_project_time(projectId, eventTime)
- idx_timeline_project_type(projectId, eventType)

**设计说明**：TimelineService 管理此表。materialUpdateProcessor 每章自动提取时间事件写入。路由别名 `timeline-events` → `timeline`。

**注意**：此表与旧版 `timelines` 表（表14）不同。旧版 timelines 是简单事件记录，新版 timeline 支持因果链、参与者、地点等结构化数据。

---

### 31. library_techniques — 藏经阁写作技法库（2026-09-21 由JSON迁移）

藏经阁原为 `server/data/library/` 下三份JSON（index.json + leaf/*.json + metadata/*.json），
存在三处不一致风险（index 缺 subcategory、meta 与 leaf 分离）。现收敛为单表：
**一条记录 = 一个技法全文**（索引列用于SQL过滤 + `data` 列存完整JSON）。

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | 技法ID：`部门_子类_序号`（如 `02_情节引擎部_02_悬念编码_05`） |
| display_name | TEXT | 技法名（必须跨作品通用，禁止作品专有名词） |
| department / subcategory / category_path | TEXT | 归属（7部门 × 子类），decision于注入调度 |
| applicable_modes | TEXT(JSON) | 适用模式 novel（shuangwen/tomato-short 已移除） |
| context_slot / context_priority | TEXT/INT | L0(100) intent-planner、L2(80) writer、L3(70) polisher、L4(20) material-manager |
| injection_point | TEXT | intent-planner / writer / polisher / material-manager |
| worldview_depth | TEXT | macro / meso / micro |
| word_count_impact | TEXT | 对字数的影响区间 |
| retrieval_tags | TEXT(JSON) | BM25检索标签 |
| source_novel / source_type | TEXT | 来源作品 / curated(人工) 或 extracted(一键提取) |
| success_rate / attempts / auto_disabled | INT/INT/BOOL | 反馈闭环统计（<20%且≥5次自动禁用） |
| version | TEXT | 技法版本 |
| data | TEXT(JSON) | 完整对象（implementation_rules/anti_patterns/evidence/trigger_condition 等） |

索引：department、department+subcategory、injection_point、worldview_depth、source_novel、auto_disabled

写入handler：`server/db/store-pg-writer-library.js`（陷阱#31：必须有专用handler，否则写kv_store读专表）
迁移脚本：`node scripts/migrateLibraryToPg.js`（幂等，可重复执行）

---

## Agent写库映射

| Agent | 写入表 | 写入方式 |
|-------|--------|---------|
| 执笔人(writer) | chapters | content/normalContent |
| 初审(first-review) | reviews, chapters | reviewType='first-review', status |
| 复审(second-review) | reviews, chapters | reviewType='second-review', status |
| 返修员(reviser) | chapters | content修正 |
| 阅读者(reader) | chapters | readerOutput (每5章), readerAdvisory |
| 润色师(polisher) | chapters | normalContent |
| 素材管理(material-manager) | materials, entity_registry, item_definitions | create/update/retire |
| 素材登记(material-registrar) | character_state_cache, state_kv_index, entity_registry | 状态缓存+KV索引 |
| 意图规划(intent-planner) | chapters.intent | 章节意图 |
| 素材更新处理(materialUpdateProcessor) | entities, entity_relations, entity_binds, foreshadow_ledger, timeline, entity_state_history | 实体同步+关系同步+伏笔更新+时间事件+状态快照 |
| 时间轴守卫(timelineService) | timeline | 读写时间事件 |
| 战力守卫(powerGuard) | entities, entity_state_history | 读取实体战力+历史 |
| 伏笔守卫(foreshadowGuard) | foreshadow_ledger | 读取伏笔状态 |
| 角色弧线守卫(characterArcGuard) | entities, entity_state_history | 读取实体出场+状态 |
| 一致性审计(consistencyAuditService) | entities, foreshadow_ledger, timeline, consistency_checks | 4维度审计 |
| 素材长线管理(materialLifecycleService) | materials, entities | 活跃度分析+归档 |

---

## 数据访问服务层

Agent不应直接调用 `store.queryItems/getItem`，应通过以下服务层接口访问数据。
改表结构时只需修改服务层，不需要修改每个Agent。

### projectService (`server/services/projectService.js`)

| 接口 | 返回 | 说明 |
|------|------|------|
| `getProject(projectId)` | project对象 | 获取项目 |
| `getStyleConfig(projectId)` | {mode, styleProfile, styleTemplate, wordConfig, genre, ...} | 获取风格配置（含style-template展开） |
| `getRuleStack(projectId)` | ruleStack对象 | 获取规则栈 |
| `getHookBudget(projectId)` | hookBudget对象 | 获取伏笔预算 |
| `getMode(projectId)` | 'novel' | 获取模式（统一长篇模式） |
| `getWordConfig(projectId)` | {rejectMin, maxWords, ...} | 获取字数配置 |
| `updateProject(projectId, updates)` | project对象 | 更新项目 |

**替代的裸调**：`store.getItem('projects', projectId)` → `projectService.getProject(projectId)`

### chapterService (`server/services/chapterService.js`)

| 接口 | 返回 | 说明 |
|------|------|------|
| `getChapter(chapterId)` | chapter对象 | 获取单个章节 |
| `getChaptersByProject(projectId, options)` | chapter[] | 获取项目章节（支持status/hasContent过滤） |
| `getPreviousChapter(projectId, chapterNumber)` | chapter/null | 获取前一已审核章节 |
| `getChapterByNumber(projectId, chapterNumber)` | chapter/null | 按序号获取章节 |
| `getRecentChapters(projectId, count)` | chapter[] | 获取最近N章 |
| `getChaptersWithReaderOutput(projectId, beforeChapter, count)` | chapter[] | 获取有阅读者输出的章节 |
| `getSkippedChapters(projectId, beforeChapter)` | chapter[] | 获取已跳过章节 |
| `updateChapter(chapterId, updates)` | chapter对象 | 更新章节 |

**替代的裸调**：
- `store.queryItems('chapters', {projectId}).filter(...)` → `chapterService.getPreviousChapter(projectId, chNum)`
- `store.queryItems('chapters', {projectId}).filter(c => c.readerOutput)` → `chapterService.getChaptersWithReaderOutput(projectId, chNum)`

### materialService (`server/services/materialService.js`)

| 接口 | 返回 | 说明 |
|------|------|------|
| `getMaterialsByProject(projectId, options)` | material[] | 获取素材（支持type/archived/locked过滤） |
| `getActiveMaterials(projectId, type)` | material[] | 获取活跃素材（未归档） |
| `getUnlockedMaterials(projectId, type)` | material[] | 获取未锁定素材（未归档+未锁定） |
| `getCharacters(projectId)` | material[] | 获取角色素材 |
| `getWorldviews(projectId)` | material[] | 获取世界观素材 |
| `getForeshadowing(projectId)` | material[] | 获取伏笔素材 |
| `getNarrativeBridges(projectId)` | material[] | 获取叙事桥段 |
| `getMaterial(materialId)` | material/null | 获取单个素材 |
| `updateMaterial(materialId, updates)` | material对象 | 更新素材 |
| `getMaterialByName(projectId, type, name)` | material/null | 按名称查找素材 |

**替代的裸调**：
- `store.queryItems('materials', {projectId}).filter(m => m.type === 'character' && !m.archived)` → `materialService.getCharacters(projectId)`
- `store.queryItems('materials', {projectId}).filter(m => !m.archived && !m.isLocked)` → `materialService.getUnlockedMaterials(projectId)`

### 已有服务层

| 服务 | 文件 | 接口 |
|------|------|------|
| EntityRegistry | `server/services/entityRegistry.js` | registerEntity, getEntity, queryEntities |
| CharacterStateCache | `server/services/characterStateCache.js` | getCache, setCache, invalidateCache |
| ItemDefinition | `server/services/itemDefinition.js` | createDefinition, getDefinition, queryDefinitions |
| ReaderAdvisory | `server/services/pipeline/readerAdvisory.js` | getReaderAdvisory, formatAdvisoryForIntent, formatAdvisoryForOutline |

### DataContext — 统一数据入口（所有Agent必须通过此访问数据）

**文件**：`server/services/dataContext.js`

DataContext 是所有 Agent 的唯一数据入口，内部委托各服务层获取数据，Agent 不直接调用 store。

| 委托服务 | 方法示例 | 说明 |
|---------|---------|------|
| projectService | ctx.getProject(), ctx.getStyleProfile() | 项目数据 |
| entityCenter | ctx.getEntitiesForWriter(), ctx.getEntitiesForReviewer() | 实体数据（按token预算裁剪） |
| timelineService | ctx.getTimelineSummary(), ctx.detectTimelineConflicts() | 时间轴数据 |
| powerGuard | ctx.checkPowerConsistency(), ctx.getPowerCheckHint() | 战力守卫 |
| foreshadowGuard | ctx.getForeshadowHint(), ctx.getForeshadowCheckHint() | 伏笔守卫 |
| characterArcGuard | ctx.checkCharacterArcs(), ctx.getCharacterActivityHint() | 角色弧线守卫 |
| consistencyAuditService | ctx.runFullAudit(), ctx.shouldRunAudit() | 长线一致性审计 |
| materialLifecycleService | ctx.calculateTokenBudget(), ctx.getMaterialHealthReport() | 素材长线管理 |

**使用方式**：
```javascript
const { getDataContext } = require('./dataContext');
const ctx = await getDataContext(projectId);
const project = await ctx.getProject();
const events = await ctx.getTimelineEventsForChapter(chapterNumber);
```

**替代的裸调**：
- `store.getItem('projects', projectId)` → `ctx.getProject()`
- `store.queryItems('chapters', {projectId})` → `ctx.getChapters()`
- `store.queryItems('materials', {projectId, type: 'character'})` → `ctx.getCharacterMaterials()`

---

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-05-25 | 初始创建：20张表完整文档 |
| 2026-05-25 | entity_registry 新增 description 列（pgSchema.js + store-pg.js + entityRegistry.js） |
| 2026-05-25 | 新增 projectService.js 服务层（getProject/getStyleConfig/getMode/getWordConfig） |
| 2026-05-25 | 新增 chapterService.js 服务层（getPreviousChapter/getChaptersWithReaderOutput/getSkippedChapters） |
| 2026-05-25 | 新增 materialService.js 服务层（getCharacters/getForeshadowing/getUnlockedMaterials） |
| 2026-05-25 | 新增 readerAdvisory.js 服务（getReaderAdvisory/formatAdvisoryForIntent/formatAdvisoryForOutline） |
| 2026-05-25 | migrateEntityRegistry.js: toCharacterId 改为存角色ID而非名称 |
| 2026-05-25 | 阅读者(reader) Agent 频率从每15章改为每5章（pipelineHelpers.js READER_INTERVAL=5） |
| 2026-05-25 | 阅读者(reader) Agent 注册到 FALLBACK_AGENT_TEMPLATES 和 AGENT_META |
| 2026-05-26 | 新增番茄子题材系统：4个genre插件（tomato-revenge/tomato-sweet/tomato-mystery/tomato-system） |
| 2026-05-26 | contentUtils.js: 新增 TOMATO_SUBGENRE_CONFIGS、detectReversalDensity()、detectOpeningHook()、validateTomatoMetrics() 支持subGenre参数 |
| 2026-05-26 | pipelineConfig.js: 新增 TOMATO_SUBGENRE_PIPELINE_CONFIGS（4个子题材里程碑配置）+ getTomatoSubgenrePipelineConfig() |
| 2026-05-26 | pipelineHelpers.js: shouldTriggerReader/runReaderCheck 新增 subGenre 参数，番茄子题材独立阅读者触发频率 |
| 2026-05-26 | writer.js: 番茄子题材里程碑注入（当前+近期预告）+ validateTomatoMetrics 传入 subGenre + 反转密度记录 |
| 2026-05-26 | projectService.js: getStyleConfig 新增 subGenre 字段 + 新增 getSubGenre() |
| 2026-05-26 | 前端 CreateProjectModal: 新增 TOMATO_SUBGENRE_OPTIONS 子题材选择UI + subGenre 传入所有创建路径 |
| 2026-05-26 | 前端 Dashboard: 项目列表显示子题材标签 |
| 2026-05-26 | 新增 tomato-talisman（符咒收集流）genre：12条约束+7个检测器+成瘾循环+暴力美学+广告式章节名+幽默节奏+符咒代价+季概念 |
| 2026-05-26 | contentUtils.js: 新增 tomato-talisman 子题材配置 + detectCombatDensity() + detectHumorPacing() |
| 2026-05-26 | pipelineConfig.js: 新增 tomato-talisman 里程碑+四季SEASONS配置+SEASON_FINALE_HOOK |
| 2026-05-26 | pipelineHelpers.js: tomato-talisman 阅读者触发 [5,10,14,19,24,28] |
| 2026-05-26 | projectService.js: 新增季概念（season/parentProjectId/getPreviousSeasonFinale/createNextSeason/inheritMaterialsFromPreviousSeason） |
| 2026-05-26 | writer.js: 季终章悬念钩子注入+跨季一致性注入（上一季结局回顾）+当前季信息注入 |
| 2026-05-26 | 前端 CreateProjectModal: 新增符咒收集流选项+season/parentProjectId字段 |
| 2026-05-26 | 前端 Dashboard: 项目列表显示🐉符咒标签+S{N}季标签 |
| 2026-06-03 | 新增知识库9张表文档（entities/entity_state_history/entity_relations/entity_binds/foreshadow_ledger/knowledge_facts/narrative_state/consistency_checks/craft_materials/timeline） |
| 2026-06-03 | 新增DataContext统一数据入口文档 |
| 2026-06-03 | 更新表关系图，添加知识库表关系 |
| 2026-06-03 | 更新Agent写库映射，添加守卫服务映射 |
