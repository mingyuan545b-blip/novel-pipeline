# Novel-Pipeline 系统完整参考手册

> 本文档供AI或其他开发者使用，可直接根据此文档输出符合规范的范本JSON和素材数据。

---

## 一、系统概述

Novel-Pipeline 是一个多Agent协作的小说自动生成系统。核心流程：**意图规划 → 执笔人写作 → 多轮审核 → 定稿 → 润色 → 素材管理**，通过约束预设和风格配置确保AI写作质量。

### 三种运行模式

| 模式 | mode值 | 审核链 | 适用场景 |
|------|--------|--------|----------|
| 长篇 | `novel` | 初审→复审→定稿人 | 正式长篇小说 |
| 爽文 | `shuangwen` | 快审→定稿人 | 网文爽文 |
| 番茄短篇 | `tomato-short` | 快审→定稿人 | 短篇快节奏 |

---

## 二、Agent职责清单

### 2.1 核心Agent（必须配置）

| agentType | 角色 | 职责 | 输入 | 输出 |
|-----------|------|------|------|------|
| `intent-planner` | 意图规划师 | 每章写作前生成结构化意图：Goal/MustKeep/MustAvoid/HookAdvance | 大纲+素材+伏笔预算+规则栈 | JSON意图对象 |
| `writer` | 执笔人 | 根据意图+素材+约束写作章节正文 | 意图+素材+上下文+约束 | 章节正文 |
| `first-review` | 初审 | 检查基础质量：逻辑/角色/设定/伏笔 | 正文+约束 | {approved, issues, suggestions, edits} |
| `second-review` | 复审 | 检查逻辑/字数/风格/冗余/伏笔 | 正文+初审反馈+约束 | {approved, issues, suggestions, edits} |
| `final-editor` | 定稿人 | 最终审核，决定通过/返修 | 正文+所有审核反馈+约束 | {approved, issues, suggestions, edits, materialGuidance} |
| `material-manager` | 素材管理员 | 定稿后提取/更新/归档素材 | 正文+素材库+materialGuidance | 素材变更列表 |
| `polisher` | 润色师 | 定稿后文采润色（不改剧情） | 正文 | 润色后正文 |

### 2.2 辅助Agent（可选配置）

| agentType | 角色 | 职责 | 触发条件 |
|-----------|------|------|----------|
| `fast-review` | 快审 | 快速审核爽点密度和节奏 | 爽文/番茄模式替代初审+复审 |
| `reviser` | 返修员 | 根据审核反馈精准局部修改 | 定稿人未通过时 |
| `reader` | 阅读者 | 以真实读者视角发现硬伤 | 定稿人通过后（可选） |
| `adjuster` | 调整员 | 根据读者反馈修改写作规则 | 阅读者发现硬伤时 |

### 2.3 Agent输出格式规范

所有审核Agent必须输出JSON：

```json
{
  "approved": true/false,
  "summary": "审核摘要",
  "issues": [
    { "type": "logic|character|setting|pacing|foreshadow", "severity": "critical|major|minor", "description": "问题描述", "location": "位置", "suggestion": "修改建议" }
  ],
  "suggestions": ["改进建议1", "改进建议2"],
  "edits": [
    { "original": "原文片段", "revised": "修改后片段", "reason": "修改原因" }
  ]
}
```

定稿人额外输出：
```json
{
  "approved": true,
  "materialGuidance": "素材管理指导（哪些素材需更新/新增/归档）"
}
```

---

## 三、Pipeline流程

### 3.1 长篇模式（novel）

```
意图规划 → 执笔人 → 初审 → [通过?]
                              ├─ 是 → 复审 → [通过?]
                              │         ├─ 是 → 定稿人 → [通过?]
                              │         │         ├─ 是 → 润色师 → 素材管理员 → ✓完成
                              │         │         └─ 否 → 返修员 → 回到定稿人
                              │         └─ 否 → 返修员 → 回到复审
                              └─ 否 → 返修员 → 回到初审
```

### 3.2 爽文/番茄模式（shuangwen/tomato-short）

```
执笔人 → 快审 → [通过?]
                  ├─ 是 → 定稿人 → [通过?]
                  │         ├─ 是 → 润色师 → 素材管理员 → ✓完成
                  │         └─ 否 → 返修员 → 回到定稿人
                  └─ 否 → 返修员 → 回到快审
```

### 3.3 章节状态流转

```
outlined → written → first-reviewing → second-reviewing → final-editing → approved → material-updated
   ↑          ↓            ↓                 ↓                  ↓
   └─── (返修重置) ────←───┘                 │                  │
                                              │         failed-skipped (冷却30分钟)
                                       timeout-skipped (冷却60分钟)
```

### 3.4 无限流水线

自动选择状态为 `outlined` 或 `draft` 的章节依次处理，直到所有章节完成。

---

## 四、约束预设完整清单

### 4.1 通用约束（适用于所有类型）

| ID | 名称 | 描述 |
|----|------|------|
| `no-derailment` | 不降智 | 角色不得智商断崖式下降，反派不能为剧情变蠢 |
| `character-consistency` | 角色定位一致 | 角色行为和说话方式必须符合自身定位 |
| `worldview-consistency` | 世界观一致 | 不出现与世界观无关的元素，所有设定必须自洽 |
| `dialogue-authentic` | 对话真实 | 对话必须符合角色身份，不同角色说话方式有区分度 |
| `hook-every-chapter` | 章末钩子 | 每章结尾必须设置悬念或钩子 |
| `fast-escalation` | 节奏递进 | 每3-5章一个小高潮，每10-15章一个大高潮 |
| `reader-satisfaction` | 读者爽感 | 主角必须频繁获得成就感，不得连续3章没有爽点 |
| `no-deus-ex` | 拒绝机械降神 | 不得用巧合/天降解决核心冲突 |
| `no-random-plot` | 不乱发挥 | 剧情必须基于已有设定和伏笔推进 |
| `proper-introduction` | 出场铺垫 | 重要角色出场前必须有铺垫 |
| `foreshadow-manage` | 伏笔管理 | 已埋伏笔必须在10-30章内回收或推进 |
| `character-depth` | 角色深度 | 主角必须有情感波动和内心挣扎 |
| `plot-originality` | 剧情原创 | 战斗描写差异化，禁止模板化台词 |
| `protagonist-proactive` | 主角主动 | 主角必须主动发起行动和决策 |

### 4.2 爽文专用约束

| ID | 名称 | 描述 |
|----|------|------|
| `face-slapping` | 打脸节奏 | 被打脸者必须先充分嚣张，再被主角碾压 |
| `power-fantasy` | 力量幻想 | 主角成长必须有明确的数值/等级/称号体现 |
| `power-consistency` | 战力不崩 | 战力体系前后一致，不得膨胀或崩坏 |
| `conflict-first` | 冲突前置 | 每章前300字必须有冲突/爽点/钩子 |
| `concrete-villain` | 具象反派 | 必须有持续在线的具象化反派 |

### 4.3 萌宝/萌娃专用约束

| ID | 名称 | 描述 |
|----|------|------|
| `baby-perspective-only` | 纯萌宝视角 | 全文必须以三岁幼崽视角叙事，严禁成人化内心独白 |
| `no-adult-inner-voice` | 禁成人内心戏 | 幼崽不得有成人式内心独白，内心只能是：好饿/好怕/好吃/要抱抱 |
| `cute-first-always` | 萌感优先 | 所有场景必须先考虑萌感，幼崽的强大=天真行为造成意外效果 |
| `simple-readable-style` | 简单好读 | 文风简单好读，句子短、段落短、节奏流畅 |

### 4.4 悬疑专用约束

| ID | 名称 | 描述 |
|----|------|------|
| `spider-web-foreshadow` | 蛛网伏笔 | 伏笔如蛛网交织，每一条线都连着另一条 |
| `small-detail-worldview` | 以小见大世界观 | 世界观用日常细节呈现而非NPC讲解 |
| `stance-conflict` | 立场撕裂 | 没有绝对正邪，只有立场碰撞 |
| `emotional-closure-foreshadow` | 情感闭环伏笔 | 伏笔回收不是"揭开答案"而是"情感闭环" |

### 4.5 其他高级约束

| ID | 名称 | 描述 |
|----|------|------|
| `anchor-mechanism` | 锚点机制 | 每个角色都有"锚"——维持人性的核心纽带 |
| `bitter-camaraderie` | 苦涩默契 | 队友调侃缓解沉重但调侃背后是恐惧和疲惫 |
| `bitter-humor` | 苦涩幽默 | 绝境中的冷笑话和苦涩调侃 |
| `interest-exchange-transform` | 利益交换转变 | 角色关系转变基于利益/逻辑交换，不是被感化 |
| `madness-has-cost` | 疯魔有代价 | 主角的"疯魔/爆发"状态必须有身体崩溃的代价 |
| `misunderstood-savior` | 被误解救世主 | 主角被守护的人误解/恐惧/唾弃 |
| `montage-narrative` | 蒙太奇叙事 | 多势力同时行动时快速切换视角增强张力 |
| `slow-burn-romance` | 渐进感情 | 感情线必须靠事件推动，禁止突兀告白/倒贴 |
| `vivid-combat` | 画面战斗 | 战斗描写必须有画面感：具体动作+感官冲击+代价反馈 |

---

## 五、风格配置规范

### 5.1 风格配置结构

```json
{
  "key": "风格唯一标识（如：萌宝、爽文、甜宠、悬疑）",
  "label": "风格显示名",
  "description": "风格描述",
  "povRule": "视角规则（第一人称/第三人称/幼崽视角等）",
  "dialogueRule": "对话规则（语言风格/禁忌/区分度要求）",
  "behaviorRule": "行为规则（角色行为驱动/禁忌行为）",
  "toneRule": "文风规则（句子长度/段落节奏/描写偏好）",
  "reviewFocus": "审核检查清单（逐项检查，缺一不可）",
  "materialFocus": "素材管理重点（哪些素材类型需重点关注）",
  "constraintOverrides": ["关联约束ID列表"]
}
```

### 5.2 已有风格配置

| key | 名称 | 适用类型 | 关联约束 |
|-----|------|----------|----------|
| `萌宝` | 萌宝文 | 幼崽视角小说 | baby-perspective-only, no-adult-inner-voice, cute-first-always, simple-readable-style, dialogue-authentic, character-consistency, worldview-consistency, hook-every-chapter, fast-escalation, reader-satisfaction, face-slapping |
| `萌娃变废为宝` | 植物系躺平萌宝·变废为宝 | 萌娃变废为宝 | 同萌宝 |
| `爽文` | 爽文 | 网文爽文 | no-derailment, character-consistency, worldview-consistency, hook-every-chapter, fast-escalation, reader-satisfaction, face-slapping, power-fantasy |
| `甜宠` | 甜宠文 | 甜宠言情 | no-derailment, character-consistency, slow-burn-romance, dialogue-authentic, hook-every-chapter |
| `悬疑` | 悬疑文 | 悬疑推理 | no-derailment, character-consistency, worldview-consistency, foreshadow-manage, spider-web-foreshadow, no-deus-ex, no-random-plot |

---

## 六、素材类型规范

### 6.1 标准素材类型

| type | 名称 | 必须包含 | 示例 |
|------|------|----------|------|
| `worldview` | 世界观 | 世界规则、势力分布、历史背景 | 修仙体系、魔法规则 |
| `character` | 角色 | 姓名、性格、外貌、能力、关系 | 主角、反派、配角 |
| `relationship` | 关系 | 角色间关系类型、变化节点 | 师徒、敌对、盟友 |
| `power-system` | 战力体系 | 等级划分、晋升条件、战力对比 | 炼气→筑基→金丹 |
| `equipment` | 装备/道具 | 名称、效果、获取方式 | 神器、法宝 |
| `location` | 地点 | 位置、特征、关联事件 | 宗门、秘境 |
| `catchphrase` | 标志性台词 | 角色名、台词、使用场景 | "我命由我不由天" |
| `famous-scene` | 名场面 | 场景描述、情感核心、伏笔关联 | 破茧成蝶、绝地反击 |
| `growth-history` | 成长轨迹 | 阶段、变化、触发事件 | 菜鸟→高手 |
| `foreshadowing` | 伏笔 | 埋设章节、预期回收章节、状态 | 已埋/已推进/已回收 |
| `index` | 索引 | 素材分类索引 | 角色索引、地点索引 |

### 6.2 素材数据结构

```json
{
  "type": "character",
  "name": "角色名",
  "content": "完整描述内容（支持Markdown）",
  "tags": ["标签1", "标签2"]
}
```

---

## 七、范本JSON完整规范（v1.0）

### 7.1 范本结构

```json
{
  "version": "1.0",
  "project": {
    "name": "项目名称（必填）",
    "description": "项目描述",
    "genre": "题材类型（如：玄幻/都市/萌宝/悬疑）",
    "mode": "novel|shuangwen|tomato-short（必填）",
    "targetChapters": 100,
    "styleTemplateId": "风格模板ID（可选，与styleProfile二选一）",
    "settings": {
      "autoPipeline": false,
      "chapterRounds": 3
    }
  },
  "constraints": [
    "约束预设ID列表（引用已有约束，如：no-derailment, character-consistency）"
  ],
  "newConstraintPresets": [
    {
      "id": "自定义约束ID（必填，唯一）",
      "label": "约束显示名（必填）",
      "desc": "约束描述（必填）",
      "rules": "具体规则内容",
      "injection_point": "writer|first-review|second-review|final-editor（注入点）",
      "department": "分类（如：萌宝/爽文/悬疑）",
      "tier": "TIER1|TIER2|TIER3（优先级）"
    }
  ],
  "styleProfile": {
    "key": "风格唯一标识（必填，如：萌宝、爽文）",
    "label": "风格显示名（必填）",
    "description": "风格描述",
    "povRule": "视角规则（必填）",
    "dialogueRule": "对话规则（必填）",
    "behaviorRule": "行为规则（必填）",
    "toneRule": "文风规则（必填）",
    "reviewFocus": "审核检查清单（必填）",
    "materialFocus": "素材管理重点",
    "constraintOverrides": ["关联约束ID列表"]
  },
  "agentTemplates": [
    {
      "agentType": "writer（必填，见Agent类型清单）",
      "mode": "novel（必填）",
      "role": "角色名（如：执笔人）",
      "tool": "MCP工具名",
      "system": "系统提示词（必填，完整的Agent指令）"
    }
  ],
  "agentOverrides": {
    "writer": "项目级覆盖提示词（可选，覆盖对应agent的system字段）"
  },
  "materials": [
    {
      "type": "素材类型（必填，见素材类型规范）",
      "name": "素材名（必填）",
      "content": "素材内容（必填）",
      "tags": ["标签"]
    }
  ],
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "章节标题",
      "outline": "章节大纲（必填，指导writer写作）"
    }
  ],
  "quests": [
    {
      "name": "任务名",
      "type": "main|sub|side",
      "description": "任务描述",
      "relatedChapters": [1, 2, 3],
      "subQuests": []
    }
  ],
  "timelines": [
    {
      "name": "时间线名",
      "events": [
        { "chapter": 1, "event": "事件描述" }
      ]
    }
  ],
  "mapNodes": [
    {
      "name": "地点名",
      "type": "location|region|building",
      "description": "描述",
      "parentId": null,
      "x": 0,
      "y": 0
    }
  ]
}
```

### 7.2 校验规则

| 节 | 必须 | 校验内容 |
|----|------|----------|
| `version` | 是 | 必须存在 |
| `project` | 是 | name和mode必填，mode必须是novel/shuangwen/tomato-short之一 |
| `constraints` | 是 | 必须为数组，引用的ID应在已有预设中存在或在newConstraintPresets中定义 |
| `newConstraintPresets` | 否 | 每项必须有id、label、desc |
| `styleProfile` | 是 | key和label必填，povRule/dialogueRule/behaviorRule/toneRule/reviewFocus建议填写 |
| `agentTemplates` | 是 | 必须为数组，每项必须有agentType和system，核心Agent（writer/first-review/final-editor/material-manager）建议包含 |
| `agentOverrides` | 否 | 对象，key为agentType，value为覆盖的system提示词 |
| `materials` | 否 | 每项必须有type和name，type应为标准素材类型 |
| `chapters` | 否 | 每项必须有chapterNumber，建议有outline |
| `quests` | 否 | 任务/线索数据 |
| `timelines` | 否 | 时间线数据 |
| `mapNodes` | 否 | 地图节点数据 |

### 7.3 导入行为

- 项目状态直接设为 `outlined`（可立即运行pipeline）
- 已存在的约束预设/风格配置/Agent模板：默认跳过，勾选"覆盖"则更新
- 素材和章节：总是新建
- `agentOverrides`：写入项目的agentOverrides字段

---

## 八、约束注入机制

### 8.1 注入层级

| 层级 | 优先级 | 来源 | 说明 |
|------|--------|------|------|
| TIER1 | 最高 | 基座提示词(foundation-prompts) | 绝对红线，任何情况不可违反 |
| TIER2 | 高 | 约束预设(constraint-presets) | 写作规则，审核参照标准 |
| TIER3 | 中 | 风格配置(style-profiles) | 文风/视角/行为指导 |

### 8.2 注入目标

| Agent | 注入内容 |
|-------|----------|
| writer | TIER1 + TIER2 + TIER3（风格规则+约束规则+基座红线） |
| first-review | TIER1 + TIER2（约束规则作为审核标准） |
| second-review | TIER1 + TIER2 |
| fast-review | TIER1 + TIER2（爽点/节奏相关约束） |
| final-editor | TIER1 + TIER2 + reviewFocus（风格审核清单） |
| material-manager | materialFocus（素材管理重点） |

---

## 九、模块功能清单

### 9.1 已启用模块

| 模块 | 路由 | 功能 |
|------|------|------|
| 仪表盘 | `/` | 项目管理、约束编辑、评测整改、风格指导 |
| 流水线 | `/pipeline` | 章节执行、无限流水线、任务状态、Agent输出 |
| 创作工坊 | `/workshop` | 设定导入、范本导入/导出、小说融合 |
| 素材库 | `/materials` | 素材CRUD、版本管理 |
| 藏经阁 | `/library` | 写作技法库浏览/搜索（仅长篇模式） |
| 时间轴 | `/timeline` | 任务/线索/时间线事件管理（仅长篇模式） |
| 知识库 | `/knowledge` | 记忆金字塔、关系图谱、战力追踪、伏笔管理、一致性校验（仅长篇模式） |
| 世界地图 | `/map` | 多层级地图节点、势力领地（仅长篇模式） |
| 风格模板 | `/style-templates` | 预设/分析/学习/应用（仅长篇模式） |
| 章节管理 | `/chapters` | 章节CRUD、内容查看 |
| 发布中心 | `/publish` | 多平台发布、队列、读者互动 |
| 漫剧系统 | `/comic/*` | ComfyUI配置/工作流/分镜/渲染/导出 |
| Agent配置 | `/agents` | Agent提示词编辑、模板管理、约束预设、风格配置 |
| 系统设置 | `/settings` | API Key、模型配置 |

### 9.2 后端已实现但前端无入口的模块

| 模块 | 功能 | 建议 |
|------|------|------|
| 规则栈(ruleStack) | 4层规则优先级（L1硬事实/L2作者意图/L3规划/L4当前任务） | 可在知识库页面添加入口 |
| Hook预算(hookBudget) | 15种hook类型追踪、过期/紧急判定 | 可在流水线页面添加预算面板 |
| 上下文预算(contextBudget) | token预算分配、16种优先级类别 | 可在流水线页面添加预算面板 |
| 章节意图(chapterIntent) | 章节意图分析 | 可在流水线步骤详情中展示 |
| 世界观档案(worldview-profiles) | 模板化约束/风格/agentOverrides应用 | 可在仪表盘添加入口 |
| 基座提示词(foundation-prompts) | 全局基础提示词管理 | 可在Agent配置页面添加tab |

---

## 十、制作范本的检查清单

当你（AI）为用户制作范本时，必须确保以下内容完整：

### ✅ 必须包含

- [ ] `project.name` — 项目名称
- [ ] `project.mode` — 运行模式（novel/shuangwen/tomato-short）
- [ ] `constraints` — 至少3个约束预设ID（从第四章约束清单中选择）
- [ ] `styleProfile` — 完整的风格配置（povRule + dialogueRule + behaviorRule + toneRule + reviewFocus）
- [ ] `agentTemplates` — 至少4个核心Agent（writer/first-review/final-editor/material-manager）的完整system提示词
- [ ] `materials` — 至少包含世界观(worldview)和主角(character)素材
- [ ] `chapters` — 至少包含前3章的大纲

### ⚠️ 建议包含

- [ ] `newConstraintPresets` — 如果范本需要自定义约束（不在已有36条中）
- [ ] `styleProfile.constraintOverrides` — 风格关联的约束列表
- [ ] `styleProfile.materialFocus` — 素材管理重点
- [ ] `agentOverrides` — 项目级Agent提示词覆盖
- [ ] `quests` — 主线任务和支线任务
- [ ] `timelines` — 时间线事件
- [ ] `mapNodes` — 重要地点

### 🔴 禁止事项

- [ ] 禁止使用不在约束清单中的ID（除非在newConstraintPresets中定义）
- [ ] 禁止styleProfile的key与已有配置重复（除非要覆盖）
- [ ] 禁止agentTemplates的system字段为空或只有角色名
- [ ] 禁止materials的type使用非标准类型
- [ ] 禁止chapters缺少outline字段

---

## 十一、快速制作范本模板

复制以下模板，填入具体内容即可：

```json
{
  "version": "1.0",
  "project": {
    "name": "【填入项目名】",
    "description": "【填入项目描述】",
    "genre": "【填入题材：玄幻/都市/萌宝/悬疑/甜宠等】",
    "mode": "【填入模式：novel/shuangwen/tomato-short】",
    "targetChapters": 100
  },
  "constraints": [
    "no-derailment",
    "character-consistency",
    "worldview-consistency",
    "hook-every-chapter",
    "【根据题材添加更多约束】"
  ],
  "newConstraintPresets": [],
  "styleProfile": {
    "key": "【风格key，如：萌宝/爽文/自定义】",
    "label": "【风格名】",
    "description": "【风格描述】",
    "povRule": "【视角规则：第几人称、叙事逻辑、禁忌】",
    "dialogueRule": "【对话规则：语言风格、禁忌、区分度要求】",
    "behaviorRule": "【行为规则：核心驱动、本能反应、情绪表达】",
    "toneRule": "【文风规则：句子长度、段落节奏、描写偏好】",
    "reviewFocus": "【审核检查清单：逐项列出，缺一不可】",
    "materialFocus": "【素材管理重点】",
    "constraintOverrides": ["关联约束ID列表"]
  },
  "agentTemplates": [
    {
      "agentType": "writer",
      "mode": "novel",
      "role": "执笔人",
      "system": "【完整的writer系统提示词，包含写作规则、输出格式、禁忌事项】"
    },
    {
      "agentType": "first-review",
      "mode": "novel",
      "role": "初审",
      "system": "【完整的初审系统提示词，包含审核检查清单、输出JSON格式】"
    },
    {
      "agentType": "final-editor",
      "mode": "novel",
      "role": "定稿人",
      "system": "【完整的定稿人系统提示词，包含终审标准、materialGuidance输出】"
    },
    {
      "agentType": "material-manager",
      "mode": "novel",
      "role": "素材管理员",
      "system": "【完整的素材管理员系统提示词，包含素材提取/更新/归档规则】"
    }
  ],
  "materials": [
    { "type": "worldview", "name": "【世界观名】", "content": "【完整世界观描述】" },
    { "type": "character", "name": "【主角名】", "content": "【完整角色描述：性格/外貌/能力/背景/动机】" },
    { "type": "character", "name": "【配角名】", "content": "【完整角色描述】" },
    { "type": "relationship", "name": "【关系名】", "content": "【角色间关系描述】" },
    { "type": "power-system", "name": "【战力体系名】", "content": "【等级划分/晋升条件/战力对比】" }
  ],
  "chapters": [
    { "chapterNumber": 1, "title": "【第一章标题】", "outline": "【详细大纲：场景/事件/冲突/爽点/钩子】" },
    { "chapterNumber": 2, "title": "【第二章标题】", "outline": "【详细大纲】" },
    { "chapterNumber": 3, "title": "【第三章标题】", "outline": "【详细大纲】" }
  ],
  "quests": [],
  "timelines": [],
  "mapNodes": []
}
```
