# Novel Pipeline 完整交接文档

> 本文档包含系统架构、Agent职责、Pipeline流程、数据规范、说话风味系统、审核覆盖机制、踩坑记录、常见问题修复手册。
> 新AI阅读本文档后即可直接接手开发和运维。

---

## 一、系统架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                    │
│  Dashboard | Pipeline | Materials | Chapters | Agents | ... │
│  Store: Zustand | API: Axios | Themes: 7 skins              │
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
│  │ LLM Layer (8 providers)                                │  │
│  │  aliyunCoding(qwen3.6-plus) | minimax | deepseek      │  │
│  │  | siliconflow | lmstudio | openai | zhipu | moonshot  │  │
│  │  resolveStepConfig -> per-agent model assignment       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Context Management                                     │  │
│  │  ContextBudget | PromptAuditor | Memory | HookBudget   │  │
│  │  | RuleStack | BeatAllocator | ChapterIntent           │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Store (JSON File)                                           │
│  data/projects/ | data/materials/ | data/chapters/ | ...    │
│  data/dialects/ | data/speech-styles/                       │
└──────────────────────────────────────────────────────────────┘
```

### 启动命令
```bash
# 后端
cd novel-pipeline && node server/index.js    # 端口 3001

# 前端（开发模式）
cd novel-pipeline/client && npm run dev       # 端口 5173，代理到 3001
```

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
| `fast-review` | 快审 | 爽点密度/节奏审核（爽文模式） | Markdown+JSON | 8192 |
| `reviser` | 返修员 | 根据审核反馈精准修改正文 | 修改后完整正文 | 32768 |
| `intent-planner` | 意图规划 | 规划章节意图(goal/mustKeep/mustAvoid) | 结构化JSON | 8192 |

### Agent Prompt 构建链路
```
Foundation Prompt → Agent Template → Style Profile注入 → Constraint Injection
→ Genre Rules注入 → 方言/风格注入 → Deduplicate → Prompt Auditor审计 → Context Budget分配
```

核心文件：`server/services/_agentPromptsLegacy.js`

---

## 三、Pipeline 流程

### 三种模式

| 模式 | 步骤序列 | 最大轮次 | 最低字数 |
|---|---|---|---|
| `novel`(默认) | writer→first-review→second-review→final-editor→material-manager | 7 | 2200 |
| `shuangwen` | writer→fast-review→final-editor→material-manager | 3 | 1200 |
| `tomato-short` | writer→fast-review→final-editor→material-manager | 3 | 1850 |

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

### 素材类型（28种）

| 分类 | 类型 |
|---|---|
| 世界观 | worldview, scene, phenomenon, institution, organization, faction, geography, technology, power-system |
| 角色 | character, character-psychology, character-combat, character-personality, character-relationship, character-dialogue, character-behavior |
| 逻辑 | foreshadowing, writing-technique, logic |
| 特殊 | sub-plane, equipment, relationship, mechanism, material, index, narrative-bridge, catchphrase, famous-scene, growth-history, location, other |

### 新增类型必须三处同步
1. `server/routes/materials.js` → `MATERIAL_TYPES`
2. `client/src/pages/MaterialsPage.jsx` → `MATERIAL_TYPE_LABELS` + `MATERIAL_TYPE_COLORS` + `DOMAIN_CATEGORIES`
3. `server/services/materialValidator.js` → `VALID_MATERIAL_TYPES` + `HIERARCHY_RULES`

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

核心文件：`server/services/llmConfig.js`

### 默认分配
所有agent默认使用 aliyunCoding (qwen3.6-plus)

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

### 存储方案
JSON文件持久化，每条记录一个文件

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

### 关键API
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
| server/store.js | JSON文件存储，含isFoundationMaterial |
| server/services/_pipelineLegacy.js | Pipeline主引擎 |
| server/services/_agentPromptsLegacy.js | Agent提示词构建（含方言/风格注入） |
| server/services/genreConfig.js | 题材插件注册中心 |
| server/services/llmConfig.js | LLM配置中心 |
| server/services/dialectRegistry.js | 方言注册服务（加载/查询/Prompt构建） |
| server/services/speechStyleRegistry.js | 说话风格注册服务（含组合Prompt构建） |
| server/services/materialValidator.js | 素材验证+层级校验 |
| server/services/materialIndex.js | 素材索引管理 |
| server/services/promptAuditor.js | 提示词审计 |
| server/services/contextBudget.js | 上下文预算 |
| server/services/reviewCircuitBreaker.js | 审核熔断器 |
| server/routes/flavors.js | 方言/风格API路由 |

### Pipeline引擎
| 文件 | 功能 |
|---|---|
| server/services/pipeline/fullPipeline.js | 主Pipeline引擎（含审核覆盖逻辑） |
| server/services/pipeline/infinitePipeline.js | 无限Pipeline引擎 |
| server/services/pipeline/volumeHelpers.js | 卷/位面可见性管理 |
| server/services/pipeline/steps/materialManager.js | 素材管理器（含方言/风格标签解析） |

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
| data/subplanes/*.json | 次位面数据（每个位面一个文件） |
| data/subplanes/mainworld.json | 主世界势力数据 |
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
3. **新增类型三处同步** - materials.js + MaterialsPage.jsx + materialValidator.js
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
15. **SQL必须参数化** - 禁止字符串拼接SQL，必须使用 `?` 占位符

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
- 素材类型三处同步（28+类型/无重复/关键类型存在）
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
| P0-2 | materialManager代码膨胀(1037行) | server/services/pipeline/steps/materialManager.js | ❌待修 |
| P0-3 | intensityMap重复6次 | materialManager.js | ✅已修(提取parseFlavorTag+INTENSITY_MAP) |
| P0-4 | 审核覆盖正则脆弱 | fullPipeline.js shouldOverrideReviewRejection | ✅已修(提取为reviewOverride.js独立模块) |
| P0-5 | InfinitePipeline内存泄漏风险 | infinitePipeline.js INFINITE_PIPELINE_STATE | ✅已修(日志限制200+启动前清理+延迟10s+心跳warn) |
| P0-6 | 前端PipelinePage轮询泄漏风险 | client/src/pages/PipelinePage.jsx | ✅已修(buttonPollRefs+卸载cleanup) |
| P0-7 | 前端状态管理缺数据层 | client/src/store/useAppStore.js | ⏳延后(需React Query,风险高) |
| P0-8 | 错误处理不一致(空catch) | 全系统 | ✅已修(119处空catch→console.warn) |
| P0-9 | API响应格式不统一 | server/routes/*.js | ✅已修(创建responseFormatter.js) |
| P0-10 | 缺少速率限制 | server/index.js | ✅已修(全局200/min+Pipeline10/min) |

**修复P0问题时，必须同时更新此表的状态列。**
