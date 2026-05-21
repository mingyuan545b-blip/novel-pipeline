# Novel-Pipeline 新题材定制规范 v2.0

> 本文档是给 AI 定制新题材 Plugin 的完整规范。包含系统架构、Agent职责、流水线流程、约束表结构、记忆层级、题材Plugin接口定义、现有题材示例。按此规范输出的 `.js` 文件放入 `server/services/genres/` 目录即可自动注册生效。

---

## 一、系统总览

### 1.1 流水线架构

```
用户创建项目(选择题材/模式)
    ↓
generateFromTemplate → 生成世界观/角色/大纲/章节意图
    ↓
runInfinitePipeline → 逐章循环
    ↓ 每章执行 runFullPipeline
    ↓
┌─────────────────────────────────────────────────────────┐
│  runFullPipeline（单章完整流水线）                         │
│                                                         │
│  1. chapterIntent  → 生成章节意图(goal/mustKeep/mustAvoid)│
│  2. hookBudget     → 生成伏笔议程(推进/回收/预算)          │
│  3. ruleStack      → 生成规则栈(L1-L4分层约束)            │
│  4. beatAllocator  → 分配节拍(每章3-8个节拍+技法绑定)      │
│  5. runPipelineStep → 执行Agent步骤                       │
│     ├── writer        → 生成正文                         │
│     ├── first-review  → 初审(或fast-review)              │
│     ├── second-review → 复审                             │
│     ├── final-editor  → 定稿                             │
│     ├── reviser       → 返修(审核不通过时)                │
│     ├── material-manager → 素材提取/更新                  │
│     ├── polisher      → 润色                             │
│     ├── reader        → 阅读评审                         │
│     └── adjuster      → 动态调整规则                      │
│  6. memory.updateAfterChapter → 更新5层记忆               │
│  7. consistency.quickCheck → 一致性检查                    │
│  8. stateSnapshot → 创建快照                              │
│  9. imageGen → 生成插图(可选)                             │
└─────────────────────────────────────────────────────────┘
```

### 1.2 模式与步骤序列

| 模式 | 步骤序列 | 每章最大轮次 | 目标字数 |
|------|---------|-------------|---------|
| novel | writer → first-review → second-review → final-editor | 5 | 2200-2800 |
| shuangwen | writer → fast-review → final-editor | 3 | 1800-2500 |
| tomato-short | writer → fast-review → final-editor | 3 | 1900-2100 |

通过审核后追加：material-manager → polisher → reader → adjuster

---

## 二、Agent职责详细定义

### 2.1 writer（执笔人）

| 属性 | 值 |
|------|---|
| 职责 | 根据大纲+素材+记忆+字数要求+题材注入生成章节正文 |
| LLM路由 | LM Studio（本地模型） |
| 输出格式 | 纯文本正文，无Markdown标记 |
| 题材注入 | `writerHints.terminologyDimming` 注入到user prompt |
| 上下文 | 大纲 + 上章摘要 + 素材索引 + 记忆上下文 + 节拍分配 + 技法注入 + 章节意图 |
| 字数要求 | 由 `MODE_CONFIGS[mode]` 和 `project.wordConfig` 动态注入 |

### 2.2 first-review（初审员）

| 属性 | 值 |
|------|---|
| 职责 | 审核章节正文质量，输出Markdown报告+JSON数据块 |
| LLM路由 | MiniMax API |
| 输出格式 | Markdown报告 + 末尾JSON块 |
| 题材注入 | `reviewRules.firstReview` 的3个规则（perspectiveRule + terminologyRule + outputRule） |
| 硬拦截 | 运行 `interceptors.firstReview`，返回 hardBlockIssues/warningIssues/hints |
| 额外检测 | 告知式动词(detectTellVerbs) + 信息滴入分数(calcInfoDripScore) + 管线元数据泄漏(detectPipelineMetadataLeak) |
| JSON输出字段 | `decision`(approve/reject/revise) + `perspective`(按perspectiveSchema) + `issues[]` + `wordAssessment` + `suggestions[]` |

### 2.3 fast-review（快审员）

| 属性 | 值 |
|------|---|
| 职责 | 替代first-review+second-review的快速审核（shuangwen/tomato-short模式） |
| LLM路由 | MiniMax API |
| 输出格式 | Markdown报告 + 末尾JSON块 |
| 题材注入 | `reviewRules.firstReview`（复用初审规则） |
| JSON输出字段 | 同first-review |

### 2.4 second-review（复审员）

| 属性 | 值 |
|------|---|
| 职责 | 对初审结果二次校验，纠正初审误判，补充遗漏 |
| LLM路由 | MiniMax API |
| 输出格式 | Markdown报告 + 末尾JSON块 |
| 题材注入 | `reviewRules.secondReview` 的3个规则（perspectiveRule + terminologyRule + correctionRule） |
| 硬拦截 | 运行 `interceptors.secondReview` |
| 额外注入 | 风格模板审核（styleTemplate） |

### 2.5 final-editor（定稿人）

| 属性 | 值 |
|------|---|
| 职责 | 综合初审+复审结果做最终approve/reject/revise判定 |
| LLM路由 | MiniMax API |
| 输出格式 | Markdown报告 + 末尾JSON块 |
| 题材注入 | `reviewRules.finalEditor.perspectiveRule` |
| 决策逻辑 | 可覆盖审核员的reject判定为approve（当认为审核矫枉过正时） |

### 2.6 reviser（返修员）

| 属性 | 值 |
|------|---|
| 职责 | 根据审核反馈修改正文 |
| LLM路由 | MiniMax API |
| 输出格式 | 纯文本正文 |
| 题材注入 | `reviewRules.reviser` 的3个规则（terminologyDimmingRule + perspectiveRule + repairRules） |
| 后处理 | 字数4重检查 + 硬性检测(_runHardBlockChecks) + 内容清洗 |

### 2.7 material-manager（素材管理器）

| 属性 | 值 |
|------|---|
| 职责 | 从章节内容提取/更新角色、关系、世界观、伏笔等素材 |
| LLM路由 | MiniMax API |
| 输出格式 | JSON（素材更新指令数组） |
| 题材注入 | `styleProfile.materialFocus`（素材关注优先级） |
| 素材类型 | character, character-psychology, character-combat, character-personality, character-relationship, character-dialogue, character-behavior, worldview, power-system, relationship, foreshadowing, scene, phenomenon, institution, organization, faction, geography, technology, equipment, growth-history, index |

### 2.8 polisher（润色员）

| 属性 | 值 |
|------|---|
| 职责 | 文采提升，不改变剧情/人物/设定/字数 |
| LLM路由 | LM Studio |
| 输出格式 | 纯文本正文 |

### 2.9 reader（阅读者）

| 属性 | 值 |
|------|---|
| 职责 | 阅读近14章+后续大纲，输出评审意见 |
| LLM路由 | LM Studio |
| 输出格式 | Markdown评审报告 |

### 2.10 adjuster（调整员）

| 属性 | 值 |
|------|---|
| 职责 | 根据阅读者意见动态追加/删除执笔人规则和审核规则 |
| LLM路由 | MiniMax API |
| 输出格式 | JSON（规则调整指令） |

---

## 三、5层记忆系统

| 层级 | 常量 | 含义 | 优先级 | 衰减率 | 内容 |
|------|------|------|--------|--------|------|
| L0 | `core` | 核心设定 | 100 | 0（永不衰减） | 世界观规则 + 战力体系 + 核心人物 |
| L1 | `active` | 活跃状态 | 80 | 0.02/章 | 人物状态 + 关系状态 + 装备状态 + 成长履历 |
| L2 | `recent` | 近期上下文 | 60 | 0.05/章 | 近5章摘要 + 活跃任务 + 未回收伏笔 |
| L3 | `archive` | 归档记忆 | 40 | 0.10/章 | 相关历史章节 + 已归档素材 |
| L4 | `compressed` | 压缩卷摘要 | 20 | 0.15/章 | 每30章一卷的卷级摘要 |

### 各层数据结构

**L0（核心设定）**：
```json
{
  "worldRules": [{"id":"", "name":"", "content":"", "version":""}],
  "powerFramework": [{"id":"", "name":"", "content":"", "version":""}],
  "coreCharacters": [{"id":"", "name":"", "content":"", "version":""}],
  "totalTokenEstimate": 0
}
```

**L1（活跃状态）**：
```json
{
  "chapterNumber": 0,
  "characterStates": {"id": {"id":"", "name":"", "currentContent":"", "location":"", "status":"", "powerLevel":"", "emotionalState":"", "lastAppearanceChapter":0, "active":true}},
  "relationshipStates": {"id": {"id":"", "name":"", "content":"", "type":"", "strength":"", "lastChangeChapter":0}},
  "equipmentStates": {"id": {"id":"", "name":"", "content":"", "owner":"", "status":""}},
  "growthStates": {"id": {"id":"", "name":"", "content":"", "milestones":[{"chapter":0, "description":""}]}},
  "totalTokenEstimate": 0
}
```

**L2（近期上下文）**：
```json
{
  "chapterNumber": 0,
  "recentSummaries": [{"chapterNumber":0, "title":"", "summary":"", "keyEvents":[], "wordCount":0}],
  "activeQuests": [{"id":"", "name":"", "description":"", "progress":"", "priority":""}],
  "activeForeshadowings": [{"id":"", "name":"", "content":"", "plantedChapter":0, "urgency":"", "relatedCharacters":[]}],
  "totalTokenEstimate": 0
}
```

---

## 四、约束系统

### 4.1 规则栈（4层架构）

| 层级 | 名称 | 优先级 | 作用域 | 可被覆盖 |
|------|------|--------|--------|---------|
| L1 | hard_facts | 100 | global | 不可被任何层覆盖 |
| L2 | author_intent | 80 | book | 不可被L3/L4覆盖 |
| L3 | planning | 60 | arc | 可被L4覆盖 |
| L4 | current_task | 70 | local | — |

**核心原则**：只有L4→L3允许覆盖，L1硬事实层不可被任何层覆盖。

### 4.2 约束预设

系统内置约束：
| 约束ID | 标签 | 描述 |
|--------|------|------|
| no-derailment | 不降智 | 角色不得出现智商断崖式下降 |
| character-consistency | 角色定位一致 | 每个角色的职位、行动和说话方式必须符合自身定位 |
| worldview-consistency | 世界观一致 | 不出现与世界观无关的元素，所有设定必须自洽 |
| hook-every-chapter | 章末钩子 | 每章结尾必须设置悬念或钩子 |
| fast-escalation | 节奏递进 | 剧情必须持续升级 |
| reader-satisfaction | 读者爽感 | 主角必须频繁获得成就感 |
| simple-readable-style | 简单好读 | 句子短、段落短、节奏流畅 |
| face-slapping | 打脸 | 主角必须通过实力打脸质疑者 |
| power-fantasy | 力量幻想 | 主角必须持续获得力量提升 |

题材可扩展自己的约束预设（通过 `constraintPresets` 字段）。

### 4.3 伏笔预算系统

| 参数 | 值 |
|------|---|
| 最大活跃伏笔数 | 12 |
| 过期阈值 | novel=30章, shuangwen=10章, tomato-short=8章 |
| 紧急阈值 | novel=5章, shuangwen=3章, tomato-short=2章 |

15种伏笔类型：身份悬念、历史谜团、能力异常、角色深度、角色动机、角色变化、世界秘密、真相揭示、物品线索、能力展示、威胁逼近、同伴建立、势力博弈、伏笔铺垫、情感暗线

### 4.4 节拍分配

| 模式 | 每章节拍数 | 必须节拍 | 章末节拍 |
|------|-----------|---------|---------|
| novel | 3-6 | setup, climax | hook |
| shuangwen | 4-7 | provocation, face_slap | hook |
| tomato-short | 5-8 | hook, climax, twist | cliffhanger |

12种节拍类型：setup, tension, escalation, climax, resolution, hook, provocation, reversal, face_slap, aftermath, twist, cliffhanger

---

## 五、上下文预算系统

### 5.1 模型预算表

| 模型类别 | 代表模型 | 预算(tokens) |
|---------|---------|-------------|
| compact | MiniMax-M2.7, gpt-4o-mini | 12K-32K |
| long | qwen3.5-plus, qwen-long | 80K-256K |
| ultra_long | qwen3-30b-a3b, qwen3.6-plus | 256K-800K |

### 5.2 槽位优先级（16个槽位）

| 槽位 | 优先级 | 最大占比(compact) | 说明 |
|------|--------|-----------------|------|
| agent_prompt | 100 | 8% | Agent提示词 |
| worldview_materials | 99 | 10% | 世界观素材 |
| character_materials | 99 | 10% | 角色素材 |
| style_guidance | 98 | 4% | 风格指导 |
| constraint_rules | 95 | 3% | 架构约束 |
| memory_context | 90 | 12% | 分层记忆 |
| other_materials | 80 | 6% | 其他素材 |
| chapter_outline | 75 | 6% | 章节大纲 |
| previous_chapter | 70 | 6% | 上章摘要 |
| foreshadowing | 65 | 4% | 未回收伏笔 |
| character_states | 60 | 4% | 人物状态 |
| review_feedback | 55 | 6% | 审核反馈 |
| technique_injection | 53 | 4% | 技法注入 |
| beat_allocation | 52 | 3% | 节拍分配 |
| style_template | 50 | 2% | 风格模板 |
| chapter_content | 45 | 20% | 章节正文 |

---

## 六、题材Plugin完整接口定义

### 6.1 文件位置

`server/services/genres/<genre-id>.js`

文件放入后自动注册到 `GENRE_REGISTRY`，无需手动注册。

### 6.2 完整字段清单

```javascript
module.exports = {
    // ===== 必需字段 =====

    id: 'genre-id',                    // 唯一标识，小写英文+连字符
    label: '题材中文名',                // 中文标签
    patterns: ['关键词1', '关键词2'],    // isMatch()匹配关键词

    isMatch(styleProfile) {             // 自动识别函数
        const key = (styleProfile?.key || '').toLowerCase();
        const label = (styleProfile?.label || '').toLowerCase();
        const desc = (styleProfile?.description || '').toLowerCase();
        return this.patterns.some(p =>
            key.includes(p) || label.includes(p) || desc.includes(p)
        );
    },

    perspectiveSchema: {                // JSON输出中perspective字段的schema
        fields: '"perspective":"protagonist/narrator/other"',
        label: '视角：protagonist/narrator/other',
        values: ['protagonist', 'narrator', 'other']
    },

    foundation: {                       // 基础设定注入
        additionalConstraints: [        // 题材特有约束项
            { id: 'constraint-id', label: '约束标签', desc: '约束描述' }
        ],
        additionalFoundationRules: [    // 铁律文本（注入到FALLBACK_FOUNDATION的[GENRE_RULES]位置）
            '铁律1：...',
            '铁律2：...'
        ],
        systemMechanismDimming: false,  // 是否需要系统机制降维（科幻/无限流题材设true）
        systemMechanismTarget: ''       // 降维目标描述
    },

    styleProfile: {                     // 完整风格配置（核心！）
        key: 'genre-id',               // 风格标识
        label: '题材中文名',            // 风格中文标签
        povRule: '视角铁律文本',        // 视角规则（注入到所有Agent）
        dialogueRule: '对话规则文本',    // 对话规则
        behaviorRule: '行为规则文本',    // 行为规则
        toneRule: '语气规则文本',       // 语气规则
        titleRule: '章节标题命名规则',   // 标题命名规则
        reviewFocus: '关注点1|关注点2', // 审核关注点（|分隔）
        materialFocus: {                // 素材关注优先级
            primary: ['character', 'worldview'],    // 主要提取
            secondary: ['relationship'],             // 次要提取
            skip: []                                 // 跳过提取
        },
        constraintOverrides: ['hook-every-chapter'], // 覆盖的约束ID（这些约束不再重复注入）
        characterRefRules: '角色称呼规范文本'         // 角色引用规则
    },

    genreBase: {                        // 行为/语气/审核追加规则
        BEHAVIOR_APPEND: '追加行为规则文本',
        REQUIRED_CONSTRAINT_OVERRIDES: ['constraint-id'], // 必需覆盖的约束
        TONE_APPEND: '追加语气规则文本',
        REVIEW_APPEND: '追加审核关注点1|追加审核关注点2'
    },

    qualityChecks: {                    // 质量检测开关
        onomatopoeia: { enabled: false },           // 拟声词密度检测
        visualAnchors: { enabled: false },          // 视觉锚点检测
        motherChildDialogue: { enabled: false },    // 母子对话检测
        modernSlangExtra: false,                     // 额外网络用语检测
        // 可自定义检测项（无限流示例）：
        // mechanicVisualization: { enabled: true },
        // progressTracking: { enabled: true },
        // trustContract: { enabled: true },
        // cliffhangerType: { enabled: true }
    },

    writerHints: {                      // 执笔人注入提示
        terminologyDimming: '注入到writer prompt的术语降维/规则呈现规范文本',
        wordCountExpand: ['扩展建议1', '扩展建议2']  // 字数不足时的扩展建议
    },

    constraintPresets: {                 // 约束预设字典
        'constraint-id': { label: '约束标签', desc: '约束描述' }
    },

    dedupRules: [                       // prompt去重规则
        { id: 'dedup-id', pattern: /正则表达式/, keep: 'first' }
    ],

    reviewRules: {                      // ★★★ 4子项审核规则（最核心）★★★
        firstReview: {
            perspectiveRule: '初审视角感知审核规则文本',
            terminologyRule: '初审术语/机制可解性判定标准文本',
            outputRule: '初审输出要求文本'
        },
        secondReview: {
            perspectiveRule: '复审视角感知审核规则文本',
            terminologyRule: '复审术语/机制判定标准文本',
            correctionRule: '初审结果校正规则文本（防止矫枉过正）'
        },
        reviser: {
            terminologyDimmingRule: '返修时术语降维/机制呈现规则文本',
            perspectiveRule: '返修时视角感知规则文本',
            repairRules: '修复规则编号列表文本'
        },
        finalEditor: {
            perspectiveRule: '定稿视角感知规则文本'
        }
    },

    detectors: {                        // 检测器函数集合
        perspective(content, styleProfile) {
            return { isViolation: false, issues: [], hasCriticalIssue: false };
        },
        terminology(content, styleProfile) {
            return { count: 0, instances: [], violationCount: 0 };
        },
        modernSlang(content, styleProfile) {
            return { count: 0, instances: [] };
        }
        // 可扩展更多检测器
    },

    interceptors: {                     // 拦截器函数集合
        firstReview(content, styleProfile, context) {
            const hardBlockIssues = [];  // { severity: 'critical'|'high', description: '', title: '' }
            const warningIssues = [];    // { severity: 'high'|'medium'|'low', description: '', title: '' }
            const hints = [];            // string
            return { hardBlockIssues, warningIssues, hints };
        },
        secondReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const warningIssues = [];
            const hints = [];
            return { hardBlockIssues, warningIssues, hints };
        }
    },

    // ===== 可选字段 =====

    perspective: null,                  // 视角检测配置（仅萌娃类题材需要）
    // perspective: {
    //     babyNames: ['宝宝', '小宝', ...],
    //     adultContextWords: ['工作', '公司', ...],
    //     babyContextWords: ['奶', '尿', ...],
    //     ...
    // }

    techJargon: {                       // 术语降维映射表
        terms: []                       // [{from: '技术术语', to: '角色可理解的表达'}]
    }
};
```

### 6.3 reviewRules 4子项注入位置映射

| 子项 | 字段 | 注入到的Agent步骤 | 作用 |
|------|------|-----------------|------|
| firstReview | perspectiveRule | first-review / fast-review | 指导初审员判定视角违规 |
| firstReview | terminologyRule | first-review / fast-review | 指导初审员判定术语/机制违规 |
| firstReview | outputRule | first-review / fast-review | 规范初审输出格式和内容 |
| secondReview | perspectiveRule | second-review | 指导复审员判定视角违规 |
| secondReview | terminologyRule | second-review | 指导复审员判定术语/机制违规 |
| secondReview | correctionRule | second-review | 纠正初审可能的矫枉过正 |
| reviser | terminologyDimmingRule | reviser | 指导返修员进行术语降维/机制呈现 |
| reviser | perspectiveRule | reviser | 指导返修员修复视角问题 |
| reviser | repairRules | reviser | 具体修复步骤编号列表 |
| finalEditor | perspectiveRule | final-editor | 定稿人的视角判定底线 |

---

## 七、现有题材对比参考

### 7.1 萌娃题材 (baby)

| 维度 | 内容 |
|------|------|
| id | `baby` |
| patterns | 萌宝, 萌娃, 幼崽, 宝宝, 变废为宝, 躺平, 植物系 |
| perspectiveSchema | baby/adult/mixed |
| perspective | 非null（含babyNames, adultContextWords, babyContextWords等详细配置） |
| techJargon | 21个术语映射（如"微胶囊网络"→"地下小豆豆在呼吸"） |
| qualityChecks | 拟声词(15) + 视觉锚点(3) + 母子对话(2) + 网络用语 |
| foundation约束 | 5个（纯萌宝视角/禁成人内心戏/萌感优先/对话真实/新角色铺垫） |
| constraintPresets | 5个 |
| dedupRules | 21个 |
| detectors | 6个（perspective + terminology + onomatopoeia + visualAnchors + motherChildDialogue + modernSlang） |
| interceptors | firstReview: 视角+术语+网络用语+拟声词+视觉锚点+母子对话; secondReview: 术语 |

### 7.2 无限流题材 (infinite-dungeon)

| 维度 | 内容 |
|------|------|
| id | `infinite-dungeon` |
| patterns | 无限流, 副本博弈, 阈限剧场, 认知投影, 副本机制 |
| perspectiveSchema | protagonist/narrator/other |
| perspective | null |
| techJargon | 空数组 |
| qualityChecks | 禁用萌娃3项，启用：机制具象化 + 进度追踪 + 信任契约 + 断章钩子 |
| foundation约束 | 10个（副本机制节奏/视角锁定/反机械降神/信任契约/命名规范/规则密度/机制具象化/主角能动性/断章钩子/微循环节奏） |
| constraintPresets | 10个 |
| dedupRules | 10个 |
| detectors | 9个（perspective + terminology + modernSlang + mechanicVisualization + progressTracking + trustContract + cliffhangerType + 3个空桩） |
| interceptors | firstReview: 视角+术语+网络用语+机制具象化+进度追踪+信任契约+断章钩子; secondReview: 视角+机制具象化+断章钩子 |

### 7.3 规则怪谈题材 (rule-horror)

| 维度 | 内容 |
|------|------|
| id | `rule-horror` |
| patterns | 规则怪谈, 规则恐怖, 怪谈, 疗养院, 生存规则, 规则手册 |
| perspectiveSchema | protagonist/narrator/other |
| perspective | null |
| techJargon | 空数组 |
| qualityChecks | 全部禁用 |
| foundation约束 | 5个（规则具象化/视角锁定/反AI味/新人物出场节奏/规则节奏） |
| constraintPresets | 5个 |
| dedupRules | 10个 |
| detectors | 6个（perspective + terminology + modernSlang + 3个空桩） |
| interceptors | firstReview: 视角+术语+网络用语; secondReview: 视角 |

---

## 八、新题材定制操作清单

### 8.1 必须完成的步骤

| # | 步骤 | 说明 |
|---|------|------|
| 1 | 创建 `server/services/genres/<genre-id>.js` | 按上述接口定义完整实现 |
| 2 | 实现 `reviewRules` 的4个子项 | 这是最核心的部分，每个子项的每个字段都必须填写 |
| 3 | 实现 `detectors` 至少3个 | perspective + terminology + modernSlang |
| 4 | 实现 `interceptors` 2个 | firstReview + secondReview |
| 5 | 定义 `constraintPresets` | 题材特有的约束预设 |
| 6 | 定义 `dedupRules` | 防止prompt膨胀的去重规则 |
| 7 | 定义 `qualityChecks` | 根据题材需要启用/禁用特色检测 |
| 8 | 定义 `perspectiveSchema` | 萌娃类用baby/adult/mixed，其他用protagonist/narrator/other |
| 9 | 定义 `styleProfile` | 完整的6个规则字段(povRule/dialogueRule/behaviorRule/toneRule/titleRule/characterRefRules) |
| 10 | 定义 `genreBase` | 4个追加规则(BEHAVIOR_APPEND/TONE_APPEND/REVIEW_APPEND/REQUIRED_CONSTRAINT_OVERRIDES) |

### 8.2 验证步骤

| # | 验证 | 命令 |
|---|------|------|
| 1 | 语法检查 | `node -c server/services/genres/<genre-id>.js` |
| 2 | 注册检查 | `node -e "const g=require('./services/genreConfig'); console.log(g.getGenreById('<genre-id>')?.label)"` |
| 3 | 流水线检查 | `node -c server/services/pipeline.js` |
| 4 | 审计器检查 | `node -c server/services/chapterAuditor.js` |
| 5 | 完整加载检查 | `node -e "require('./index')"` |

### 8.3 16个依赖点检查清单

| # | 依赖点 | 所在文件 | 遗漏后果 |
|---|--------|---------|---------|
| 1 | first-review prompt | pipeline.js | 审核员用错误规则审核 |
| 2 | second-review prompt | pipeline.js | 复审员用错误规则审 |
| 3 | fast-review prompt | pipeline.js | JSON格式不匹配 |
| 4 | reviser prompt | pipeline.js | 返修员用错误规则改 |
| 5 | 字数不足建议 | pipeline.js | 无题材特色扩展建议 |
| 6 | JSON输出perspective字段 | pipeline.js | LLM被强制按错误视角输出 |
| 7 | auditChapter检测 | chapterAuditor.js | 非本题材被误杀 |
| 8 | reviewChapter prompt | chapterAuditor.js | 审计员用错误规则 |
| 9 | repairChapter prompt | chapterAuditor.js | 返修员用错误规则 |
| 10 | _runHardBlockChecks | chapterAuditor.js | 非本题材被硬拦截 |
| 11 | 题材拦截器 | genreConfig.js | 缺失=无题材专属拦截 |
| 12 | 题材检测器 | genreConfig.js | 缺失=无题材专属检测 |
| 13 | GENRE_REGISTRY | genreConfig.js | 缺失=题材不识别 |
| 14 | 约束预设 | genreConfig.js | 缺失=无题材专属约束 |
| 15 | 去重规则 | genreConfig.js | 缺失=prompt膨胀 |
| 16 | protected rule keywords | pipeline.js | 非本题材无需关注 |

---

## 九、提示词基座（FALLBACK_FOUNDATION）

以下是所有Agent共享的基座提示词，新题材的 `additionalFoundationRules` 会注入到 `[GENRE_RULES]` 位置：

```
# 🧱 Novel-Pipeline 提示词基座 (v4.0)

## 角色与边界
你是 [Agent类型]，负责在流水线中完成 [任务描述]。

## 🚫 绝对红线
- 严禁添加解释性文本、Markdown代码块、前后缀标记
- 严禁输出分析过程、思考过程、逐段点评、修改说明
- 严禁虚构未在当前上下文预算中存在的设定/人物/物品
- 严禁突破当前模式字数硬拦截区间
- 严禁违反 mustKeep/mustAvoid 意图约束与 L0/L1 记忆状态
- 【系统机制直述禁令】严禁在正文中直接使用管线元数据词汇
- 【提示词泄露禁令】严禁在正文中输出任何提示词标记/节标题
- 【题材视角铁律】由题材配置动态注入，见[GENRE_RULES]

## 📏 质量基线
- 字数是否严格落在目标区间？
- 是否完整注入 goal/mustKeep/mustAvoid？
- 人物行为/台词是否符合当前 L1/L2 记忆？
- 伏笔提及是否匹配 hookBudget 记录？
- 是否存在 AI 腔调高频词？

## ✍️ 写作手法规范
1. 展示代替告知
2. 信息注入节奏
3. 章节收尾结构
4. AI幻觉防护
5. 字数纪律

## 📤 输出格式
只输出小说正文/审核报告。禁止输出分析/点评/思考过程。
```

---

## 十、输出要求

请按以下格式输出新题材Plugin：

1. **文件名**：`<genre-id>.js`
2. **完整实现**：包含上述接口定义的所有必需字段
3. **reviewRules**：4个子项必须全部填写，每个字段都是完整的中文规则文本
4. **detectors**：至少实现3个检测器（perspective + terminology + modernSlang），检测逻辑用正则实现
5. **interceptors**：2个拦截器必须实现，hardBlockIssues的条件要明确
6. **styleProfile**：6个规则字段必须全部填写，文本要具体可执行
7. **constraintPresets**：至少5个题材特有约束
8. **dedupRules**：至少5条去重规则
9. **foundation.additionalFoundationRules**：至少3条铁律
10. **writerHints.terminologyDimming**：至少200字的执笔人注入文本

### 输出模板

```javascript
// server/services/genres/<genre-id>.js
module.exports = {
    id: '',
    label: '',
    patterns: [],
    isMatch(styleProfile) { ... },
    perspectiveSchema: { fields: '', label: '', values: [] },
    foundation: { additionalConstraints: [], additionalFoundationRules: [], systemMechanismDimming: false, systemMechanismTarget: '' },
    styleProfile: { key: '', label: '', povRule: '', dialogueRule: '', behaviorRule: '', toneRule: '', titleRule: '', reviewFocus: '', materialFocus: { primary: [], secondary: [], skip: [] }, constraintOverrides: [], characterRefRules: '' },
    genreBase: { BEHAVIOR_APPEND: '', REQUIRED_CONSTRAINT_OVERRIDES: [], TONE_APPEND: '', REVIEW_APPEND: '' },
    perspective: null,
    techJargon: { terms: [] },
    qualityChecks: { onomatopoeia: { enabled: false }, visualAnchors: { enabled: false }, motherChildDialogue: { enabled: false }, modernSlangExtra: false },
    writerHints: { terminologyDimming: '', wordCountExpand: [] },
    constraintPresets: {},
    dedupRules: [],
    reviewRules: {
        firstReview: { perspectiveRule: '', terminologyRule: '', outputRule: '' },
        secondReview: { perspectiveRule: '', terminologyRule: '', correctionRule: '' },
        reviser: { terminologyDimmingRule: '', perspectiveRule: '', repairRules: '' },
        finalEditor: { perspectiveRule: '' }
    },
    detectors: {
        perspective(content, styleProfile) { return { isViolation: false, issues: [], hasCriticalIssue: false }; },
        terminology(content, styleProfile) { return { count: 0, instances: [], violationCount: 0 }; },
        modernSlang(content, styleProfile) { return { count: 0, instances: [] }; }
    },
    interceptors: {
        firstReview(content, styleProfile, context) { return { hardBlockIssues: [], warningIssues: [], hints: [] }; },
        secondReview(content, styleProfile, context) { return { hardBlockIssues: [], warningIssues: [], hints: [] }; }
    }
};
```
