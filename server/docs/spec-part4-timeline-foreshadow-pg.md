# 规范文档 Part 4: 时间轴 + 伏笔回收 + PG数据库映射

> 本文档定义时间轴系统、伏笔回收系统的格式字段，以及PostgreSQL数据库的完整Schema映射。

---

## 1. 时间轴系统 (TimelineService)

### 1.1 事件格式

```javascript
{
  id: string,               // tl-{timestamp}-{random}
  projectId: string,
  chapterNumber: number,
  eventTime: string,        // 故事内时间（如"第三天清晨"）
  eventType: string,        // 事件类型
  actorIds: string[],       // 参与者实体ID列表
  locationId: string,       // 地点实体ID
  description: string,      // 事件描述
  precedingEventIds: string[], // 前置事件ID（因果链）
  duration: string,         // 事件持续时间
  significance: string,     // 重要程度
  data: object,             // 额外数据
  createdAt: string,
  updatedAt: string
}
```

### 1.2 事件类型

| 类型ID | 标签 | 用途 |
|--------|------|------|
| battle | 战斗 | 战斗场景 |
| meeting | 会面 | 角色首次/重要会面 |
| discovery | 发现 | 发现新信息/新地点 |
| travel | 旅行 | 角色移动 |
| death | 死亡 | 角色死亡 |
| birth | 出生 | 角色出生 |
| ceremony | 仪式 | 典礼/仪式 |
| betrayal | 背叛 | 背叛事件 |
| alliance | 结盟 | 结盟事件 |
| breakthrough | 突破 | 修炼/能力突破 |
| event | 自定义 | 其他事件 |

### 1.3 重要程度

| 级别 | 说明 |
|------|------|
| critical | 关键转折点，影响全局 |
| major | 重要事件，影响剧情走向 |
| normal | 普通事件 |
| minor | 次要事件，背景信息 |

### 1.4 核心API

| 方法 | 参数 | 返回 | 用途 |
|------|------|------|------|
| addEvent | projectId, event | event | 添加事件 |
| addEvents | projectId, events[] | event[] | 批量添加 |
| getEventsForChapter | projectId, chapterNumber | event[] | 章节事件 |
| getEventsForRange | projectId, from, to | event[] | 范围事件 |
| getRecentEvents | projectId, currentChapter, lookback=5 | event[] | 近期事件 |
| getCausalChain | projectId, eventId, maxDepth=10 | event[] | 因果链回溯 |
| getEventsForEntity | projectId, entityId | event[] | 实体参与事件 |
| getEventsForLocation | projectId, locationId | event[] | 地点事件 |
| deleteEventsForChapter | projectId, chapterNumber | number | 删除章节事件 |
| updateEvent | eventId, updates | event | 更新事件 |
| getStats | projectId | stats | 统计信息 |
| generateTimelineSummary | projectId, ch, lookback=5, budget=800 | string | Writer注入文本 |
| detectTimeConflicts | projectId, chapterNumber | conflict[] | 时间矛盾检测 |

### 1.5 时间矛盾检测

检测同一角色在同一章内出现在不同地点：

```javascript
// 冲突格式
{
  actorId: string,
  events: string[],         // 冲突事件ID列表
  locations: string[],      // 不同地点ID列表
  description: string       // "角色X在同一章内出现在不同地点"
}
```

### 1.6 Writer注入格式

```
【近期时间线】
第5章 [第三天清晨] 主角与反派首次对峙
第6章 [第三天午后] 发现隐藏的地下通道
第7章 [第四天] 突破练气期

【时间线规则】本章事件必须与前章时间线保持连贯，不得出现时间矛盾。
```

---

## 2. 伏笔回收系统

### 2.1 伏笔账本 (ForeshadowLedger)

#### 伏笔条目格式

```javascript
{
  id: string,               // fs-{timestamp}-{random}
  projectId: string,
  name: string,             // 伏笔名称
  description: string,      // 伏笔描述
  status: string,           // planted/advanced/resolved/abandoned
  plantChapter: number,     // 埋设章节
  lastAdvanceChapter: number, // 最后推进章节
  resolveChapter: number|null, // 回收章节
  expectedResolveWindow: string, // 预期回收窗口（如"10章内"）
  importance: string,       // normal/major/critical
  relatedEntityIds: string[], // 关联实体
  relatedPlotThreads: string[], // 关联剧情线
  advanceLog: [{ chapter, detail, timestamp }],
  resolutionNotes: string   // 回收说明
}
```

#### 状态流转

```
planted → advanced → resolved
                   → abandoned
```

- `planted`: 已埋设，未推进
- `advanced`: 已推进（至少被提及一次）
- `resolved`: 已回收
- `abandoned`: 已放弃

#### 核心API

| 方法 | 参数 | 返回 |
|------|------|------|
| plant | projectId, name, description, options | entry |
| advance | projectId, name, chapterNumber, detail | entry |
| resolve | projectId, name, chapterNumber, notes | entry |
| abandon | projectId, name, reason | entry |
| findByName | projectId, name | entry/null |
| getActive | projectId | entry[] |
| getOverdue | projectId, currentChapter | entry[] |
| getStats | projectId | { total, planted, advanced, resolved, abandoned } |

### 2.2 伏笔守卫 (ForeshadowGuard)

#### 超期阈值

| 配置项 | 值 | 说明 |
|--------|-----|------|
| OVERDUE_ADVANCE_CHAPTERS | 10 | 普通伏笔N章未推进视为超期 |
| OVERDUE_RESOLVE_CHAPTERS | 30 | N章未回收视为严重超期 |
| IMPORTANT_OVERDUE_CHAPTERS | 5 | 重要伏笔超期阈值更严格 |
| TARGET_RESOLVE_RATE | 0.7 | 回收率目标70% |

#### 超期检测逻辑

```javascript
for (const fs of activeForeshadows) {
  const age = currentChapter - fs.plantChapter;
  const lastAdvance = currentChapter - fs.lastAdvanceChapter;
  const isImportant = fs.importance === 'critical' || fs.importance === 'major';
  const threshold = isImportant ? 5 : 10;

  if (lastAdvance > threshold) {
    // 标记为超期
    severity = lastAdvance > 30 ? 'critical' : 'warning';
  }
}
```

#### Writer注入格式

```
【活跃伏笔 - 共3个】
▸ "身世之谜"（第1章埋设，已5章，状态：待推进）
▸ "暗影组织"（第3章埋设，已3章，状态：已推进）

【⚠️ 超期伏笔 - 共1个，优先推进】
🚨 "古剑秘密" - 伏笔"古剑秘密"已15章未回收，建议尽快推进或回收
```

#### Review注入格式

```
【伏笔一致性检测】发现2个问题：
⚠️ 伏笔"身世之谜"已8章未推进，建议在近期章节中提及
🚨 伏笔"古剑秘密"已15章未回收，建议尽快推进或回收
```

### 2.3 Hook预算系统 (HookBudgetSystem)

#### 伏笔类型定义

| 类型 | 回收时机 | 默认范围(章) |
|------|---------|-------------|
| 身份悬念 | slow-burn | 50-80 |
| 历史谜团 | slow-burn | 40-70 |
| 能力异常 | mid-arc | 20-40 |
| 角色深度 | mid-arc | 30-50 |
| 角色动机 | mid-arc | 15-30 |
| 角色变化 | endgame | 50-80 |
| 世界秘密 | endgame | 60-90 |
| 真相揭示 | endgame | 70-100 |
| 物品线索 | mid-arc | 15-30 |
| 能力展示 | near-term | 5-15 |
| 威胁逼近 | near-term | 5-15 |
| 同伴建立 | near-term | 3-10 |
| 势力博弈 | mid-arc | 20-40 |
| 伏笔铺垫 | mid-arc | 10-25 |
| 情感暗线 | slow-burn | 30-60 |

#### 预算状态

```javascript
{
  activeCount: number,      // 当前活跃伏笔数
  maxCapacity: 12,          // 最大容量
  remaining: number,        // 剩余坑位
  nearCapacity: boolean,    // 接近上限(>=10)
  overCapacity: boolean,    // 超出上限(>12)
  staleCount: number,       // 过期伏笔数
  urgentCount: number       // 紧急伏笔数
}
```

#### Hook Agenda（注入Writer）

```javascript
{
  mustAdvance: [{ id, type, notes }],      // 必须推进
  eligibleResolve: [{ id, type, notes }],  // 可回收
  staleDebt: [{ id, type, age, notes }],   // 过期旧债
  avoidNewFamilies: [string],              // 禁止新增的伏笔类型
  budget: { active, max, remaining, nearCapacity, overCapacity }
}
```

#### 自动检测规则

每章最多自动检测1个新伏笔，基于正则模式匹配：

| 模式 | 类型 |
|------|------|
| 隐藏...惊天/重大/致命...秘密 | 伏笔铺垫 |
| 暗藏...杀机/玄机/危机 | 伏笔铺垫 |
| 神秘...人/影/声音...出现/逼近 | 身份悬念 |
| 似乎...知道/明白...不对/阴谋 | 威胁逼近 |
| 隐约...看到/听到...异样...但/却 | 能力异常 |

#### 语义验证（防误判回收）

以下模式为假阳性，不标记为回收：
- "揭开锅盖/盖子/帘子" — 非隐喻
- "真相不是/并非" — 否定句
- "原来不是/并非/只是" — 否定
- "识破...陷阱...但/却" — 未真正识破

---

## 3. PostgreSQL 数据库映射

### 3.1 Schema概览（10张表）

| 表名 | 用途 | 替代关系 |
|------|------|---------|
| entities | 统一实体表 | 替代 materials实体 + entity_registry + character_state_cache |
| entity_state_history | 实体状态历史 | 替代 character_states + character_state_cache的per-chapter |
| entity_relations | 实体关系图谱 | 替代 character_relations |
| entity_binds | 实体绑定关系 | 替代 character_binds |
| foreshadow_ledger | 伏笔账本 | 新增 |
| knowledge_facts | 记忆金字塔 | 新增 |
| narrative_state | 叙事状态 | 新增 |
| consistency_checks | 一致性校验 | 新增 |
| ~~craft_materials~~ | 创作规范素材 | **已删除（2026-10-19, F8）** |
| timeline | 时间轴事件 | 新增 |

### 3.2 entities 表

```sql
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    entityType TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    briefName TEXT DEFAULT '',
    roleLevel TEXT NOT NULL DEFAULT 'npc',    -- protagonist/supporting/npc
    genreId TEXT DEFAULT '',
    isActive BOOLEAN DEFAULT true,
    isLocked BOOLEAN DEFAULT false,
    firstAppearChapter INTEGER DEFAULT 0,
    lastAppearChapter INTEGER DEFAULT 0,
    appearCount INTEGER DEFAULT 0,
    parentEntityId TEXT DEFAULT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    hp INTEGER DEFAULT 100,
    combatPower INTEGER DEFAULT 0,
    position TEXT DEFAULT '',
    factionName TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    speakingTone TEXT DEFAULT '',
    signatureDetail TEXT DEFAULT '',
    genreState JSONB DEFAULT '{}'::jsonb,     -- 题材特有状态
    profile JSONB DEFAULT '{}'::jsonb,        -- 静态档案
    bindsSummary JSONB DEFAULT '[]'::jsonb,   -- 绑定物缓存
    relationsSummary JSONB DEFAULT '[]'::jsonb, -- 关系缓存
    briefText TEXT DEFAULT '',
    briefTokens INTEGER DEFAULT 0,
    summaryText TEXT DEFAULT '',
    summaryTokens INTEGER DEFAULT 0,
    detailText TEXT DEFAULT '',
    detailTokens INTEGER DEFAULT 0,
    sourceContent TEXT DEFAULT '',
    version INTEGER DEFAULT 1,
    sourceChapter INTEGER DEFAULT NULL,
    archived TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ent_project ON entities(projectId);
CREATE INDEX idx_ent_project_type ON entities(projectId, entityType);
CREATE INDEX idx_ent_project_active ON entities(projectId, isActive);
CREATE INDEX idx_ent_project_name ON entities(projectId, name);
CREATE INDEX idx_ent_project_role ON entities(projectId, roleLevel);
CREATE INDEX idx_ent_parent ON entities(parentEntityId);
CREATE INDEX idx_ent_genre ON entities(projectId, genreId);
CREATE UNIQUE INDEX idx_ent_project_type_name ON entities(projectId, entityType, name) WHERE isActive = true;
CREATE INDEX idx_ent_genre_state ON entities USING gin(genreState);
CREATE INDEX idx_ent_profile ON entities USING gin(profile);
```

### 3.3 entity_state_history 表

```sql
CREATE TABLE IF NOT EXISTS entity_state_history (
    id TEXT PRIMARY KEY,
    entityId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL,
    baseState JSONB DEFAULT '{}'::jsonb,
    genreState JSONB DEFAULT '{}'::jsonb,
    delta JSONB DEFAULT '{}'::jsonb,
    changedFields JSONB DEFAULT '[]'::jsonb,
    bindsSnapshot JSONB DEFAULT '[]'::jsonb,
    relationsSnapshot JSONB DEFAULT '[]'::jsonb,
    briefText TEXT DEFAULT '',
    summaryText TEXT DEFAULT '',
    detailText TEXT DEFAULT '',
    isValid BOOLEAN DEFAULT true,
    computedAt TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_esh_entity_ch ON entity_state_history(entityId, chapterNumber);
CREATE INDEX idx_esh_project_ch ON entity_state_history(projectId, chapterNumber);
```

### 3.4 entity_relations 表

```sql
CREATE TABLE IF NOT EXISTS entity_relations (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    fromEntityId TEXT NOT NULL,
    toEntityId TEXT NOT NULL,
    relType TEXT NOT NULL,
    relLabel TEXT DEFAULT '',
    strength INTEGER DEFAULT 50,
    trustLevel INTEGER DEFAULT 50,
    startChapter INTEGER DEFAULT 0,
    endChapter INTEGER DEFAULT NULL,
    isSecret BOOLEAN DEFAULT false,
    cognitiveOnly BOOLEAN DEFAULT false,
    notes TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_erel_from ON entity_relations(fromEntityId);
CREATE INDEX idx_erel_to ON entity_relations(toEntityId);
CREATE INDEX idx_erel_project ON entity_relations(projectId, relType);
CREATE UNIQUE INDEX idx_erel_unique ON entity_relations(fromEntityId, toEntityId, relType);
```

### 3.5 entity_binds 表

```sql
CREATE TABLE IF NOT EXISTS entity_binds (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    entityId TEXT NOT NULL,
    targetEntityId TEXT NOT NULL,
    bindType TEXT NOT NULL,
    bindStatus TEXT DEFAULT 'active',
    permanence TEXT DEFAULT 'semi-permanent',
    acquiredChapter INTEGER DEFAULT 0,
    lostChapter INTEGER DEFAULT NULL,
    masteryLevel TEXT DEFAULT '',
    masteryProgress INTEGER DEFAULT 0,
    personalNotes TEXT DEFAULT '',
    customName TEXT DEFAULT '',
    slotPosition TEXT DEFAULT '',
    bindOrder INTEGER DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ebind_entity ON entity_binds(entityId, bindType);
CREATE INDEX idx_ebind_project ON entity_binds(projectId, bindType);
CREATE INDEX idx_ebind_target ON entity_binds(targetEntityId);
CREATE INDEX idx_ebind_status ON entity_binds(projectId, bindStatus);
CREATE UNIQUE INDEX idx_ebind_unique ON entity_binds(entityId, targetEntityId, bindType);
```

### 3.6 foreshadow_ledger 表

```sql
CREATE TABLE IF NOT EXISTS foreshadow_ledger (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planted',
    plantChapter INTEGER DEFAULT 0,
    lastAdvanceChapter INTEGER DEFAULT 0,
    resolveChapter INTEGER DEFAULT NULL,
    expectedResolveWindow TEXT DEFAULT '',
    importance TEXT DEFAULT 'normal',
    relatedEntityIds JSONB DEFAULT '[]'::jsonb,
    relatedPlotThreads JSONB DEFAULT '[]'::jsonb,
    advanceLog JSONB DEFAULT '[]'::jsonb,
    resolutionNotes TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_foreshadow_project ON foreshadow_ledger(projectId);
CREATE INDEX idx_foreshadow_status ON foreshadow_ledger(projectId, status);
CREATE INDEX idx_foreshadow_importance ON foreshadow_ledger(projectId, importance);
CREATE INDEX idx_foreshadow_chapter ON foreshadow_ledger(projectId, plantChapter);
```

### 3.7 knowledge_facts 表

```sql
CREATE TABLE IF NOT EXISTS knowledge_facts (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'L2',
    category TEXT NOT NULL DEFAULT 'plot',
    entityId TEXT DEFAULT NULL,
    chapterNumber INTEGER DEFAULT 0,
    factText TEXT NOT NULL DEFAULT '',
    importance INTEGER DEFAULT 50,
    accessCount INTEGER DEFAULT 0,
    lastAccessedChapter INTEGER DEFAULT 0,
    decayScore REAL DEFAULT 1.0,
    expiresAtChapter INTEGER DEFAULT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kfact_project ON knowledge_facts(projectId);
CREATE INDEX idx_kfact_project_level ON knowledge_facts(projectId, level);
CREATE INDEX idx_kfact_project_category ON knowledge_facts(projectId, category);
CREATE INDEX idx_kfact_entity ON knowledge_facts(entityId);
CREATE INDEX idx_kfact_decay ON knowledge_facts(projectId, decayScore);
CREATE INDEX idx_kfact_chapter ON knowledge_facts(projectId, chapterNumber);
```

### 3.8 narrative_state 表

```sql
CREATE TABLE IF NOT EXISTS narrative_state (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL,
    phase TEXT NOT NULL DEFAULT 'setup',
    tension INTEGER DEFAULT 50,
    pacing TEXT DEFAULT 'moderate',
    activePlotThreads JSONB DEFAULT '[]'::jsonb,
    completedPlotThreads JSONB DEFAULT '[]'::jsonb,
    milestone TEXT DEFAULT '',
    emotionalArc JSONB DEFAULT '{}'::jsonb,
    readerExpectation JSONB DEFAULT '{}'::jsonb,
    notes TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_narr_project_ch ON narrative_state(projectId, chapterNumber);
CREATE INDEX idx_narr_project_phase ON narrative_state(projectId, phase);
```

### 3.9 consistency_checks 表

```sql
CREATE TABLE IF NOT EXISTS consistency_checks (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL,
    checkType TEXT NOT NULL DEFAULT 'name',
    severity TEXT NOT NULL DEFAULT 'warning',
    entityId TEXT DEFAULT NULL,
    description TEXT NOT NULL DEFAULT '',
    expectedValue TEXT DEFAULT '',
    actualValue TEXT DEFAULT '',
    isResolved BOOLEAN DEFAULT false,
    resolvedChapter INTEGER DEFAULT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ccheck_project ON consistency_checks(projectId);
CREATE INDEX idx_ccheck_project_ch ON consistency_checks(projectId, chapterNumber);
CREATE INDEX idx_ccheck_severity ON consistency_checks(projectId, severity);
CREATE INDEX idx_ccheck_unresolved ON consistency_checks(projectId, isResolved) WHERE isResolved = false;
```

### 3.10 craft_materials 表（已删除 2026-10-19）

> 该表结构齐备但全仓无运行时写入/读取通道（实测 0 行），已由 migration `v0008_drop-craft-materials` 删除。
> 下列 DDL 仅作历史留存，不代表当前 schema。见 `docs/worklog/2026-10-17-假成果审查-问题统计.md` F8。

```sql
CREATE TABLE IF NOT EXISTS craft_materials (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    craftType TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    content TEXT DEFAULT '',
    archived TEXT DEFAULT '',
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_craft_project ON craft_materials(projectId);
CREATE INDEX idx_craft_project_type ON craft_materials(projectId, craftType);
CREATE INDEX idx_craft_project_name ON craft_materials(projectId, name);
```

### 3.11 timeline 表

```sql
CREATE TABLE IF NOT EXISTS timeline (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL DEFAULT 0,
    eventTime TEXT DEFAULT '',
    eventType TEXT NOT NULL DEFAULT 'event',
    actorIds JSONB DEFAULT '[]'::jsonb,
    locationId TEXT DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    precedingEventIds JSONB DEFAULT '[]'::jsonb,
    duration TEXT DEFAULT '',
    significance TEXT DEFAULT 'normal',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_project ON timeline(projectId);
CREATE INDEX idx_timeline_project_chapter ON timeline(projectId, chapterNumber);
CREATE INDEX idx_timeline_project_time ON timeline(projectId, eventTime);
CREATE INDEX idx_timeline_project_type ON timeline(projectId, eventType);
```

### 3.12 Store层到PG映射关系

| Store Type | PG表 | 说明 |
|-----------|------|------|
| entities | entities | 直接映射 |
| entity-state-history | entity_state_history | 直接映射 |
| entity-relations | entity_relations | 直接映射 |
| foreshadow-ledger | foreshadow_ledger | 直接映射 |
| knowledge-facts | knowledge_facts | 直接映射 |
| narrative-state | narrative_state | 直接映射 |
| consistency-checks | consistency_checks | 直接映射 |
| timeline-events | timeline | type名不同，表名相同 |
| materials | entities(实体类)（原 craft_materials 非实体类分支已废弃/删表 F8） | 按type分流 |
