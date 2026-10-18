# Novel Pipeline 完整交接文档

> 本文档包含系统架构、Agent职责、Pipeline流程、数据规范、说话风味系统、审核覆盖机制、踩坑记录、常见问题修复手册。
> 新AI阅读本文档后即可直接接手开发和运维。

---

## 一、系统架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite 8)               │
│  Dashboard | Pipeline | Materials | Chapters | Agents | ... │
│  Store: React Query + Zustand 双写 | API: Axios | Themes: 7 skins │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (Vite proxy -> :3001/api)
┌──────────────────────────▼──────────────────────────────────┐
│                    Express Server (:3001)                     │
│  Routes: projects|chapters|materials|pipeline|agents|...    │
│  Routes: flavors (方言/风格API)                              │
├──────────────────────────────────────────────────────────────┤
│                    Service Layer                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Pipeline Engine                                        │  │
│  │  intent-planner → writer → review → reviser → editor  │  │
│  │  → material-manager (with circuit-breaker/metrics)     │  │
│  │  审核覆盖: 字数幻觉/方言误判/风格误判/幽默误判          │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ 说话风味系统（双轴）                                    │  │
│  │  方言轴: dialectRegistry ← data/dialects/*.json (21)   │  │
│  │  风格轴: speechStyleRegistry ← data/speech-styles/ (14)│  │
│  │  规则: 有风格时方言降为light，风格是主味方言是底色       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Genre Plugins (5)                                      │  │
│  │  high-martial | urban-fantasy | baby | rule-horror     │  │
│  │  | infinite-dungeon                                    │  │
│  │  -> detectors / interceptors / reviewRules / presets   │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ LLM Layer (9 providers)                                │  │
│  │  aliyunCoding(qwen3.6-plus, 默认) | deepseek           │  │
│  │  | siliconflow | zhipu | moonshot | custom             │  │
│  │  (minimax/lmstudio/openai 已弃用，自动迁移到aliyunCoding) │  │
│  │  resolveStepConfig -> per-agent model assignment       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Context Management                                     │  │
│  │  ContextBudget | PromptAuditor | Memory | HookBudget   │  │
│  │  | RuleStack | BeatAllocator | ChapterIntent           │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Store (三后端架构: PostgreSQL > SQLite > JSON文件)           │
│  data/projects/ | data/materials/ | data/chapters/ | ...    │
│  data/dialects/ | data/speech-styles/                       │
│  pgSchema.js: 11表(PostgreSQL) | database.js: SQLite         │
│  jsonStore.js: JSON文件(默认fallback)                         │
└──────────────────────────────────────────────────────────────┘
```

### 启动命令
```bash
# 后端（默认JSON文件存储）—— 启动前自动清理旧进程
cd novel-pipeline && npm start                # 端口 3001（自动杀旧进程+PID管理）
npm stop                                      # 停止服务器（PID文件+端口清理双保险）
npm restart                                   # 重启服务器
npm run server:status                         # 查看服务器状态（PID/端口/运行状态）

# 后端（使用PostgreSQL）
USE_PG=true DATABASE_URL=postgresql://postgres@localhost:5432/novel_pipeline npm start

# 后端（使用SQLite）
USE_SQLITE=true npm start

# 前端（开发模式）
cd novel-pipeline/client && npm run dev       # 端口 5173，代理到 3001

# 数据迁移（JSON/SQLite → PostgreSQL）
node scripts/migrate-to-pg.js
```

> ⚠️ **服务器进程管理铁律**：修改服务器代码后直接 `npm start` 即可，脚本会自动杀掉占用端口的旧进程。
> 禁止依赖手动 taskkill/StopCommand 杀进程（不可靠）。详见 scripts/killPort.js + scripts/serverStart.js。

---

## 二、Agent 职责表

### 核心流水线 Agent

| Agent类型 | 中文名 | 职责 | 输出 | maxTokens |
|---|---|---|---|---|
| `writer` | 执笔人 | 根据大纲+素材+意图创作正文 | 纯文本正文 | 32768 |
| `first-review` | 初审 | 7维度审核（情节/角色/视角/术语/融入度/节奏/AI腔） | Markdown+JSON | 8192 |
| `second-review` | 复审 | 二次校验，纠正初审误判（含方言/风格误判纠正） | Markdown+JSON | 8192 |
| `final-editor` | 定稿人 | 最高裁定，最终润色定稿 | 纯文本正文 | 32768 |
| `material-manager` | 素材管理员 | 从正文提取/更新素材，解析方言/风格标签 | JSON | 8192 |
| `fast-review` | 快审 | 轻量级快速审核（通过reviewOverride路由替代初审+复审） | Markdown+JSON | 8192 |
| `reviser` | 返修员 | 根据审核反馈精准修改正文 | 修改后完整正文 | 32768 |
| `intent-planner` | 意图规划 | 规划章节意图(goal/mustKeep/mustAvoid) | 结构化JSON | 8192 |

### Agent Prompt 构建链路
```
Foundation Prompt → Agent Template → Style Profile注入 → Constraint Injection
→ Genre Rules注入 → 方言/风格注入 → Deduplicate → Prompt Auditor审计 → Context Budget分配
```

核心文件：
- 新版：`server/services/prompts/` 目录（promptBuilder.js + constraintInjector.js + flavorInjector.js + styleInjector.js + genreInjector.js）
- 旧版（兼容）：`server/services/_agentPromptsLegacy.js`

---

## 三、Pipeline 流程

### 统一长篇模式（novel）

| 模式 | 步骤序列 | 最大轮次 | 最低字数(REJECT) | 目标字数(TARGET) | 上限(MAX) |
|---|---|---|---|---|---|
| `novel`(统一长篇模式) | writer→first-review→second-review→final-editor | 7 | 1800 | 2200-2800 | 3500 |

> 说明：原 shuangwen/tomato-short 模式已移除，所有项目统一使用 novel 长篇模式。字数阈值由 `server/config/wordConfigSchema.js` + `project.wordConfig` 动态管理。

> 注：material-manager 不是pipeline步骤，是审核通过后独立运行的素材提取步骤

### 执行流程
```
1. intent-planner 生成章节意图
2. HookBudget/RuleStack 同步
3. for round = 1..maxRounds:
   a. writer 创作正文（注入方言/风格规则）
   b. first-review 7维度审核（含方言/风格一致性检查）
   c. 未通过 → 检查是否可覆盖（字数幻觉/方言误判/风格误判/幽默误判）
   d. 不可覆盖 → reviser返修 → 回到b
   e. second-review 复审（仅novel模式，含方言/风格误判纠正）
   f. final-editor 定稿
   g. material-manager 提取/更新素材（解析方言/风格标签）
4. 章节状态 → approved
```

### 审核覆盖机制

当审核拒绝章节时，系统会自动检查是否属于以下4种误判，如果是则覆盖为通过：

| 覆盖场景 | 触发条件 | 覆盖理由 |
|---|---|---|
| 字数幻觉 | 系统统计字数≥底线但LLM说不够 | LLM数不准字数，系统说了算 |
| 方言误判 | 审核说方言"不规范" | 方言本身就是非标准普通话，这是设定不是错误 |
| 风格误判 | 审核说说话风格"不当" | 风格是角色辨识度的一部分 |
| 幽默误判 | 审核说幽默"过度" | 幽默密度由题材设定定义，不是固定标准 |

覆盖输出格式包含：覆盖原因 + 原审核意见摘要 + 覆盖判定依据

核心文件：`server/services/pipeline/fullPipeline.js` → `shouldOverrideReviewRejection()`

### 章节状态机
```
outlined → written → first-reviewing → second-reviewing → final-editing → approved → material-updated
                ↓           ↓                ↓
           failed-skipped  timeout-skipped  permanently-skipped
```

### 无限流水线 API
```
POST /api/pipeline/infinite     启动（body: {projectId, maxChapters}）
POST /api/pipeline/infinite/stop   停止
POST /api/pipeline/infinite/reset  重置陈旧状态
GET  /api/pipeline/infinite/status/:projectId  查询状态
```

---

## 四、说话风味系统（双轴架构）

### 设计理念
```
角色说话风味 = 方言轴(你从哪来) × 风格轴(你是谁)

方言轴: dialectRegion + dialectIntensity → data/dialects/*.json → dialectRegistry.js
风格轴: speechStyle + speechStyleIntensity → data/speech-styles/*.json → speechStyleRegistry.js
```

### 核心规则
1. **方言是底色（轻），风格是人格（重）**——有风格的角色方言自动降为light
2. **一个角色最多一种风格**，不要叠加多种风格
3. **每3-5句对话出现1次风味特征即可**，不是每句都要体现
4. **高紧张场景收敛风味强度**，别让风味干扰叙事节奏
5. **叙述者（旁白）不用风味**，只有角色对话用

### 方言库（21个）

| 分区 | 方言 | 核心辨识词 |
|---|---|---|
| 华北 | 北京、天津、山西 | 倍儿/嘛/甚 |
| 东北 | 东北 | 贼/整/嘎哈 |
| 华东 | 上海、苏州、山东、福建 | 侬/倷/俺/诚 |
| 华中 | 河南、湖北、湖南 | 俺/苕/霸蛮 |
| 华南 | 广东、广西、客家 | 咩/捏/涯 |
| 西南 | 四川、重庆、贵州、云南 | 巴适/搞锤子/嘞/板扎 |
| 西北 | 陕西、新疆 | 嫽/亚克西 |
| 海岛 | 台湾 | 嘛/耶/超+形容词 |

### 说话风格库（14个）

| 分类 | 风格ID | 标签 | 核心特色 |
|---|---|---|---|
| 互联网味 | `abstract` | 抽象话 | 格式化D盘=绝育，去见太奶=死了，6/寄/绷 |
| | `passive-aggressive` | 阴阳怪气 | 您可真行，好的呢，确实确实 |
| | `crazy` | 发疯文学 | 啊啊啊啊，我疯了，精神状态遥遥领先 |
| | `nonsense` | 废话文学 | 听君一席话如听一席话 |
| | `humblebrag` | 凡尔赛 | 唉烦死了又有人夸我 |
| | `chinglish` | 中式英语 | good good study，I ben明白 |
| | `pun-master` | 谐音梗 | 偶断丝连，不可思姨 |
| 角色工具 | `euphemism` | 委婉话 | 永久出差=死了，获得自由=被开除了 |
| | `hustler` | 江湖腔 | 条子/场子/风紧扯呼 |
| | `military` | 军令腔 | 收到。目标Alpha确认。 |
| | `chuunibyou` | 中二腔 | 吾之右手封印着禁忌之力 |
| | `literary` | 文青腔 | 也许这就是命运的安排 |
| | `bureaucratese` | 官腔 | 高度重视积极推进 |
| | `translationese` | 翻译腔 | 哦我的上帝啊老伙计 |

### 数据流
```
1. 前端选择器 → materialsApi.update(id, { dialectRegion, dialectIntensity, speechStyle, speechStyleIntensity })
2. 素材JSON存储 → 角色素材字段
3. Pipeline运行 → _agentPromptsLegacy.js 读取角色素材
4. speechStyleRegistry.buildCombinedPromptBlock(角色列表) → 注入Writer/Reviewer Prompt
5. AI按方言+风格规则创作对话
```

### 风味API
```
GET  /api/flavors/dialects                              列出所有方言
GET  /api/flavors/dialects/:region                      方言详情
GET  /api/flavors/dialects/:region/preview              方言预览（?intensity=medium&charName=贺千）
GET  /api/flavors/speech-styles                         列出所有风格
GET  /api/flavors/speech-styles/:id                     风格详情
GET  /api/flavors/speech-styles/:id/preview             风格预览
POST /api/flavors/preview-combined                      方言×风格组合预览
POST /api/flavors/reload                                热重载方言/风格数据
```

### 新增方言/风格
1. 在 `data/dialects/` 或 `data/speech-styles/` 创建JSON文件
2. 遵循已有文件的格式（region/id/label/description/features/intensity/examples）
3. **不需要改任何代码**，dialectRegistry/speechStyleRegistry自动扫描加载
4. 如需立即生效，调用 `POST /api/flavors/reload`

---

## 五、数据规范

### 素材类型（33种）

| 分类 | 类型 |
|---|---|
| 世界观 | worldview, scene, phenomenon, institution, organization, faction, geography, technology, power-system |
| 角色 | character, character-psychology, character-combat, character-personality, character-relationship, character-dialogue, character-behavior |
| 逻辑 | foreshadowing, writing-technique, logic |
| 特殊 | sub-plane, equipment, relationship, mechanism, material, index, catchphrase, famous-scene, growth-history, location, narrative-bridge, other, craft |

### 新增类型必须四处同步
1. `server/config/materialTypes.js` → `VALID_MATERIAL_TYPES` + `MATERIAL_TYPE_LABELS` + `MATERIAL_TYPE_COLORS` + `DOMAIN_CATEGORIES`
2. `client/src/pages/MaterialsPage.jsx` → `MATERIAL_TYPE_LABELS` + `MATERIAL_TYPE_COLORS` + `DOMAIN_CATEGORIES`
3. `server/services/materialValidator.js` → `VALID_MATERIAL_TYPES` + `HIERARCHY_RULES`
4. `server/config/materialTypes.js` → 导出模块

### 角色位面归属（双字段设计）

| 字段 | 含义 | 主角示例 | NPC示例 |
|---|---|---|---|
| `parentPlane` | 归属位面（你属于哪） | null（主世界） | 次位面ID |
| `currentPlaneId` | 当前位面（你现在在哪） | 次位面ID（穿越时） | null |

- 主角：parentPlane=null（永远属于主世界），currentPlaneId随穿越切换
- NPC：parentPlane=所属位面，currentPlaneId通常为空
- 主角名从 `project.styleProfile.protagonistName` 动态读取，不硬编码

### 层级归属结构
```
主世界 → 势力(faction, parentPlane=null) → 人物(character, parentFaction=势力ID)
次位面(sub-plane) → 势力(faction, parentPlane=次位面ID) → 人物(character, parentFaction=势力ID, parentPlane=次位面ID)
```

### 角色素材扩展字段
```javascript
{
    // 基础字段
    type: 'character',
    name: '贺千',
    parentPlane: null,          // 归属位面
    parentFaction: 'xxx',       // 所属势力
    currentPlaneId: null,       // 当前位面

    // 说话风味字段
    dialectRegion: '河南',      // 方言区域
    dialectIntensity: 'medium', // 方言强度: light/medium/heavy
    speechStyle: null,          // 说话风格ID
    speechStyleIntensity: null  // 风格强度: light/medium/heavy
}
```

### 前端三分区
```
DOMAIN_CATEGORIES = {
    world: [worldview, power-system, faction, character, institution, location, equipment],
    subplane: [sub-plane],
    craft: [writing-technique, mechanism, index, narrative-bridge, catchphrase, famous-scene, foreshadowing, growth-history, relationship, other]
}
```

### 基底素材保护
`store.isFoundationMaterial(mat)` 动态推断规则：
- mechanism/writing-technique/index + 无parentPlane → 基底
- worldview/power-system + 无parentPlane → 基底
- faction/institution + parentPlane===null → 基底
- character + 属于基底势力 → 基底
- 有sourceChapter → 非基底
- `isFoundation: true/false` 显式标记优先级最高

保护点：store.deleteItem + API DELETE + pipeline清空 + 项目清空 + infinitePipeline stop清理

---

## 六、题材插件

### 已注册插件（5个）

| 插件ID | 中文名 | 文件 |
|---|---|---|
| high-martial-crossplane | 主位面高武·反套路喜剧 | genres/high-martial-crossplane.js |
| urban-fantasy | 都市玄幻 | genres/urban-fantasy.js |
| baby | 萌娃题材 | genres/baby.js |
| rule-horror | 规则怪谈 | genres/rule-horror.js |
| infinite-dungeon | 无限流副本博弈 | genres/infinite-dungeon.js |

### 插件标准接口
```javascript
module.exports = {
    id, label, patterns: [],
    isMatch(styleProfile),
    perspectiveSchema: {},
    foundation: { additionalConstraints, additionalFoundationRules, systemMechanismDimming },
    styleProfile: { key, label, povRule, dialogueRule, behaviorRule, toneRule, titleRule, reviewFocus, materialFocus, constraintOverrides, characterRefRules },
    genreBase: { BEHAVIOR_APPEND, TONE_APPEND, REVIEW_APPEND },
    qualityChecks: {},
    writerHints: {},
    constraintPresets: {},
    reviewRules: { firstReview, secondReview, reviser, finalEditor },
    detectors: { perspective, terminology, modernSlang, onomatopoeia, visualAnchors, motherChildDialogue },
    interceptors: { firstReview, secondReview },
    materialTemplates: {},
    newContentValidation: { onMaterialCreate, onChapterContent },
    dialectConfig: { defaultIntensity, highTensionOverride, reviewCheck, rules }
};
```

### 当前项目（位面掠夺）关键设定
- 次位面分类：规则怪谈类、抽象概念类、文明类、动漫类
- 逐步解封：平均30章推进解锁一个位面
- 能力=系统任务触发掠夺，每位面仅一次
- 道具=探索/交易/任务奖励，不是掠夺
- 弱化=主世界修为天花板自然压制，对同境者效果完整，每高一个大境界效果减半
- 积分用途：境界提升/功法升级/商城购买/已历位面道具购买
- 系统反套路化呈现：积分结算→命牌刻痕错位感，技能升级→功法残卷融汇，装备购置→兵刃温养至器鸣

---

## 七、LLM 配置

核心文件：`server/config/providerRegistry.js`、`server/services/llmConfig.js`

### 9个LLM提供商（aliyunCoding为默认，其余已弃用）

> 说明：minimax/lmstudio/openai 已弃用，详见 `server/config/providerRegistry.js` 的 `DEPRECATED_PROVIDERS`，自动迁移到 aliyunCoding。

| Provider ID | 名称 | 默认模型 | API Key环境变量 | 状态 |
|---|---|---|---|---|
| `aliyunCoding` | 阿里云百炼(Coding Plan) | qwen3.6-plus | ALIYUN_CODING_API_KEY | ✅ 默认 |
| `deepseek` | DeepSeek | deepseek-chat | DEEPSEEK_API_KEY | 可用 |
| `siliconflow` | 硅基流动 | deepseek-ai/DeepSeek-V3 | SILICONFLOW_API_KEY | 可用 |
| `zhipu` | 智谱AI | glm-4-plus | ZHIPU_API_KEY | 可用 |
| `moonshot` | 月之暗面 | moonshot-v1-128k | MOONSHOT_API_KEY | 可用 |
| `custom` | 自定义 | - | - | 可用 |
| `minimax` | MiniMax | MiniMax-M2.7 | MINIMAX_API_KEY | ❌ 已弃用 |
| `openai` | OpenAI | gpt-4o | OPENAI_API_KEY | ❌ 已弃用 |
| `lmstudio` | LM Studio (本地) | default | LMSTUDIO_API_KEY | ❌ 已弃用 |

### 默认分配
所有agent默认使用 aliyunCoding (qwen3.6-plus)，详见 `DEFAULT_STEP_ASSIGNMENTS`

### 配置解析优先级
1. 项目级 per-step 配置 → `project.agentModelConfig[step].keyId`
2. 项目级 per-step 直接配置 → `project.agentModelConfig[step]`
3. 全局 Step 分配 → `DEFAULT_STEP_ASSIGNMENTS`
4. 全局默认 → `LLM_PROVIDER` 环境变量

### 切换模型
```bash
# 方法1：环境变量
LLM_PROVIDER=aliyunCoding

# 方法2：项目级配置（前端Settings页面）
project.agentModelConfig = { writer: { provider: 'aliyunCoding', model: 'qwen3.6-plus' } }
```

---

## 八、Store 数据结构

### 三后端架构（自动降级）

```
┌─────────────────────────────────────────────┐
│              store.js (统一入口)               │
│  listItems/getItem/setItem/deleteItem/...    │
└──────────────────┬──────────────────────────┘
                   │ 环境变量决定使用哪个后端
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────┐  ┌─────▼──────┐  ┌───▼──────┐
│PostgreSQL│  │   SQLite   │  │ JSON文件  │
│(优先)   │  │  (备选)     │  │(默认fallback│
│USE_PG   │  │USE_SQLITE  │  │           │
│ = true  │  │  = true    │  │           │
└────────┘  └────────────┘  └───────────┘
```

### 1. PostgreSQL后端（USE_PG=true）

核心文件：`server/db/pgPool.js` + `server/db/database-pg.js` + `server/db/pgSchema.js`

连接字符串：`DATABASE_URL` 环境变量，默认 `postgresql://postgres@localhost:5432/novel_pipeline`

连接池配置：max: 10, idleTimeout: 30s, connectionTimeout: 5s

#### 11张表结构

| 表名 | 主键 | 核心字段 | 用途 |
|---|---|---|---|
| `materials` | id TEXT | projectId, type, name, parentPlane, parentFaction, dialectRegion, speechStyle, archived, isLocked, version, data | 素材数据 |
| `chapters` | id TEXT | projectId, chapterNumber, status, title, wordCount, round, data | 章节数据 |
| `projects` | id TEXT | mode, targetChapterCount, targetWordCount, data | 项目数据 |
| `kv_store` | type+id | data | 通用键值存储 |
| `api_keys` | id TEXT | apiKey, groupId, model, provider, baseURL, name, _encrypted, data | API密钥 |
| `agent_bindings` | id TEXT | agentType, keyId, data | Agent绑定 |
| `reviews` | id TEXT | chapterId, projectId, reviewType, passed, data | 审核数据 |
| `pipeline_logs` | id TEXT | projectId, chapterId, step, status, round, data | Pipeline日志 |
| `infinite_pipeline_state` | id TEXT | projectId(UNIQUE), running, phase, data | 无限Pipeline状态 |
| `quests` | id TEXT | projectId, parentId, status, priority, data | 任务数据 |
| `timelines` | id TEXT | projectId, eventType, importance, isKeyEvent, data | 时间线数据 |

#### 关键索引
- materials: projectId / type+archived / parentPlane+parentFaction / dialectRegion / speechStyle / isLocked / version
- chapters: projectId+chapterNumber / status / wordCount
- reviews: chapterId / projectId / reviewType
- pipeline_logs: projectId / chapterId
- infinite_pipeline_state: projectId
- quests: projectId / parentId / status
- timelines: projectId / eventType

### 2. SQLite后端（USE_SQLITE=true）

核心文件：`server/db/database.js` + `server/db/store.js`
数据库路径：`data/novel-pipeline.db`
降级条件：数据库为空时自动降级到JSON文件

### 3. JSON文件后端（默认fallback）

核心文件：`server/db/jsonStore.js`
存储方案：JSON文件持久化，每条记录一个文件

| 类型 | 目录 | 大小限制 |
|---|---|---|
| projects | data/projects/ | 500KB |
| materials | data/materials/ | 50KB |
| chapters | data/chapters/ | 200KB |
| reviews | data/reviews/ | 30KB |
| pipeline-logs | data/pipeline-logs/ | 100KB |
| infinite-pipeline-state | data/infinite-pipeline-state/ | 50KB |
| dialects | data/dialects/ | - |
| speech-styles | data/speech-styles/ | - |

### 关键API（统一接口，不依赖后端类型）
```javascript
store.listItems(type)              // 列出所有
store.getItem(type, id)            // 获取单条
store.setItem(type, id, data)      // 写入（含写锁、大小限制、验证）
store.deleteItem(type, id)         // 删除（素材受isFoundationMaterial保护）
store.queryItems(type, filter)     // 条件查询
store.isFoundationMaterial(mat)    // 判断是否基底素材（动态推断，不是简单字段检查）
```

---

## 九、审核系统详解

### 初审7维度
1. **情节连贯性**：与前文是否衔接，有无逻辑断裂
2. **角色一致性**：角色言行是否符合素材设定，方言/说话风格是否正确
3. **视角统一性**：是否维持统一叙事视角，有无视角跳跃
4. **术语准确性**：专有名词/设定术语是否与素材库一致
5. **叙事融入度**：系统交互是否用叙事融入式（感官/身体/物品变化），而非方括号标签
6. **节奏与张力**：场景节奏是否合理，有无拖沓或跳跃
7. **AI腔检测**：是否高频出现"仿佛/不禁/似乎/缓缓/微微/竟然"等AI腔词汇

### 审核红线（6条）
1. 方括号标签格式 = 绝对红线违规，必须打回
2. 叙事融入式系统交互 = 合规，不得以此为由打回
3. 幽默密度由项目设定定义，禁止以固定百分比判定
4. 方言/说话风格是角色设定，不得以"不规范"打回
5. 字数判定以系统统计为准，LLM不得自行估算字数
6. 喜剧/幽默是否达标看自然笑点，而非机械计数

### 复审职责
1. 校验初审判定是否正确——初审可能误判
2. 补充初审遗漏的关键问题
3. 纠正初审的过度审核

### 审核输出格式
初审Markdown报告必须包含：
- 📊 总评（通过/不通过 + 一句话理由）
- ✅ 亮点（列出2-3个写得好的地方）
- ❌ 问题（列出必须修改的问题，标注严重程度[critical/major/minor]）
- 💡 建议（列出改进建议，区分必须修改和可选优化）
- 🗣 方言/风格检查（角色对话是否符合方言/风格设定）

---

## 十、踩坑记录

### 🔴 P0 - 系统级崩溃

**坑6：store.js文件大小限制导致JSON损坏**
- 问题：项目文件超过大小限制被截断，JSON损坏
- 修复：添加MAX_ITEM_SIZE + 写前裁剪 + 写后验证
- 文件：server/store.js

**坑3：题材混合污染**
- 问题：不同题材的素材/审核规则互相污染
- 修复：创建题材依赖关系网 + 项目级素材隔离
- 文件：server/services/genreConfig.js

**坑7：审核规则硬编码萌娃题材**
- 问题：审核逻辑中硬编码了"幼崽视角""拟声词"等萌娃规则
- 修复：重构为genreConfig.js动态加载题材审核规则
- 文件：server/services/genres/*.js, server/services/_agentPromptsLegacy.js

**坑15：infinitePipeline stop清理用m.isFoundation字段而非动态推断**
- 问题：stop清理素材时用`m.isFoundation`字段检查，但基底素材保护是动态推断的
- 修复：改为`store.isFoundationMaterial(m)`
- 文件：server/services/pipeline/infinitePipeline.js

### 🟠 P1 - 功能级缺陷

**坑8：能力弱化用残废化描述**
- 问题：AI生成"仅限手指关节""3秒""残渣"等残废化弱化描述
- 修复：弱化通过主世界修为天花板自然压制 + timeLimitWeakening检测器
- ⚠️ **大纲中的能力描述是根因！如果大纲写了残废化描述，审核每次都会打回来**

**坑13：新素材无归属约束**
- 问题：agent创建新素材时不带parentPlane/parentFaction
- 修复：5层纵深防护（Validator→API→AgentPrompt→MCP→Pipeline）

**坑10：IP角色直呼其名**
- 问题：素材中直接使用"孙悟空""路飞"等IP角色名
- 修复：改为外貌特征+性格代号，道具名泛指化
- ⚠️ **次位面JSON数据文件中也可能有IP直呼，需定期扫描**

**坑12：素材层级扁平化**
- 问题：次位面/势力/人物全混在一起
- 修复：parentPlane/parentFaction关联 + 前端树形二级菜单

**坑14：创作规范类素材不可见**
- 问题：写作手法、伏笔等约束类素材混在主世界others里
- 修复：DOMAIN_CATEGORIES三分法 + "创作规范"顶级分区

**坑11：数据硬编码在脚本中**
- 问题：12个位面的完整素材数据硬编码在fix脚本中
- 修复：data/subplanes/目录，每个位面一个JSON，通用加载器

**坑4：章节审核字数死锁**
- 问题：reviser输出在REJECT_MIN和TARGET_MIN之间，反复审核失败
- 修复：增加MAX_ROUNDS + 修订器输出在阈值间时保留原文

**坑9：道具与掠夺混淆**
- 问题：系统把道具获取也当作掠夺处理
- 修复：能力=系统任务触发掠夺；道具=探索/交易/任务奖励

**坑16：volumeHelpers可见性遗漏institution类型**
- 问题：可见性逻辑只覆盖character和faction，遗漏institution
- 修复：加入institution到可见性检查
- 文件：server/services/pipeline/volumeHelpers.js

**坑17：素材去重创建5个贺千**
- 问题：material-manager每章都创建新的同名素材而不是更新
- 修复：当LLM输出action:"create"但已有同名同类型素材时，强制改为update
- 文件：server/services/pipeline/steps/materialManager.js

**坑18：主角名硬编码为"沈渡"**
- 问题：materialManager中硬编码主角名，换项目后不认新主角
- 修复：从`project.styleProfile.protagonistName`动态读取
- 文件：server/services/pipeline/steps/materialManager.js

**坑19：下载全本TXT返回401**
- 问题：`<a href>`直接链接不带Authorization header
- 修复：改为fetch带`import.meta.env.VITE_REQUEST_SECRET` token下载
- 文件：client/src/pages/ChaptersPage.jsx

**坑20：方言/风格标签正则匹配边界问题**
- 问题：正则用`\S+`匹配region，含空格的region名匹配失败
- 修复：改为`[^|｜\]]+?` + `.trim()`
- 文件：server/services/pipeline/steps/materialManager.js

**坑21：服务器旧进程杀不掉导致新代码不生效（反复犯5次以上）**
- 问题：修改服务器代码后，旧进程未被杀掉，新代码不生效，测试持续报旧错误
- 根因：依赖手动 taskkill/StopCommand 杀进程，两者都不可靠（taskkill超时、StopCommand杀不掉子进程）
- 修复：创建 scripts/killPort.js（netstat查找PID + taskkill/process.kill双方案 + 轮询等待）+ scripts/serverStart.js（启动前自动清理端口 + PID文件管理 + stop/restart/status命令）
- 验证：连续两次 `npm start`，PID自动从55164切换到50156，旧进程被自动杀掉
- 文件：scripts/killPort.js, scripts/serverStart.js, package.json
- ⚠️ **铁律21**：禁止再依赖手动杀进程，直接 `npm start` 即可

### 🟡 P2 - 配置级问题

**坑5：项目API不保存styleProfile**
- 修复：添加styleProfile到允许更新的字段列表

**坑2：LLM配置分散**
- 修复：创建llmConfig.js集中管理

**坑1：角色名跨项目复用**
- 修复：store查询强制加projectId过滤

---

## 十一、常见问题修复手册

### Q1: 章节审核反复失败怎么办？
1. 查看审核输出：`store.listItems('chapters').find(c => c.chapterNumber === N).firstReviewOutput`
2. 常见原因：
   - **大纲中能力描述残废化** → 修改大纲，改为"功能完整，受修为压制"
   - **AI腔高频词** → 审核会自动检测"仿佛/不禁/似乎"
   - **字数不足** → 检查wordConfig配置
   - **方言被误判** → 系统会自动覆盖方言误判
3. 重置章节：设置status=outlined, _reviewRounds=0, 删除content和reviewOutput

### Q2: 如何添加新次位面？
1. 在 `data/subplanes/` 创建新JSON文件（参考现有文件格式）
2. 运行 `node scripts/load-subplanes.js <projectId> load`
3. 验证 `node scripts/load-subplanes.js <projectId> validate`
4. **不需要改任何代码**

### Q3: 如何添加新方言/说话风格？
1. 在 `data/dialects/` 或 `data/speech-styles/` 创建JSON文件
2. 遵循已有文件格式（region/id/label/description/features/intensity/examples）
3. **不需要改任何代码**，自动加载
4. 如需立即生效：`POST /api/flavors/reload`

### Q4: 如何扫描IP直呼违规？
```javascript
const store = require('./server/store');
const ipNames = ['灰太狼','喜羊羊','哆啦A梦','路飞','孙悟空','七龙珠','海贼王','奥特曼','恶魔果实','仙豆','竹蜻蜓','念能力'];
store.listItems('materials').forEach(m => {
    const text = (m.currentContent||'') + (m.name||'');
    ipNames.forEach(ip => { if(text.includes(ip)) console.log(m.type, m.name, ip); });
});
```

### Q5: 如何重置所有章节重新跑？
```javascript
const store = require('./server/store');
const pid = '<projectId>';
store.listItems('chapters').filter(c => c.projectId === pid).forEach(ch => {
    ch.status = 'outlined';
    ch._reviewRounds = 0;
    ch._wordCountRetry = 0;
    delete ch._skipReason;
    delete ch.content;
    delete ch.firstReviewOutput;
    delete ch.secondReviewOutput;
    store.setItem('chapters', ch.id, ch);
});
```

### Q6: Pipeline启动后章节一直冷却重试？
- 检查大纲中是否有残废化能力描述（"仅能""3秒""残渣"）
- 检查审核日志中的具体失败原因
- 如果重试计数没清零，手动重置章节状态

### Q7: 如何确认基底素材没被误删？
```javascript
const store = require('./server/store');
const mats = store.listItems('materials');
const foundation = mats.filter(m => store.isFoundationMaterial(m));
console.log('Foundation count:', foundation.length);
foundation.forEach(m => console.log(m.type, m.name));
```

### Q8: Pipeline陈旧状态（running:true但进程已死）怎么办？
```
1. POST /api/pipeline/infinite/stop   停止
2. POST /api/pipeline/infinite/reset  重置陈旧状态
3. 重新启动Pipeline
```

### Q9: 如何给角色设置方言和说话风格？
1. 前端素材编辑页 → 选择角色 → 编辑
2. 🎭 说话风味区域 → 方言下拉 + 风格下拉 + 强度选择
3. 点击"👁 预览效果"查看对话示例
4. 保存即可，Pipeline会自动注入方言/风格规则

---

## 十二、关键文件索引

### 后端核心
| 文件 | 功能 |
|---|---|
| server/index.js | Express入口，路由挂载 |
| server/store.js | 统一入口，三后端自动降级（PG > SQLite > JSON） |
| server/db/pgPool.js | PostgreSQL连接池管理 |
| server/db/database-pg.js | PostgreSQL后端实现 |
| server/db/pgSchema.js | PostgreSQL建表SQL（11张表） |
| server/db/store-pg.js | PostgreSQL存储层 |
| server/db/database.js | SQLite后端实现 |
| server/db/store.js | SQLite存储层 |
| server/db/jsonStore.js | JSON文件存储层（默认fallback） |
| server/core/pipeline/orchestrator.js | Pipeline编排器（新架构） |
| server/services/pipeline/fullPipeline.js | Pipeline主引擎（旧架构） |
| server/config/providerRegistry.js | LLM提供商注册中心（9个） |
| server/config/materialTypes.js | 素材类型配置（33种） |
| server/services/contentUtils.js | 内容工具+模式配置 |
| server/services/pipelineConfig.js | Pipeline模式配置（轮次/字数） |
| server/services/genreConfig.js | 题材插件注册中心 |
| server/services/llmConfig.js | LLM配置中心（代理到providerRegistry） |
| server/services/dialectRegistry.js | 方言注册服务（加载/查询/Prompt构建） |
| server/services/speechStyleRegistry.js | 说话风格注册服务（含组合Prompt构建） |
| server/services/materialValidator.js | 素材验证+层级校验 |
| server/services/materialIndex.js | 素材索引管理 |
| server/services/promptAuditor.js | 提示词审计 |
| server/services/contextBudget.js | 上下文预算 |
| server/services/reviewCircuitBreaker.js | 审核熔断器 |
| server/services/reviewOverride.js | 审核覆盖逻辑（独立模块） |
| server/routes/flavors.js | 方言/风格API路由 |

### Pipeline引擎
| 文件 | 功能 |
|---|---|
| server/core/pipeline/orchestrator.js | Pipeline编排器（新架构核心） |
| server/services/pipeline/fullPipeline.js | 主Pipeline引擎（旧架构） |
| server/services/pipeline/infinitePipeline.js | 无限Pipeline引擎 |
| server/services/pipeline/volumeHelpers.js | 卷/位面可见性管理 |
| server/services/pipeline/reviewOverride.js | 审核覆盖逻辑（独立模块） |
| server/services/pipeline/constants.js | Pipeline常量 |
| server/services/pipeline/steps/writer.js | Writer步骤 |
| server/services/pipeline/steps/review.js | 审核步骤 |
| server/services/pipeline/steps/reviser.js | 返修步骤 |
| server/services/pipeline/steps/finalEditor.js | 定稿步骤 |
| server/services/pipeline/steps/fastReview.js | 快审步骤 |
| server/services/pipeline/steps/materialManager.js | 素材管理器（含方言/风格标签解析） |
| server/services/pipeline/steps/firstReview.js | 初审步骤 |
| server/services/pipeline/steps/secondReview.js | 复审步骤 |

### 题材插件
| 文件 | 题材 |
|---|---|
| server/services/genres/high-martial-crossplane.js | 主位面高武·反套路喜剧 |
| server/services/genres/baby.js | 萌娃 |
| server/services/genres/rule-horror.js | 规则怪谈 |
| server/services/genres/infinite-dungeon.js | 无限流副本 |
| server/services/genres/urban-fantasy.js | 都市玄幻 |

### 数据文件
| 目录/文件 | 功能 |
|---|---|
| data/dialects/*.json (21个) | 方言数据（每个方言一个文件） |
| data/speech-styles/*.json (14个) | 说话风格数据（每个风格一个文件） |
| data/subplanes/*.json | 次位面数据（当前1个文件：volume-order-witty-strategy.json） |
| data/projects/*.json | 项目数据（含意图/风格配置/章节大纲） |
| data/materials/*.json | 素材数据（角色/势力/世界观/伏笔等） |
| data/chapters/*.json | 章节数据（含正文/审核输出/素材更新记录） |
| data/reviews/*.json | 审核报告数据 |
| data/timelines/*.json | 时间线数据 |
| data/infinite-pipeline-state/*.json | 无限Pipeline状态数据 |
| data/material-index/ | 素材索引（discoveries/lifecycle/planes/types） |
| data/memory-layers/ | 记忆分层（active/archive/compressed/core/recent） |
| data/character-archetypes/*.json (30个) | 角色原型数据 |
| data/naming-styles/*.json (12个) | 命名风格数据 |
| data/genre-profiles/*.json (10个) | 题材配置数据 |
| data/worldview-templates/*.json (5个) | 世界观模板数据 |
| data/humor-devices/*.json (2个) | 幽默手法数据 |
| data/meme-lexicon/*.json (3个) | 网络用语词典 |
| data/circuit-breakers/*.json | 审核熔断器状态 |
| data/map-nodes/*.json | 地图节点数据 |
| data/quests/*.json | 任务数据 |
| data/version-snapshots/*.json | 版本快照 |
| scripts/load-subplanes.js | 通用加载器 |

### 前端核心
| 文件 | 功能 |
|---|---|
| client/src/pages/MaterialsPage.jsx | 素材库（三分区+树形结构+方言/风格选择器+预览） |
| client/src/pages/PipelinePage.jsx | Pipeline控制台 |
| client/src/pages/ChaptersPage.jsx | 章节管理（含下载功能） |
| client/src/store/useAppStore.js | Zustand全局状态 |
| client/src/services/api.js | API服务（含flavorsApi） |

### MCP Agent
| 目录 | Agent |
|---|---|
| mcp-agents/writer/ | 执笔人 |
| mcp-agents/first-review/ | 初审 |
| mcp-agents/second-review/ | 复审 |
| mcp-agents/final-editor/ | 定稿人 |
| mcp-agents/material-manager/ | 素材管理员 |

---

## 十三、铁律（每次必须遵守）

1. **数据与代码分离** - 数据放JSON，代码读JSON，禁止硬编码
2. **层级归属必须显式** - parentPlane/parentFaction必须填写
3. **新增类型四处同步** - materialTypes.js + MaterialsPage.jsx + materialValidator.js + 导出模块
4. **法律风险规避** - IP角色禁止直呼其名
5. **道具≠掠夺** - 能力=系统任务掠夺，道具=探索/交易
6. **弱化通过修为压制** - 严禁残废化/时间限制描述
7. **基底素材不可删除** - isFoundationMaterial动态推断保护（不是简单字段检查）
8. **动态加载不硬编码** - 所有规则从数据/配置读取，不写死在代码里
9. **方言是底色风格是人格** - 有风格时方言降为light，禁止双重度叠加
10. **主角名动态读取** - 从styleProfile.protagonistName读取，不硬编码
11. **改完必须验证** - 修改代码后必须运行 `npm run check` 和 `npm test`，不过不许说"改完了"
12. **禁止空catch** - `catch(_){}` 必须至少有 `console.warn`，不允许吞掉错误
13. **禁止重复代码超3次** - 同一段逻辑出现3次以上必须提取为函数
14. **存储层写操作必须加锁** - jsonStore已有acquireLock/releaseLock，新增写操作必须使用
15. **SQL必须参数化** - 禁止字符串拼接SQL，必须使用 `?` 占位符（自动转换为PostgreSQL `$N`）
16. **认证 token 自动刷新机制** - 401/403 时自动清除旧 token 并重新获取，禁止依赖手动刷新页面
17. **async 函数必须 await** - 调用 async 函数时必须有 await，否则返回 Promise 而非结果值，导致 `.filter()/.map()` 等数组方法报错
18. **数组操作必须防御性检查** - 对可能非数组的值调用 `.filter()/.map()/.find()` 前，必须用 `Array.isArray()` 检查
19. **所有问题根源解决** - 发现的任何问题必须从机制层面彻底修复，不能头痛医头脚痛医脚，不能依赖手动操作
20. **服务器重启 token 自动续期** - 服务器重启后旧 token 失效，客户端必须能自动获取新 token，不能出现 403 错误
21. **服务器进程管理自动化** - 修改服务器代码后直接 `npm start`，脚本自动清理旧进程（killPort.js + serverStart.js）。禁止依赖手动 taskkill/StopCommand 杀进程（已验证不可靠：taskkill超时、StopCommand杀不掉）。杀进程方案优先级：taskkill /F /T → process.kill(pid, 'SIGKILL') → 轮询等待端口释放

---

## 十四、自检体系（AI跨会话质量保障）

> **核心问题**：AI没有跨会话记忆，每次说"改完了"但新窗口无法验证。
> **解法**：不依赖AI的"保证"，依赖系统的"护栏"。

### 3层防护机制

| 层级 | 命令 | 作用 | 何时运行 |
|---|---|---|---|
| 第1层：自检脚本 | `npm run check` | 静态扫描10大类问题 | 每次改完代码后**必须**运行 |
| 第2层：测试用例 | `npm test` | 运行回归测试，防止改坏 | 每次改完代码后**必须**运行 |
| 第3层：启动自检 | server启动时自动运行 | 运行时校验配置/数据完整性 | 每次启动server自动运行 |

### 自检脚本覆盖项（scripts/health-check.js）

1. 存储层安全（写锁/ID验证/原子写入/写后验证）
2. API输入验证（核心路由是否有validator）
3. 安全配置（ENCRYPTION_SECRET/REQUEST_SECRET/CORS/请求体限制）
4. 认证中间件（timing-safe比较/公开路径白名单）
5. 代码质量（空catch数量/重复代码/文件行数）
6. 基底素材保护（isFoundationMaterial在存储层和路由层）
7. 数据目录完整性（必需目录/方言文件/风格文件）
8. 测试覆盖（测试文件数量/test命令存在性）
9. 类型同步（三处同步铁律）
10. IP直呼检查（次位面数据文件扫描）
11. 主角名硬编码检查

### 回归测试覆盖项（tests/unit/regression.test.js）

- 审核覆盖逻辑（字数幻觉/方言误判/风格误判/幽默误判/不覆盖场景）
- 基底素材保护（各类型判定规则/显式标记优先/null处理）
- 素材类型四处同步（33类型/无重复/关键类型存在）
- 素材层级校验（character/faction必填字段）
- 素材验证（无效类型拒绝/类型推断建议）

### AI操作规范

**任何AI在修改本系统代码时，必须遵守以下流程：**

1. **改前**：先运行 `npm run check` 了解当前状态
2. **改中**：修改代码，遵循铁律1-15
3. **改后**：运行 `npm run check` + `npm test`，两项都通过才能说"改完了"
4. **如果测试不过**：继续修，直到通过。不允许跳过测试说"改完了"
5. **如果新增功能**：必须同时添加对应的测试用例

### 已知P0问题清单（必须修复）

| # | 问题 | 位置 | 状态 |
|---|---|---|---|
| P0-1 | API输入验证缺失 | server/routes/*.js | ✅已修(4个核心路由接入validators) |
| P0-2 | materialManager代码膨胀(1037行) | server/services/pipeline/steps/materialManager.js | ✅已修(拆分为146行主文件+20个子模块，全部≤200行) |
| P0-3 | intensityMap重复6次 | materialManager.js | ✅已修(提取parseFlavorTag+INTENSITY_MAP) |
| P0-4 | 审核覆盖正则脆弱 | fullPipeline.js shouldOverrideReviewRejection | ✅已修(提取为reviewOverride.js独立模块) |
| P0-5 | InfinitePipeline内存泄漏风险 | infinitePipeline.js INFINITE_PIPELINE_STATE | ✅已修(日志限制200+启动前清理+延迟10s+心跳warn) |
| P0-6 | 前端PipelinePage轮询泄漏风险 | client/src/pages/PipelinePage.jsx | ✅已修(buttonPollRefs+卸载cleanup) |
| P0-7 | 前端状态管理缺数据层 | client/src/store/useAppStore.js | ✅已修(React Query+Axios双写模式,116个Hooks) |
| P0-8 | 错误处理不一致(空catch) | 全系统 | ✅已修(119处空catch→console.warn) |
| P0-9 | API响应格式不统一 | server/routes/*.js | ✅已修(创建responseFormatter.js) |
| P0-10 | 缺少速率限制 | server/index.js | ✅已修(全局200/min+Pipeline10/min) |
| P0-11 | PostgreSQL隐藏Bug(15个) | server/db/ 全文件 | ✅已修(两轮审查修复15个Bug，详见下方) |

**修复P0问题时，必须同时更新此表的状态列。**

**修复P0-11后更新**：✅ P0-11 PostgreSQL 15个Bug已全部修复（2026-05-24），两轮审查覆盖7个文件，修复包括：healthCheck逻辑错误/quests+timelines处理函数缺失/_txDepth并发安全/initPgPool并发保护/safeParse计数器重置/projects字段遗漏/删除操作缺表/内存泄漏修复/唯一索引添加/closePgPool状态重置/store.js竞态修复

---

## 十五、前端架构说明（2026-05-24 更新）

### 15.1 技术栈

```
React 19 + Vite 8 + Zustand 5 + @tanstack/react-query 5
Axios（HTTP客户端） | React Router 7
react-markdown + remark-gfm（Markdown渲染）
```

### 15.2 前端目录结构

```
client/src/
├── App.jsx                          # 路由入口（154行），React Query迁移完成
├── main.jsx                         # React挂载入口（50行），QueryClientProvider已挂载
│
├── hooks/                           # Hooks层（12个旧版hooks）
│   ├── queries/                     # ⭐ React Query Hooks（10个文件，1090行，116个Hooks）
│   │   ├── index.js                 # 统一导出入口（10行）
│   │   ├── useProjects.js           # 项目查询（141行）：15个Hooks，CRUD+cleanup+remediate+constraints
│   │   ├── useMaterials.js          # 素材查询（56行）：5个Hooks，列表/详情/CRUD
│   │   ├── useChapters.js           # 章节查询（78行）：8个Hooks，列表/详情/CRUD/排序/下载/重置
│   │   ├── usePipeline.js           # Pipeline查询/操作（430行）：50个Hooks
│   │   ├── useChapterAudit.js       # 章节审计查询（99行）：10个Hooks，audit/repair/batchRepair/retry/rollback
│   │   ├── useReviews.js            # 审核查询（34行）：3个Hooks
│   │   ├── useAgents.js             # Agent查询（73行）：7个Hooks，列表/详情/模板/约束/风格
│   │   ├── useFlavors.js            # 方言/风格查询（106行）：11个Hooks，方言/风格/题材配置/预览/重载
│   │   └── useSettings.js           # 设置查询（73行）：7个Hooks，设置/约束/模板/prompt管理
│   │
│   └── （旧版hooks，逐步废弃中）
│       ├── useProjects.js           # 旧版项目hook（159行）
│       ├── useMaterials.js          # 旧版素材hook（108行）
│       ├── useChapters.js           # 旧版章节hook（118行）
│       └── ...
│
├── pages/                           # 页面组件（18+37子模块，~17000行）
│   ├── PipelinePage.jsx             # Pipeline控制台（2627行），React Query迁移完成 ✅
│   ├── MaterialsPage.jsx            # 素材库（1571行），React Query迁移完成 ✅
│   ├── Dashboard.jsx                # 仪表盘（1240行），React Query迁移完成 ✅
│   ├── KnowledgePage.jsx            # 知识库（1177行）
│   ├── PublishPage.jsx              # 发布页（1101行）
│   ├── WorkshopPage.jsx             # 工作台（804行）
│   ├── ComicConfigPage.jsx          # 漫画配置（604行）
│   ├── MapPage.jsx                  # 地图（569行）
│   ├── ComicStoryboardPage.jsx      # 漫画分镜（687行）
│   ├── AgentsPage.jsx               # Agent管理（462行），React Query迁移完成 ✅
│   ├── SettingsPage.jsx             # 设置（456行），React Query迁移完成 ✅
│   ├── StyleTemplatesPage.jsx       # 风格模板（385行）
│   ├── ChaptersPage.jsx             # 章节管理（351行），React Query迁移完成 ✅
│   ├── LibraryPage.jsx              # 书库（369行）
│   ├── TimelinePage.jsx             # 时间线（343行）
│   ├── ComicExportPage.jsx          # 漫画导出（253行）
│   ├── GuidePage.jsx                # 引导页（280行）
│   ├── ComicRenderPage.jsx          # 漫画渲染（174行）
│   └── ComicWorkflowsPage.jsx       # 漫画工作流（230行）
│   │
│   ├── pipeline/                    # Pipeline子模块（14个文件，2781行）
│   │   ├── ChapterAuditPanel.jsx    # 章节审核面板（599行）
│   │   ├── PipelineToolsPanel.jsx   # 工具面板（354行）
│   │   ├── OutputViewer.jsx         # 输出查看器（340行）
│   │   ├── pipelineConstants.js     # Pipeline常量（182行）
│   │   ├── useInfinitePipeline.js   # 无限Pipeline逻辑（176行）
│   │   ├── AgentConfigPanel.jsx     # Agent配置面板（171行）
│   │   ├── PipelineLogViewer.jsx    # 日志查看器（193行）
│   │   ├── InjectionMapPanel.jsx    # 注入映射面板（147行）
│   │   ├── PipelineSettingsPanel.jsx# 设置面板（151行）
│   │   ├── ChapterListPanel.jsx     # 章节列表面板（97行）
│   │   ├── InfinitePipelineBar.jsx  # 无限Pipeline栏（29行）
│   │   ├── ReviewResultPanel.jsx    # 审核结果面板（61行）
│   │   └── SafeMarkdown.jsx         # 安全Markdown渲染（12行）
│   │
│   ├── materials/                   # 素材子模块（7个文件，1175行）
│   │   ├── useMaterials.js          # 素材逻辑（222行）
│   │   ├── MaterialEditor.jsx       # 素材编辑器（268行）
│   │   ├── MaterialTreePanel.jsx    # 素材树面板（209行）
│   │   ├── QuestPanel.jsx           # 任务面板（204行）
│   │   ├── materialConstants.js     # 素材常量（128行）
│   │   ├── TimelinePanel.jsx        # 时间线面板（102行）
│   │   └── CreateMaterialForm.jsx   # 创建素材表单（42行）
│   │
│   ├── knowledge/                   # 知识库子模块（8个文件，1022行）
│   │   ├── GraphPanel.jsx           # 图谱面板（293行）
│   │   ├── PowerTracker.jsx         # 力量追踪（186行）
│   │   ├── ConsistencyPanel.jsx     # 一致性面板（115行）
│   │   ├── ForeshadowPanel.jsx      # 伏笔面板（110行）
│   │   ├── MemoryPanel.jsx          # 记忆面板（85行）
│   │   ├── SnapshotPanel.jsx        # 快照面板（83行）
│   │   ├── OverviewPanel.jsx        # 概览面板（53行）
│   │   └── knowledgeConstants.js    # 知识库常量（17行）
│   │
│   ├── publish/                     # 发布子模块（4个文件，935行）
│   │   ├── usePublish.js            # 发布逻辑（390行）
│   │   ├── PublishConfigPanel.jsx   # 发布配置面板（266行）
│   │   ├── InteractionPanel.jsx     # 交互面板（168行）
│   │   └── PublishQueuePanel.jsx    # 发布队列表（111行）
│   │
│   └── dashboard/                   # 仪表盘子模块（4个文件，650行）
│       ├── useDashboard.js          # Dashboard逻辑（561行）
│       ├── ProjectCard.jsx          # 项目卡片（51行）
│       ├── OutlineGenerator.jsx     # 大纲生成器（25行）
│       └── MaterialGenerator.jsx    # 素材生成器（17行）
│
├── services/                        # 服务层（3个文件，724行）
│   ├── api.js                       # Axios API封装（461行），所有API端点集中管理
│   ├── queryClient.js               # React Query客户端（13行），全局配置staleTime:30s
│   └── wsClient.js                  # WebSocket客户端（250行）
│
├── store/                           # Zustand状态（3个文件，200行）
│   ├── useAppStore.js               # 全局状态（116行），项目/章节/素材/主题
│   ├── useUIStore.js                # UI状态（54行），模态框/侧边栏
│   └── usePipelineStore.js          # Pipeline状态（30行）
│
├── components/                      # 通用组件（5个文件，1061行）
│   ├── CreateProjectModal.jsx       # 创建项目弹窗（701行）
│   ├── Sidebar.jsx                  # 侧边导航（183行）
│   ├── ErrorBoundary.jsx            # 错误边界（70行）
│   ├── VirtualList.jsx              # 虚拟列表（59行）
│   └── Header.jsx                   # 顶栏（48行）
│
├── shared/                          # 共享工具（3个文件，278行）
│   ├── utils.js                     # 通用工具（122行）
│   ├── dateUtils.js                 # 日期工具（80行）
│   └── hooks.js                     # 通用hooks（76行）
│
└── styles/                          # 样式（12个文件，3667行）
    ├── layout.css                   # 布局（714行）
    ├── components.css               # 组件（616行）
    ├── animations.css               # 动画（227行）
    ├── skin-mario.css               # Mario皮肤（382行）
    ├── skin-aurora.css              # Aurora皮肤（358行）
    ├── skin-ripple.css              # Ripple皮肤（284行）
    ├── timeline.css                 # 时间线（295行）
    ├── skin-glass.css               # Glass皮肤（212行）
    ├── skin-liquid.css              # Liquid皮肤（210行）
    ├── skin-soft.css                # Soft皮肤（191行）
    └── variables.css                # CSS变量（28行）
```

### 15.3 React Query Hooks 清单

#### useProjects.js（15个Hooks）
| Hook名 | 类型 | 功能 |
|---|---|---|
| `useProjects()` | query | 获取项目列表 |
| `useProject(id)` | query | 获取单个项目详情 |
| `useCreateProject()` | mutation | 创建项目 |
| `useUpdateProject(id)` | mutation | 更新项目 |
| `useDeleteProject()` | mutation | 删除项目 |
| `useProjectConstraints()` | query | 获取项目约束预设 |
| `useProjectRemediationStatus(id)` | query | 获取整改状态 |
| `useProjectCleanupStats(id)` | query | 获取清理统计 |
| `useProjectAgentModelConfig(id)` | query | 获取Agent模型配置 |
| `useSaveAgentModelConfig(id)` | mutation | 保存Agent模型配置 |
| `useResetChapters(id)` | mutation | 重置所有章节 |
| `useProjectCleanup(id)` | mutation | 清理项目 |
| `useProjectStyleGuidance(id)` | query | 获取风格指导 |
| `useProjectRemediate(id)` | mutation | 整改分发 |
| `useDeleteProjectRemediation(id)` | mutation | 删除整改 |

#### useMaterials.js（5个Hooks）
| Hook名 | 类型 | 功能 |
|---|---|---|
| `useMaterials(projectId, filters)` | query | 获取素材列表（支持过滤） |
| `useMaterial(id)` | query | 获取单个素材详情 |
| `useCreateMaterial()` | mutation | 创建素材 |
| `useUpdateMaterial(id, projectId)` | mutation | 更新素材 |
| `useDeleteMaterial()` | mutation | 删除素材 |

> 注：`useToggleMaterialLock()` 在 usePipeline.js 中

#### useChapters.js（8个Hooks）
| Hook名 | 类型 | 功能 |
|---|---|---|
| `useChapters(projectId)` | query | 获取章节列表 |
| `useChapter(id)` | query | 获取单个章节详情 |
| `useUpdateChapter()` | mutation | 更新章节 |
| `useDeleteChapter()` | mutation | 删除章节 |
| `useResetChapter()` | mutation | 重置章节 |
| `useDownloadChaptersTxt()` | mutation | 下载全本TXT |
| `useDownloadChapterTxt()` | mutation | 下载单章TXT |
| `useUpdateChapterOrder()` | mutation | 章节排序 |

#### usePipeline.js（50个Hooks）
| 分类 | Hook名 | 功能 |
|---|---|---|
| **状态** | `usePipelineStatus(projectId, {refetchInterval})` | 无限流水线状态（支持轮询） |
| | `usePipelineAgents()` | 获取Agent列表 |
| **操作** | `useStartPipeline()` | 启动无限流水线 |
| | `useStopPipeline()` | 停止无限流水线 |
| | `useResetPipeline()` | 重置无限流水线 |
| **章节操作** | `useRunStep()` | 运行单步 |
| | `useRunFullPipeline()` | 运行完整Pipeline |
| | `useRunPipeline()` | 运行Pipeline（旧版） |
| | `useRunSingleChapter()` | 运行单章 |
| | `useRetryChapter()` | 重试章节 |
| | `useBatchRetryChapters()` | 批量重试章节 |
| | `useTaskStatusPoll(taskId, {refetchInterval, enabled})` | 任务状态轮询 |
| | `useResetChapterContent()` | 重置章节内容 |
| | `useResetChaptersBulk()` | 批量重置章节 |
| | `useSupplementOutlines()` | 补充大纲 |
| | `useClearChaptersAfter()` | 清除后续章节 |
| **素材操作** | `useRerunMaterialManager()` | 补跑素材管理 |
| | `useToggleMaterialLock()` | 切换素材锁定 |
| | `useSetVolumeSubplane()` | 设置卷次位面 |
| | `useGenerateSubplaneMaterials()` | 生成次位面素材 |
| **图片** | `useGenerateImages()` | 生成配图 |
| | `useChapterImages(projectId, chapterId)` | 获取章节图片 |
| **数据查询** | `usePipelineOutputPaths(projectId)` | 输出路径 |
| | `usePipelineContextBudget(projectId)` | 上下文容量 |
| | `usePipelineInjectionMap(projectId)` | 注入映射 |
| | `usePipelineHookBudget(projectId)` | 伏笔预算 |
| | `usePipelineRuleStack(projectId)` | 规则栈 |
| | `usePipelineChapterIntent(projectId)` | 章节意图 |
| | `usePipelinePromptAudit(projectId)` | 提示词审计 |
| | `useGetLatestPromptAudit()` | 最新提示词审计 |
| | `usePipelineOptimizer(projectId)` | 优化器报告 |
| | `useChapterAuditData(projectId)` | 章节审计数据 |
| | `useGetContextTrace(projectId, chapterNumber)` | 上下文追踪 |
| **Agent配置** | `usePipelineAgentModelConfig(projectId)` | Agent模型配置 |
| | `useSaveAgentModelConfig(projectId)` | 保存Agent模型配置 |
| | `useGetAgentModelConfig(projectId)` | 获取Agent模型配置（通过projects API） |
| | `useSaveAgentModelConfigFromProjects(projectId)` | 保存配置（通过projects API） |
| | `useTestAgentConnection()` | 测试Agent连接 |
| **优化器** | `usePipelineApplyOptimizer()` | 应用优化 |
| | `useRunOptimizerReport()` | 运行优化器报告 |
| | `useApplyOptimizerPattern()` | 应用优化模式 |
| | `useOptimizerSuggestion(projectId, patternId)` | 获取优化建议 |
| **审计返修** | `useRepairModels()` | 获取返修模型列表 |
| | `useRepairChapter()` | 返修章节 |
| | `useBatchRepairChapters()` | 批量返修 |
| | `useTestAgentModel()` | 测试Agent模型 |
| **Hook预算** | `useSyncHookBudget(projectId)` | 同步伏笔预算 |
| | `useRegisterHook(projectId)` | 注册伏笔 |
| **规则栈** | `useExtractRuleStack(projectId)` | 提取规则栈 |
| **其他** | `useSaveProjectTargets(projectId)` | 保存项目目标 |

#### useChapterAudit.js（10个Hooks）
| Hook名 | 类型 | 功能 |
|---|---|---|
| `useChapterAuditModels()` | query | 获取可用返修模型列表 |
| `useChapterAuditRun(projectId)` | mutation | 执行全量章节审计 |
| `useChapterAuditRepair(projectId, chapterId)` | mutation | 单次返修 |
| `useChapterAuditRepairRetry(projectId, chapterId)` | mutation | 返修重试 |
| `useChapterAuditRepairRetryStatus(taskId, {refetchInterval, enabled})` | query | 返修重试状态轮询 |
| `useChapterAuditRepairRetryCancel()` | mutation | 取消返修重试 |
| `useChapterAuditBatchRepair(projectId)` | mutation | 批量返修 |
| `useChapterAuditBatchRepairStatus(taskId, {refetchInterval, enabled})` | query | 批量返修状态轮询 |
| `useChapterAuditReview(projectId, chapterId)` | mutation | 单独审核 |
| `useChapterAuditRollback(projectId)` | mutation | 章节回滚 |

#### useReviews.js（3个Hooks）
| Hook名 | 类型 | 功能 |
|---|---|---|
| `useReviews(projectId)` | query | 获取审核列表 |
| `useReview(id)` | query | 获取单个审核详情 |
| `useReviewsByChapter(chapterId)` | query | 按章节获取审核列表 |

#### useAgents.js（7个Hooks）
| Hook名 | 类型 | 功能 |
|---|---|---|
| `useAgentsList(mode)` | query | 获取Agent列表（按模式过滤） |
| `useAgentDetail(type, mode, projectId)` | query | 获取Agent详情 |
| `useUpdateAgentPrompt()` | mutation | 更新Agent提示词 |
| `useAgentTemplates()` | query | 获取Agent模板列表 |
| `useUpdateAgentTemplate(id)` | mutation | 更新Agent模板 |
| `useAgentConstraints()` | query | 获取约束预设列表 |
| `useAgentProfiles()` | query | 获取风格配置列表 |

#### useFlavors.js（11个Hooks）
| Hook名 | 类型 | 功能 |
|---|---|---|
| `useDialects()` | query | 获取方言列表 |
| `useDialect(region)` | query | 获取单个方言详情 |
| `useSpeechStyles()` | query | 获取说话风格列表 |
| `useNamingStyles()` | query | 获取命名风格列表 |
| `useSystemPersonas()` | query | 获取系统角色模板列表 |
| `useGenreProfiles()` | query | 获取题材配置列表 |
| `useWorldviewTemplates()` | query | 获取世界观模板列表 |
| `useInferNamingStyle(genre)` | query | 推断命名风格 |
| `useResolveGenreProfile(genre)` | query | 解析题材配置 |
| `useCombinedFlavorPreview()` | mutation | 组合风味预览 |
| `useReloadFlavors()` | mutation | 重载方言/风格数据 |

#### useSettings.js（7个Hooks）
| Hook名 | 类型 | 功能 |
|---|---|---|
| `useSettings()` | query | 获取系统设置 |
| `useUpdateSettings()` | mutation | 更新系统设置 |
| `useConstraintPresets()` | query | 获取约束预设列表 |
| `useStyleTemplates()` | query | 获取风格模板列表 |
| `useGeneratePrompt()` | mutation | 生成提示词 |
| `useSavePrompt()` | mutation | 保存提示词 |
| `useDeletePrompt()` | mutation | 删除提示词 |

### 15.4 React Query 缓存策略

```javascript
// queryClient.js 全局配置
staleTime: 30_000        // 30秒内不自动重新请求
gcTime: 5 * 60 * 1000    // 5分钟后清理未使用的缓存
retry: 1                 // 失败重试1次
refetchOnWindowFocus: false  // 窗口聚焦不自动刷新

// 各模块典型配置
列表数据: staleTime: 60s      // 项目/章节/素材列表
详情数据: staleTime: 30s      // 单个项目/章节详情
低频数据: staleTime: 5min     // 方言/风格/模板
轮询数据: refetchInterval: 3s~5s  // Pipeline状态/任务进度
```

### 15.5 Mutation invalidation 规则

| Mutation | Invalidate Query Keys |
|---|---|
| `useCreateProject` | `['projects']` |
| `useUpdateProject(id)` | `['projects', 'detail', id]` + `['projects']` |
| `useDeleteProject(id)` | `['projects']` |
| `useCreateMaterial` | `['materials', 'list', projectId]` |
| `useUpdateMaterial(id, projectId)` | `['materials', 'detail', id]` + `['materials', 'list', projectId]` |
| `useUpdateChapter` | `['chapters', 'detail', id]` + `['chapters', 'list', projectId]` |
| `useStartPipeline` | `['pipeline', 'status', projectId]` |
| `useRunStep` | `['chapters', 'list', projectId]` + `['pipeline', 'output-paths', projectId]` |
| `useChapterAuditRepair` | `['chapter-audit', 'audit', projectId]` + `['chapters', 'list', projectId]` |

### 15.6 Zustand vs React Query 职责分工

| 数据类型 | 管理方式 | 说明 |
|---|---|---|
| **服务端数据** | React Query | 项目/章节/素材/审核/Pipeline状态等 |
| **UI状态** | Zustand | theme/modals/sidebar/membership/bgImage等 |
| **实时反馈** | Zustand | addPipelineLog/setPipelineState（运行日志面板） |
| **双写兼容** | React Query → Zustand | 数据获取后同步到Zustand，兼容未改造的旧组件 |

### 15.7 页面改造状态（2026-05-24 验证更新）

| 页面 | React Query迁移 | useEffect剩余 | 剩余API调用 | 备注 |
|---|---|---|---|---|
| PipelinePage | ✅ 97% | 14处 | pipelineApi.getPipelineLogs(1处) | 核心数据获取已迁移，剩余useEffect为UI逻辑 |
| ChaptersPage | ✅ 100% | 0处 | chaptersApi.downloadNovel(1处) | 数据获取全部完成，下载功能保留axios |
| AgentsPage | ✅ 100% | 0处 | 无 | 全部完成 |
| SettingsPage | ✅ 部分 | 2处 | settingsApi.getKeys(1处) | settings部分已改，API Keys保留 |
| MaterialsPage | ✅ 部分 | 4处 | questApi(18处) | 风味/素材数据已改，quest/timeline保留 |
| Dashboard | ✅ 部分 | 2处 | franchise(10+处) | 项目/风味数据已改，franchise保留 |

### 15.8 构建与验证

```bash
# 前端开发模式
cd novel-pipeline/client && npm run dev      # 端口 5173

# 前端生产构建
cd novel-pipeline/client && npm run build    # 输出 dist/

# 验证
npm run build                                # 必须通过
```

### 15.9 前端开发规范

1. **新页面/新组件优先使用React Query Hooks**，不要直接调用API
2. **mutation后使用invalidateQueries**刷新缓存，不要手动setState
3. **轮询使用refetchInterval**，不要使用setInterval
4. **双写兼容期**：React Query获取数据后通过`useAppStore.getState().setXxx(data)`同步到Zustand
5. **queryKey命名规范**：`[模块, 'list'|'detail'|子模块, ...参数]`
6. **Hook文件命名**：`useXxx.js`，放在`hooks/queries/`目录下
7. **统一导出**：所有Hooks通过`hooks/queries/index.js`统一导出

## DataContext统一数据入口规则

### 强制规则
1. **所有Agent必须通过DataContext读取数据**，禁止直接调用store.getItem/queryItems
2. DataContext是唯一数据入口：`const ctx = await getDataContext(projectId);`
3. 新增数据访问需求时，必须先在DataContext中添加委托方法
4. DataContext有缓存机制，同一projectId只创建一个实例

### 违规示例
```javascript
// ❌ 违规：Agent直接读store
const project = await store.getItem('projects', projectId);
const chapters = store.queryItems('chapters', { projectId });

// ✅ 正确：通过DataContext
const ctx = await getDataContext(projectId);
const project = await ctx.getProject();
const chapters = await ctx.getChapters();
```

### DataContext委托方法分类
- **项目数据**：getProject(), getStyleProfile(), getGenre(), getGenreId(), getGenreSchema(), getStyleTemplate(), getMode(), getWordConfig()
- **章节数据**：getChapter(id), getChapters(filter), getPreviousChapter(ch), getSkippedChapters(ch)
- **素材数据**：getMaterials(filter), getActiveMaterials(type), getForeshadowingMaterials(), getCharacterMaterials(), getNarrativeBridgeMaterials(), getCoreSettingMaterials()
- **实体数据**：getEntitiesForWriter(ch, budget), getEntitiesForReviewer(ch), getEntitiesForIntentPlanner(ch), getEntityByName(type, name), getEntityRelations(), getRelationTypes()
- **题材数据**：getAgentMaterialAccess(agent), getMaterialFocus(), getReviewRules()
- **时间轴**：getTimelineEventsForChapter(ch), getTimelineEventsForRange(from, to), getRecentTimelineEvents(ch, lookback), getTimelineCausalChain(eventId), getTimelineSummary(ch, lookback, budget), detectTimelineConflicts(ch)
- **战力守卫**：checkPowerConsistency(ch), getPowerCurve(entityId), getPowerCheckHint(ch)
- **伏笔守卫**：getOverdueForeshadows(ch), getForeshadowResolveStats(), getForeshadowHint(ch), getForeshadowCheckHint(ch)
- **角色弧线守卫**：checkCharacterArcs(ch), getCharacterActivityStats(ch), getCharacterArcCheckHint(ch), getCharacterActivityHint(ch)
- **长线审计**：runFullAudit(ch), shouldRunAudit(ch), getAuditHistory(limit)
- **素材长线管理**：getMaterialActivityAnalysis(ch), archiveStaleMaterials(ch), detectDuplicateMaterials(), calculateTokenBudget(ch), getMaterialHealthReport(ch)

## 守卫服务开发规则

### 新增守卫服务检查清单
- [ ] 创建服务文件：server/services/xxxGuard.js
- [ ] 实现标准接口：checkXxx / generateXxxHint / generateXxxCheckHint
- [ ] 阈值提取为CONFIG常量，禁止硬编码
- [ ] 集成到DataContext：import + 委托方法
- [ ] writer集成：调用ctx.getXxxHint()注入提示
- [ ] review集成：调用ctx.getXxxCheckHint()注入检查结果
- [ ] API路由：knowledge.js添加路由
- [ ] 前端API：api.js添加方法
- [ ] 验收脚本：verify-tX.js

### 守卫服务与题材插件
- 守卫服务是通用逻辑，不依赖特定题材
- 题材特定阈值从genreSchema读取，不硬编码
- 例：PowerGuard战力突变阈值从genreSchema.powerChangeThreshold读取

## 知识库表开发规则

### 新增知识库表检查清单
- [ ] DDL写在knowledgeSchema.js，不写在pgSchema.js
- [ ] store-pg.js的knowledge表handler条件同步更新
- [ ] database-pg.js的DEDICATED_TABLES同步添加
- [ ] 知识库表统一使用JSONB（而非TEXT+safeParse）
- [ ] 每张知识库表必须有projectId索引
- [ ] DATABASE_SCHEMA.md同步更新文档

