# Novel-Pipeline 小说创作流水线系统架构文档

> 版本: v3.0 | 更新日期: 2026-04-30

---

## 一、系统总览

Novel-Pipeline 是一套 AI 驱动的小说自动化创作与发布系统，采用 **多 Agent 流水线架构**，覆盖从章节意图规划、正文创作、多轮审核、定稿润色、素材管理到多平台自动发布的全流程。

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite + Zustand（无第三方 UI 库，纯自定义样式） |
| 后端 | Node.js + Express.js |
| 数据存储 | JSON 文件存储（store.js） |
| AI 模型 | MiniMax / LM Studio / 通义千问 / DeepSeek / GPT-4o（多模型可切换） |
| 浏览器自动化 | Playwright（用于平台发布） |
| 搜索算法 | BM25（藏经阁技法检索） |

### 三种创作模式

| 模式 | 代号 | 目标平台 | 单章字数 | 流水线步骤 | 最大轮次 |
|------|------|----------|----------|------------|----------|
| 长篇小说 | `novel` | 通用 | 2200-2800（硬限1800-3500） | writer → first-review → second-review → final-editor | 5 |
| 爽文 | `shuangwen` | 番茄/七猫 | 1500-2000（硬限1200-2200） | writer → fast-review → final-editor | 3 |
| 番茄短篇 | `tomato-short` | 番茄短篇 | 1900-2100（硬限1850-2150） | writer → fast-review → final-editor | 3 |

---

## 二、Agent 职责体系

### 2.1 核心 Agent 列表

#### 长篇小说模式（novel）

| Agent | 角色 | 职责 | 输出格式 |
|-------|------|------|----------|
| **intent-planner** | 意图规划师 | 在每章写作前生成结构化意图：Goal/MustKeep/MustAvoid/HookAdvance/HookResolve/ConflictDesign/ChapterEndHook | JSON |
| **writer** | 执笔人 | 根据大纲、素材、意图、伏笔预算创作正文 | 纯文本正文 |
| **first-review** | 初审员 | 审核正文与素材库一致性：人物设定/战力体系/世界观/逻辑矛盾/伏笔合理性/角色深度/剧情原创性/内容重复等20+维度 | JSON `{passed, issues, suggestions, summary}` |
| **second-review** | 复审员 | 审核逻辑/字数/风格：情节逻辑/前后连贯/字数达标/文风统一/节奏/冗余/金句复读等 | JSON `{passed, issues, suggestions, summary, wordCount, styleScore}` |
| **final-editor** | 定稿人 | 最高裁定权：综合初审复审结果裁定通过与否，输出IP方向指引和素材更新指引 | JSON `{approved, action, edits, ipDirection, materialGuidance, scheduleNote}` |
| **polisher** | 润色师 | 审核通过后文采润色：感官强化/动作打磨/情绪渲染/环境氛围/对话节奏/章末钩子强化 | 纯文本正文 |
| **material-manager** | 素材管理员 | 根据定稿更新素材库：新建/更新/归档素材，追踪伏笔状态，维护跨类关联 | JSON `{updates, archiveLog, foreshadowTracking}` |
| **reviser** | 返修员 | 根据审核反馈精准局部修改：只改问题部分，不改已通过段落 | 纯文本正文 |
| **reader** | 阅读者 | 每5章以真实读者视角阅读，发现硬伤（前后矛盾/逻辑断裂/人设崩塌/设定冲突/伏笔遗忘）和质量问题 | JSON `{hardIssues, qualityIssues, readerExperience, overallScore, wantToContinue}` |
| **adjuster** | 调整员 | 根据阅读者评审意见修改写作规则/审核条例/素材约束，确保后续章节不再犯同样问题 | JSON `{adjustments, writerRuleAdditions, reviewRuleAdditions, materialConstraintUpdates, rejectedAdjustments}` |

#### 爽文/番茄短篇模式（shuangwen / tomato-short）

| Agent | 角色 | 与长篇差异 |
|-------|------|-----------|
| **writer** | 爽文/番茄短篇执笔人 | 字数更短、节奏更快、爽点密度更高、对话比≤28%（番茄短篇） |
| **fast-review** | 快审员 | 替代 first-review + second-review，专注爽点密度/节奏感/章末钩子/打脸质量/升级展示 |
| **final-editor** | 爽文/番茄定稿人 | 裁定标准更宽松：有爽点+有钩子+字数达标→通过 |
| **reviser** | 爽文/番茄返修员 | 重点修复：爽点不足/缺少钩子/开头无冲突/节奏拖沓/打脸不够爽 |
| **polisher** | 润色师 | 同长篇 |
| **material-manager** | 素材管理员 | 活跃素材上限80个，每章最多新建2个，3章未提及必须归档 |
| **reader** | 阅读者 | 以追更爽文读者视角评价，容忍度高但绝不容忍水字数/重复/主角装逼失败/反派无脑 |
| **adjuster** | 调整员 | 番茄短篇模式限制每次最多2条writer规则+1条review规则+1条material更新 |

### 2.2 Agent 提示词架构

系统采用 **提示词基座 + 角色提示词 + 约束注入** 三层架构：

```
┌─────────────────────────────────────┐
│  FOUNDATION_PROMPT (v3.0)           │  ← 通用红线/质量基线/输出格式
│  - 角色与边界                        │
│  - 绝对红线（格式污染/逻辑越界/字数） │
│  - 质量基线（内部自检清单）           │
│  - 藏经阁技法使用规范                 │
│  - 输出格式                          │
├─────────────────────────────────────┤
│  AGENT_PROMPTS[agentType].system    │  ← 角色专属提示词
│  - 具体审核维度/写作规则/禁止事项      │
├─────────────────────────────────────┤
│  buildConstraintInjection()         │  ← 项目级写作约束注入
│  - TIER1: 逐条展开（锚点机制/立场撕裂）│
│  - TIER2: 标签列举（世界观一致等）     │
│  - TIER3: 注意项（出场铺垫/打脸节奏）  │
└─────────────────────────────────────┘
```

### 2.3 写作约束预设（33项）

系统内置 33 项可配置写作约束，分三个优先级层级：

**TIER1（逐条展开注入）：**
不降智 / 角色深度 / 主角主动 / 锚点机制 / 立场撕裂 / 疯魔有代价 / 画面战斗 / 冲突前置 / 章末钩子 / 对话真实 / 剧情原创 / 伏笔管理 / 蛛网伏笔 / 渐进感情 / 具象反派 / 被误解救世主 / 利益交换转变 / 情感闭环伏笔 / 苦涩默契 / 以小见大世界观 / 蒙太奇叙事

**TIER2（标签列举）：**
世界观一致 / 角色定位一致 / 战力不崩 / 不降智 / 不乱发挥 / 拒绝机械降神 / 苦涩幽默 / 节奏递进 / 读者爽感

**TIER3（注意项）：**
出场铺垫 / 打脸节奏 / 力量幻想

---

## 三、流水线执行流程

### 3.1 单章完整流程

```
┌──────────────────────────────────────────────────────────────────┐
│                    runFullPipeline(projectId, chapterId)          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 前置准备                                                     │
│     ├─ 获取项目模式 (novel/shuangwen/tomato-short)               │
│     ├─ 初始化熔断器 (CircuitBreaker)                              │
│     ├─ 生成章节意图 (intent-planner)                              │
│     │   ├─ 获取 Hook Agenda (伏笔预算)                            │
│     │   ├─ 获取 Rule Stack (规则栈)                               │
│     │   └─ 输出: Goal/MustKeep/MustAvoid/ConflictDesign/HookPlan │
│     └─ 同步伏笔素材 → HookBudget, 规则素材 → RuleStack           │
│                                                                  │
│  2. 写作-审核循环 (最多5轮/3轮)                                   │
│     ┌──────────────────────────────────────────────────┐         │
│     │  Round 1:                                        │         │
│     │    writer → first-review → second-review → final-editor   │
│     │    (爽文: writer → fast-review → final-editor)            │
│     │                                                  │         │
│     │  Round 2+ (审核未通过时):                         │         │
│     │    字数不足 → writer (全量重写)                    │         │
│     │    字数达标 → reviser (精准局部修改)               │         │
│     │    → first-review/fast-review → final-editor     │         │
│     └──────────────────────────────────────────────────┘         │
│                                                                  │
│  3. 定稿通过后                                                    │
│     ├─ polisher (润色，字数比例0.9-1.1)                           │
│     ├─ material-manager (素材更新 + 归档 + 伏笔追踪)              │
│     ├─ stateSnapshot (状态快照)                                   │
│     ├─ memory.updateAfterChapter (记忆层更新)                     │
│     ├─ hookBudget.updateHooksFromContent (伏笔自动检测)           │
│     ├─ versionControl.createVersionTag (版本标签)                 │
│     └─ metricsCollector.recordChapterDuration (指标记录)          │
│                                                                  │
│  4. 每5章额外执行                                                 │
│     ├─ reader (阅读者评审)                                        │
│     └─ adjuster (调整员修改规则)                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 runAgent 执行细节

每个 Agent 调用都经过以下流程：

```
1. 构建 ContextBudget（根据模型上下文长度）
2. 分配 Token 槽位（按优先级从高到低）：
   agent_prompt(100) > worldview_materials(99) > character_materials(99)
   > style_guidance(98) > constraint_rules(95) > memory_context(90)
   > other_materials(80) > chapter_outline(75) > previous_chapter(70)
   > foreshadowing(65) > character_states(60) > review_feedback(55)
   > technique_injection(53) > beat_allocation(52) > style_template(50)
   > chapter_content(45)
3. 超出预算的槽位自动截断，critical槽位可抢占低优先级
4. 组装 system prompt + user prompt
5. 调用 LLM API
6. 上下文溢出时自动压缩重试，再失败回退 LM Studio
7. 记录 Agent 耗时和 Token 用量
```

### 3.3 熔断器机制

```
连续失败3次 → 熔断激活
  ├─ temperature +0.15（增加创作多样性）
  ├─ 强制启用 polisher
  └─ 冷却期2章后自动恢复

成功1次 → 重置计数器
```

---

## 四、核心子系统

### 4.1 分层记忆系统（Memory System）

5层记忆架构，模拟人类创作记忆：

| 层级 | 名称 | 内容 | 优先级 | 衰减率 | 触达提升 |
|------|------|------|--------|--------|----------|
| L0 | core（核心） | 世界观规则 + 战力体系 + 核心人物 | 100 | 0（永不衰减） | - |
| L1 | active（活跃） | 人物状态 + 关系状态 + 装备状态 + 成长履历 | 80 | 0.02/章 | +100 |
| L2 | recent（近期） | 近5章摘要 + 活跃任务 + 未回收伏笔 | 60 | 0.05/章 | +100 |
| L3 | archive（归档） | 历史相关章节 + 已归档素材（关键词匹配） | 40 | 0.10/章 | - |
| L4 | compressed（压缩） | 卷级摘要（每30章一卷） | 20 | 0.15/章 | - |

**记忆组装流程：**
```
assembleContext(projectId, chapterNumber)
  1. 加载 L0 → 不超预算则完整注入，否则压缩
  2. 加载 L1 → 按关键词/提及角色过滤相关性
  3. 加载 L2 → 近N章摘要（超长上下文10章，普通5章）
  4. 加载 L4 → 当前卷+相邻卷摘要
  5. 加载 L3 → 剩余预算允许时注入历史相关记忆
```

**衰减与压缩：**
- 每章完成后对所有层执行衰减计算
- recencyScore < 30% 触发压缩
- L1 压缩：只保留前5个角色+前3个关系
- L2 压缩：只保留近2章摘要+紧急度>50的伏笔
- L3 压缩：只保留前3个历史+前5个归档素材
- L4 压缩：只保留当前卷+前一卷

### 4.2 上下文预算系统（ContextBudget）

根据模型上下文窗口大小自动分配 Token 预算：

| 模型类别 | 代表模型 | 上下文长度 | 优先级方案 |
|----------|----------|-----------|-----------|
| 紧凑型 | MiniMax-M2.7, GPT-4o-mini | ≤40K | COMPACT_PRIORITIES |
| 长上下文 | Qwen3.5-Plus, Qwen-Long | 80K-256K | LONG_PRIORITIES |
| 超长上下文 | Qwen3.6-Plus, Qwen3-30B-A3B | 256K-800K | ULTRA_LONG_PRIORITIES |

**Token 估算公式：**
```
中文: 字数 × 1.5
英文: 字数 × 0.5
混合: 中文字数 × 1.5 + (总字数 - 中文字数) × 0.5
```

**关键机制：**
- 每个槽位有最大占比限制（maxRatio）
- critical 标记的槽位可抢占低优先级槽位空间
- 超出预算自动截断（truncateToTokens）
- 上下文溢出时自动压缩重试

### 4.3 伏笔预算系统（HookBudget）

控制伏笔数量和回收节奏，防止"挖坑不填"：

| 参数 | 长篇 | 爽文 | 番茄短篇 |
|------|------|------|----------|
| 最大活跃伏笔 | 12 | 12 | 12 |
| 过期阈值 | 30章 | 10章 | 8章 |
| 紧急阈值 | 5章 | 3章 | 2章 |

**15种伏笔类型：**
身份悬念 / 历史谜团 / 能力异常 / 角色深度 / 角色动机 / 角色变化 / 世界秘密 / 真相揭示 / 物品线索 / 能力展示 / 威胁逼近 / 同伴建立 / 势力博弈 / 伏笔铺垫 / 情感暗线

**Hook Agenda 生成：**
```
generateHookAgenda(currentChapter)
  → mustAdvance: 5章未推进的伏笔（必须推进）
  → eligibleResolve: 接近回收窗口的伏笔（可回收）
  → staleDebt: 超过过期阈值的伏笔（必须优先处理）
  → avoidNewFamilies: 禁止新增的伏笔类型
  → budget: 容量状态（active/max/remaining）
```

**自动检测：**
- 每章完成后扫描正文，匹配伏笔关键词
- 检测回收模式（真相揭示/破局/反转等）
- 语义验证排除误判（"揭开锅盖"不是伏笔回收）
- 自动检测新伏笔线索并注册

### 4.4 规则栈系统（RuleStack）

4层规则优先级，防止低层规则覆盖高层：

| 层级 | 名称 | 优先级 | 范围 | 示例 |
|------|------|--------|------|------|
| L1 | hard_facts | 100 | 全局 | 世界观铁律、战力体系规则 |
| L2 | author_intent | 80 | 全书 | 创作方向、主题基调、角色核心定位 |
| L4 | current_task | 70 | 当前章节 | 写作指令、审核反馈、即时调整 |
| L3 | planning | 60 | 当前卷 | 卷级大纲、章节大纲、情节走向 |

**覆盖约束（OVERRIDE_EDGES）：**
- L4 可覆盖 L3（审核反馈可修改大纲走向）
- L4 不可覆盖 L2/L1（不能违背创作方向和世界观铁律）
- L3 不可覆盖 L2/L1
- L2 不可覆盖 L1

**自动规则提取：**
- 从世界观/战力素材中提取禁止规则 → 注入 L1
- 从核心角色素材中提取性格特质 → 注入 L2

### 4.5 节拍分配系统（BeatAllocator）

为每章分配叙事节拍，指导写作节奏：

| 模式 | 每章节拍数 | 节拍模式 | 必需节拍 | 章末节拍 |
|------|-----------|----------|----------|----------|
| novel | 3-6 | setup→tension→escalation→climax→resolution | setup, climax | hook |
| shuangwen | 4-7 | setup→provocation→escalation→reversal→face_slap→aftermath | provocation, face_slap | hook |
| tomato-short | 5-8 | hook→setup→tension→escalation→climax→twist→resolution | hook, climax, twist | cliffhanger |

每个节拍自动关联技法提示（如 setup→氛围式开头/环境映射法/逐步揭示法）。

### 4.6 藏经阁系统（TechIndex）

基于 BM25 算法的写作技法检索引擎：

**存储结构：**
```
server/data/library/
  ├── index.json          ← 扁平索引（所有技法的元数据）
  ├── leaf/               ← 叶子文件（按部门/子类/序号组织）
  │   ├── 00_叙事之魂部/
  │   │   ├── 00_叙事之魂部_01_故事母题_01.json
  │   │   └── ...
  │   ├── 01_顶层设计部/
  │   ├── 02_情节引擎部/
  │   ├── 03_人物熔炉部/
  │   ├── 04_对白艺术部/
  │   ├── 05_文笔滤镜部/
  │   └── 06_世界构建部/
  └── metadata/           ← 技法元数据（成功率/使用次数/自动禁用标记）
```

**7大部类：**
1. 叙事之魂部：故事母题 / 高概念内核 / 叙事模型 / 读者心理操控 / 情感巅峰设计
2. 顶层设计部：故事模型 / 叙事视角 / 时间线设计 / 开篇设计 / 结尾设计 / 章节结构 / 情感节奏设计
3. 情节引擎部：冲突类型 / 悬念编码 / 反转设计 / 伏笔与呼应 / 高潮设计 / 节拍与节奏 / 因果链设计
4. 人物熔炉部：人物出场塑造 / 人物标签系统 / 人物源动力 / 人物关系网 / 人物弧光 / 配角功能化 / 群像设计
5. 对白艺术部：对白功能 / 潜台词设计 / 角色语言区分 / 多人对话调度 / 特殊对话场景 / 对白与叙述衔接
6. 文笔滤镜部：句式与节奏 / 感官调度 / 修辞系统 / 描写技法 / 叙事腔调 / 文字质感
7. 世界构建部：世界规则 / 规则揭示方式 / 空间构建 / 历史纵深感 / 日常生活 / 权力结构

**BM25 参数：** K1=1.5, B=0.75, IDF_SMOOTHING=0.5

**技法注入流程：**
1. 根据 Agent 类型和模式筛选适用技法
2. 取前5条技法格式化注入提示词
3. 每章至少体现1项注入技法
4. 技法成功率过低时自动禁用（auto_disabled）

### 4.7 验证引擎（ValidationEngine）

平台合规验证 + 技法效果追踪：

| 平台 | 最低字数 | 最高字数 | 对话占比上限 | 特殊要求 |
|------|----------|----------|-------------|----------|
| 番茄小说 | 800 | 3500 | 40% | 禁止重复章节标题 |
| 七猫小说 | 1000 | 50000 | 50% | - |
| 番茄短篇 | 1850 | 2150 | 28% | 禁止章节标题，需读者触发点(7/14章) |

**人物素材验证：**
- 必须包含：核心欲望 / 内在矛盾 / 行为模式
- 缺少则警告但不阻塞

**技法效果追踪：**
- 记录每次技法使用的成功/失败
- 成功率持续偏低 → 自动禁用
- 禁用后不再注入提示词

### 4.8 版本控制系统（VersionControl）

每章定稿后自动创建版本标签：

```
标签格式: ch{章节号}_v{版本号}_{时间戳}
示例: ch1_v1_1714473600000

功能:
- 创建版本快照（内容+元数据）
- 列出历史版本
- 回滚到指定版本
- 最多保留20个版本标签
```

### 4.9 指标收集系统（MetricsCollector）

收集流水线运行指标用于优化：

| 指标类型 | 记录内容 |
|----------|----------|
| Agent 耗时 | 每次调用的耗时(ms)、Token用量、平均/最大耗时 |
| 审核通过率 | 每个审核步骤的通过/总数 |
| 章节耗时 | 每章总耗时、轮次数 |
| 错误计数 | 每种Agent的错误类型和次数 |

### 4.10 状态快照系统（StateSnapshot）

每章完成后自动拍摄状态快照：

```
快照内容:
- characterStates: 所有角色的位置/状态/战力/情绪/最后出场章节
- relationshipStates: 所有人物关系的类型/强度/最后变化章节
- equipmentStates: 所有装备的持有者/状态
- growthMilestones: 成长里程碑
```

---

## 五、多平台发布系统

### 5.1 支持平台

| 平台 | 代号 | 作者后台URL |
|------|------|------------|
| 番茄小说 | fanqie | https://fanqienovel.com/main/writer/book-manage |
| 七猫小说 | qimao | https://zuozhe.qimao.com |
| 抖音小说 | douyin | https://creator.douyin.com/creator-micro/content/publish |
| 掌阅 iReader | zhangyue | https://writer.zhangyue.com |
| 书旗小说 | shuqi | https://writer.shuqi.com |

### 5.2 发布流程

```
1. 连接浏览器（支持CDP远程连接）
2. 登录验证（检测登录指示词）
3. 逐章发布：
   a. 导航到章节管理页
   b. 点击新建章节
   c. 填写章节序号（"第 X 章"格式）
   d. 填写章节标题
   e. 填写正文内容（逐字符输入，5ms/字）
   f. 处理弹窗（敏感词提醒等）
   g. 保存/发布
4. 发布后验证
5. 截图记录
```

### 5.3 敏感词防护（SensitiveWordGuard）

发布前自动扫描内容，检测并替换敏感词，避免触发平台审核。

---

## 六、前端页面体系

### 6.1 页面列表

| 页面 | 文件 | 功能 |
|------|------|------|
| Dashboard | Dashboard.jsx | 项目总览、快速操作 |
| ChaptersPage | ChaptersPage.jsx | 章节管理、大纲编辑、批量操作 |
| PipelinePage | PipelinePage.jsx | 流水线执行控制、实时进度、审核反馈 |
| LibraryPage | LibraryPage.jsx | 藏经阁（树状结构浏览技法） |
| MaterialsPage | MaterialsPage.jsx | 素材库（树状结构管理素材） |
| PublishPage | PublishPage.jsx | 多平台发布控制、发布日志 |
| AgentsPage | AgentsPage.jsx | Agent配置、提示词覆盖、模型选择 |
| KnowledgePage | KnowledgePage.jsx | 知识库管理 |
| MapPage | MapPage.jsx | 世界观地图 |
| TimelinePage | TimelinePage.jsx | 时间线/事件线 |
| WorkshopPage | WorkshopPage.jsx | 工作台 |
| SettingsPage | SettingsPage.jsx | 系统设置、API密钥管理 |
| StyleTemplatesPage | StyleTemplatesPage.jsx | 风格模板管理 |
| GuidePage | GuidePage.jsx | 使用指南 |
| ComicConfigPage | ComicConfigPage.jsx | 漫画配置 |
| ComicStoryboardPage | ComicStoryboardPage.jsx | 漫画分镜 |
| ComicRenderPage | ComicRenderPage.jsx | 漫画渲染 |
| ComicExportPage | ComicExportPage.jsx | 漫画导出 |
| ComicWorkflowsPage | ComicWorkflowsPage.jsx | 漫画工作流 |

### 6.2 树状结构 UI

藏经阁和素材库页面采用统一的树状结构：

```
▼ 📂 叙事之魂部 (7)
    ▼ 📁 故事母题 (7)
        📄 故事母题_01
        📄 故事母题_02
        ...
    ▼ 📁 高概念内核 (6)
        📄 高概念内核_01
        ...
```

- 左侧树状导航，右侧详情面板
- 支持展开/折叠
- 素材支持锁定🔒和归档状态标记●
- 藏经阁支持搜索和按部门/子类筛选

---

## 七、后端 API 路由

| 路由文件 | 前缀 | 主要端点 |
|----------|------|----------|
| projects.js | /api/projects | CRUD项目、模式切换 |
| chapters.js | /api/chapters | CRUD章节、大纲编辑 |
| pipeline.js | /api/pipeline | 执行流水线、获取状态 |
| agents.js | /api/agents | Agent配置、提示词覆盖 |
| materials.js | /api/materials | 素材CRUD、归档、搜索 |
| library.js | /api/library | 藏经阁技法检索、元数据 |
| publish.js | /api/publish | 多平台发布控制 |
| reviews.js | /api/reviews | 审核记录查询 |
| knowledge.js | /api/knowledge | 知识库管理 |
| map.js | /api/map | 世界观地图 |
| settings.js | /api/settings | 系统设置 |
| style-templates.js | /api/style-templates | 风格模板CRUD |
| quests.js | /api/quests | 任务/支线管理 |
| workshop.js | /api/workshop | 工作台 |
| comic.js | /api/comic | 漫画相关 |
| guide.js | /api/guide | 使用指南 |
| franchises.js | /api/franchises | 系列管理 |
| worldview-profiles.js | /api/worldview-profiles | 世界观档案 |

---

## 八、MCP Agent 扩展

系统支持通过 MCP（Model Context Protocol）扩展 Agent：

```
mcp-agents/
  ├── writer/           ← 执笔人 MCP 服务
  │   ├── manifest.json
  │   ├── server.js
  │   └── icon.svg
  ├── first-review/     ← 初审 MCP 服务
  ├── second-review/    ← 复审 MCP 服务
  ├── final-editor/     ← 定稿人 MCP 服务
  └── material-manager/ ← 素材管理员 MCP 服务
```

每个 MCP Agent 包含：
- `manifest.json`：Agent 元数据（名称、描述、能力声明）
- `server.js`：MCP 服务端实现
- `icon.svg`：Agent 图标

---

## 九、数据存储结构

```
server/data/
  ├── library/              ← 藏经阁数据
  │   ├── index.json        ← 技法索引
  │   ├── leaf/             ← 技法叶子文件（7大部类）
  │   └── metadata/         ← 技法元数据（成功率/使用记录）
  └── (其他数据通过 store.js 管理)

store.js 管理的集合:
  - projects        ← 项目（含模式/约束/规则栈/伏笔预算/指标等）
  - chapters        ← 章节（含大纲/正文/审核输出/版本标签/历史）
  - materials       ← 素材（含类型/内容/版本/归档状态/变更日志）
  - reviews         ← 审核记录
  - quests          ← 任务/支线
  - timelines       ← 时间线事件
  - api-keys        ← API密钥配置
  - style-templates ← 风格模板
  - memory-layers   ← 记忆层数据
  - version-snapshots ← 版本快照
  - state-snapshots ← 状态快照
```

---

## 十、系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          前端 (React + Vite)                            │
│  Dashboard │ Chapters │ Pipeline │ Library │ Materials │ Publish │ ... │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ REST API
┌──────────────────────────────────┴──────────────────────────────────────┐
│                          后端 (Express.js)                               │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Pipeline    │  │  Memory     │  │  ContextBudget│  │  HookBudget  │ │
│  │  Controller  │  │  System     │  │  Manager      │  │  System      │ │
│  │  (5层Agent)  │  │  (5层记忆)  │  │  (Token分配)  │  │  (伏笔管理)  │ │
│  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                  │         │
│  ┌──────┴───────┐  ┌──────┴──────┐  ┌──────┴───────┐  ┌──────┴───────┐ │
│  │  RuleStack   │  │  TechIndex  │  │  BeatAllocator│  │  Validation  │ │
│  │  (4层规则)   │  │  (BM25检索) │  │  (节拍分配)   │  │  Engine      │ │
│  └──────────────┘  └─────────────┘  └──────────────┘  └──────────────┘ │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │  Circuit     │  │  Version     │  │  Metrics     │  │  MultiPlatform││
│  │  Breaker     │  │  Control     │  │  Collector   │  │  Publisher   ││
│  │  (熔断器)    │  │  (版本控制)  │  │  (指标收集)  │  │  (多平台发布)││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Sensitive   │  │  State       │  │  Chapter     │                   │
│  │  WordGuard   │  │  Snapshot    │  │  Intent      │                   │
│  │  (敏感词)    │  │  (状态快照)  │  │  Planner     │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        LLM Service (llm.js)                      │    │
│  │  MiniMax │ LM Studio │ 通义千问 │ DeepSeek │ GPT-4o │ Moonshot │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Store (JSON File Storage)                     │    │
│  │  projects │ chapters │ materials │ reviews │ quests │ timelines  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 十一、关键文件索引

| 文件路径 | 职责 |
|----------|------|
| `server/services/agentPrompts.js` | 所有Agent提示词定义、约束预设、提示词基座 |
| `server/services/pipeline.js` | 流水线核心：Agent调度、上下文组装、流程控制 |
| `server/services/memory.js` | 5层记忆系统：组装、衰减、压缩、格式化 |
| `server/services/contextBudget.js` | 上下文预算：Token分配、截断、模型适配 |
| `server/services/hookBudget.js` | 伏笔预算：容量管理、Agenda生成、自动检测 |
| `server/services/ruleStack.js` | 规则栈：4层优先级、覆盖约束、合规检查 |
| `server/services/beatAllocator.js` | 节拍分配：3种模式节拍模板、技法绑定 |
| `server/services/techIndex.js` | 藏经阁索引：BM25检索、技法注入 |
| `server/services/validationEngine.js` | 验证引擎：平台合规、人物验证、技法追踪 |
| `server/services/reviewCircuitBreaker.js` | 熔断器：连续失败检测、温度调整、冷却恢复 |
| `server/services/versionControl.js` | 版本控制：标签创建、快照、回滚 |
| `server/services/metricsCollector.js` | 指标收集：Agent耗时、通过率、错误统计 |
| `server/services/multiPlatformPublisher.js` | 多平台发布：Playwright自动化、5平台支持 |
| `server/services/sensitiveWordGuard.js` | 敏感词防护：预扫描、替换 |
| `server/services/chapterIntent.js` | 章节意图规划：Goal/MustKeep/MustAvoid生成 |
| `server/services/contentUtils.js` | 内容工具：去重、截断、清理、番茄指标验证 |
| `server/services/llm.js` | LLM调用：多模型适配、上下文溢出处理 |
| `server/services/stateSnapshot.js` | 状态快照：角色/关系/装备状态记录 |
| `server/services/consistency.js` | 一致性检查 |
| `server/services/materialIndex.js` | 素材索引 |
| `server/services/materialValidator.js` | 素材验证 |
| `server/services/reviewRemediation.js` | 审核补救 |
| `server/services/contextTrace.js` | 上下文追踪 |
| `server/services/trendingSearch.js` | 热搜注入 |
| `server/services/fileOutput.js` | 文件输出管理 |
| `server/services/jsonUtils.js` | JSON提取工具 |
| `client/src/pages/LibraryPage.jsx` | 藏经阁前端（树状结构） |
| `client/src/pages/MaterialsPage.jsx` | 素材库前端（树状结构） |
| `client/src/pages/PipelinePage.jsx` | 流水线控制前端 |
| `client/src/pages/PublishPage.jsx` | 发布页面前端 |
| `client/src/store/useAppStore.js` | 前端状态管理（Zustand） |
