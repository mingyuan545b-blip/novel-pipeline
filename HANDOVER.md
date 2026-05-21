# Novel-Pipeline 系统交接手册

> 本文档为 AI 接手项目的完整交接手册，包含系统架构、核心模块、业务逻辑、踩坑记录、代码规范。
> 配合 `PROJECT_STANDARDS.md`（规范与交付标准）和 `SYSTEM_REFERENCE.md`（系统参考手册）一起阅读。

---

## 一、项目概览

### 1.1 是什么

Novel-Pipeline 是一个**多Agent协作的小说自动生成系统**。用户导入设定范本后，系统自动：
1. 生成素材（角色/世界观/伏笔等）
2. 生成章节大纲
3. 逐章执行：意图规划→执笔人→初审→复审→定稿人→润色→素材更新
4. 无限流水线模式自动推进所有章节

### 1.2 技术栈

| 层 | 技术 | 端口 |
|---|------|------|
| 前端 | React 19 + Vite 8 + Zustand 5 + React Router 7 | 开发模式 5173 |
| 后端 | Express 5 + Node.js | 3001 |
| 数据 | JSON文件持久化（无数据库） | - |
| LLM | LM Studio（本地）+ MiniMax API（云端） | - |

### 1.3 启动方式

```bash
# 后端
cd server && npm start

# 前端（开发模式）
cd client && npm run dev

# 前端（生产构建）
cd client && npm run build
# 构建产物在 client/dist/，后端自动serve
```

### 1.4 数据目录

**关键**：数据不在项目目录内！

```
store.js: DATA_DIR = path.join(__dirname, '..', '..', 'data')
实际路径: C:\Users\mingy\Desktop\trae\data\
```

数据目录结构：
```
C:\Users\mingy\Desktop\trae\data\
├── projects/          # 项目数据
├── chapters/          # 章节数据
├── reviews/           # 审核记录
├── materials/         # 素材数据
├── pipeline-logs/     # 执行日志
├── infinite-pipeline-state/  # 无限流水线状态
├── agent-templates/   # Agent提示词模板（11个）
├── constraint-presets/ # 约束预设（42个）
├── style-profiles/    # 风格配置（7个）
├── foundation-prompts/ # 基座提示词
└── ...（其他类型）
```

---

## 二、核心架构

### 2.1 Pipeline流程

```
Novel模式（完整审核链）:
意图规划 → 执笔人 → [字数检查] → 初审 → 复审 → 定稿人 → 润色 → 素材管理
                ↓失败          ↓失败       ↓失败
            字数不足→重写   返修员←──┘   返修员←──┘
```

### 2.2 Agent角色清单

| Agent | 职责 | 输出格式 | LLM路由 |
|-------|------|---------|---------|
| 意图规划 | 分析上下文、规划本章重点 | JSON | MiniMax |
| 执笔人 | 写正文 | 纯文本 | LM Studio |
| 初审 | 检查风格/视角/术语/重复 | JSON | MiniMax/Qwen |
| 复审 | 二次审核+字数确认 | JSON | MiniMax/Qwen |
| 定稿人 | 最终审批+素材指导 | JSON | MiniMax |
| 返修员 | 局部修改（字数达标时） | 纯文本 | MiniMax/Qwen |
| 润色师 | 润色定稿 | 纯文本 | MiniMax |
| 素材管理 | 更新角色/伏笔/世界观 | Markdown | MiniMax |
| 阅读者 | 跨章节一致性检查（每15章） | JSON | MiniMax |

**已移除的Agent**：
- 调整员(adjuster) — 78%规则是重复/矛盾，已移除。阅读者发现硬伤后直接触发返修员。

### 2.3 字数配置

| 模式 | 硬拦截下限 | 目标下限 | 目标上限 | 最大字数 | 最大轮次 |
|------|-----------|---------|---------|---------|---------|
| novel | 1800 | 2200 | 2800 | 3500 | 5 |
| shuangwen | 1200 | 1200 | 2800 | 2800 | 3 |
| tomato-short | 1850 | 1850 | 2800 | 2800 | 3 |

**字数统计统一使用 `content.replace(/\s/g,'').length`**（去空白后的实际字数），不用 `result.response.length`。

### 2.4 约束注入三层架构

```
TIER1 基座提示词（foundation_v3.json）
  → 最高优先级，不可被项目覆盖
  → 包含：输出格式红线、禁止分析过程、字数硬拦截

TIER2 约束预设（constraint-presets/，42个）
  → 项目级选择，可组合
  → 包含：视角锁定、对话真实、伏笔管理等

TIER3 风格配置（style-profiles/，7个）
  → 项目级选择，单一
  → 包含：POV规则、对话规则、行为规则、审核焦点
```

### 2.5 HARD BLOCK机制

程序化检测在初审/复审前执行，检测到问题直接拦截，不进入LLM审核：

| 检测器 | 检测内容 | 位置 |
|--------|---------|------|
| `detectTechJargon` | 科技术语（视角区分） | contentUtils.js |
| `detectPipelineMetadataLeak` | 管线元数据泄露 | contentUtils.js |
| `detectCrossChapterRepetition` | 跨章逐字复制 | contentUtils.js |
| `detectAdultPerspective` | 成人视角越界 | contentUtils.js |
| `scanSensitiveWords` | 敏感词 | sensitiveWordGuard.js |
| 字数硬拦截 | 低于REJECT_MIN_WORDS | pipeline.js |

---

## 三、核心模块详解

### 3.1 pipeline.js — 流水线引擎（最核心，约4000行）

**关键函数**：

| 函数 | 行号范围 | 职责 |
|------|---------|------|
| `runPipelineStep` | ~2200 | 执行单个Agent步骤，处理LLM调用和输出解析 |
| `runFullPipeline` | ~2380 | 单章完整流水线，含重试/返修/熔断逻辑 |
| `runInfinitePipeline` | ~3380 | 无限流水线，自动推进所有章节 |
| `stopInfinitePipeline` | ~3900 | 停止流水线，清除计数器 |
| `forceResetPipeline` | ~3920 | 强制重置，清除内存+持久化数据 |
| `getInfinitePipelineStatus` | ~3930 | 获取流水线状态（前端轮询） |

**关键数据流**：

```
runPipelineStep:
  1. 从store加载chapter（最新数据）
  2. 构建agentContext（system + user prompt）
  3. 调用LLM
  4. 解析输出（JSON提取/纯文本）
  5. 保存到chapter对象
  6. 写回store
  7. 返回 { step, result, passed, feedback }

runFullPipeline:
  1. 清空旧pipeline-logs
  2. 按步骤顺序执行
  3. 每步调用onStep回调（通知无限流水线）
  4. 字数不足→writer重写；审核不通过→reviser修改
  5. 达到MAX_ROUNDS→章节失败
  6. persistPipelineLog持久化
```

**返修员 vs 执笔人选择标准**：
- 字数 >= REJECT_MIN_WORDS（1800）→ 返修员局部修改
- 字数 < REJECT_MIN_WORDS → 执笔人全量重写

### 3.2 agentPrompts.js — 提示词构建

**关键函数**：

| 函数 | 职责 |
|------|------|
| `buildFoundationPrompt` | 构建基座提示词，注入[WORD_LIMITS] |
| `buildConstraintInjection` | 注入约束预设到Agent prompt |
| `buildStyleInjection` | 注入风格配置到Agent prompt |
| `getAgentPrompt` | 获取Agent提示词（全局模板→项目覆盖→风格注入） |

**提示词加载优先级**：
```
1. 全局模板（agent-templates store，按mode匹配）
2. 项目级覆盖（project.agentOverrides[agentType]）
3. 风格配置注入（styleProfile，追加到system字段）
4. 约束预设注入（constraint-presets，按injection_point注入）
```

### 3.3 contentUtils.js — 内容处理与质量检测

**关键函数**：

| 函数 | 职责 |
|------|------|
| `cleanChapterContent` | 清理LLM输出（去thinking标签/分析文本/代码块） |
| `deduplicateContent` | 章内去重（ngram重叠检测） |
| `detectTechJargon` | 科技术语检测（视角区分：成人可用，幼崽不可） |
| `detectPipelineMetadataLeak` | 管线元数据泄露检测 |
| `detectCrossChapterRepetition` | 跨章重复检测 |
| `detectAdultPerspective` | 成人视角越界检测 |

**`cleanChapterContent` 的危险正则**（修改时需谨慎）：
- `/【修改后的正文[\s\S]*?】/g` — 可能误删正文中的类似文本
- `/```[\s\S]*?```/g` — 删除所有Markdown代码块
- `ANALYSIS_PATTERNS` — 可能误删角色对话中的"让我仔细看看"

### 3.4 store.js — JSON文件数据层

**核心机制**：
- 每条记录一个JSON文件
- 写锁机制（acquireLock/releaseLock，10秒超时）
- 先写临时文件再rename（防数据损坏）
- 大小限制 + 自动裁剪

**大小限制**：

| 类型 | 上限 | 裁剪策略 |
|------|------|---------|
| chapters | 200KB | history只保留3条，输出字段截断3000-5000字 |
| materials | 50KB | changeLog只保留5条 |
| reviews | 30KB | - |
| pipeline-logs | 100KB | entries超过200条只保留最近150条 |

### 3.5 templateImporter.js — 范本导入

**导入流程**：
1. 验证范本JSON结构（必需字段+可选字段）
2. 创建项目
3. 导入素材（角色/世界观/伏笔等）
4. 导入大纲（章节标题+摘要）
5. 应用风格配置
6. 应用约束预设（萌宝题材自动过滤不兼容约束）
7. 设置字数配置

---

## 四、前端架构

### 4.1 页面路由

| 路由 | 页面 | 核心功能 |
|------|------|---------|
| `/` | Dashboard | 项目概览、快速操作 |
| `/pipeline` | PipelinePage | 流水线控制、执行日志、Agent输出详情 |
| `/workshop` | WorkshopPage | 范本导入、素材生成、大纲生成 |
| `/materials` | MaterialsPage | 素材库管理 |
| `/chapters` | ChaptersPage | 章节管理 |
| `/agents` | AgentsPage | Agent配置 |
| `/settings` | SettingsPage | LLM API配置 |
| `/knowledge` | KnowledgePage | 知识库（记忆/快照/一致性） |

### 4.2 PipelinePage 核心逻辑

**数据流**：
```
无限流水线运行时:
  每5秒轮询 getInfiniteStatus(projectId)
    → 更新 infiniteStatus（状态栏）
    → 更新 pipelineState.logs（执行日志面板）
    → 更新 chapters 列表

单章流水线运行时:
  启动时 clearPipelineLogs + addPipelineLog
  每3秒轮询 getTaskStatus(taskId)
  完成后 loadPipelineLogs 从持久化恢复
```

**Agent输出详情**：
- `activeOutputTab` 切换不同Agent的输出
- 支持：writerOutput, firstReviewOutput, secondReviewOutput, finalEditorOutput, polisherOutput, materialManagerOutput, reviserOutput, readerOutput
- 返修员输出为空时，多层回退：章节数据→review记录→pipeline日志→默认提示

### 4.3 全局状态（useAppStore.js）

```javascript
{
  projects: [],           // 项目列表
  currentProject: null,   // 当前项目
  chapters: [],           // 章节列表
  selectedChapter: null,  // 选中章节
  materials: [],          // 素材列表
  pipelineState: {        // 流水线状态
    running: false,
    currentStep: null,
    currentRound: 1,
    maxRounds: 3,
    logs: [],             // 执行日志
    chapterId: null
  },
  infiniteStatus: {},     // 无限流水线状态
  reviewLogs: []          // 审核记录
}
```

---

## 五、踩坑记录（按严重程度排序）

### 5.1 🔴 致命级（导致功能完全异常）

| # | 坑 | 根因 | 修复 | 防护 |
|---|---|------|------|------|
| 1 | **wordCount虚高导致字数不足循环** | `chapter.wordCount = result.response.length`（LLM原始输出），清理后实际少300-800字 | 统一用 `content.replace(/\s/g,'').length` | 基底#30 |
| 2 | **章节状态卡在中间态** | 清日志只清reviews没重置chapter.status | 清日志时同步重置为outlined | 基底#1 |
| 3 | **5-9章永久跳跃** | stopInfinitePipeline不清除_pipelineRetries计数器 | 停止时清除所有计数器 | 基底#16 |
| 4 | **去重正则malformed** | `/[...第[一二三]+天]/g`中`[`是字面量 | 拆分为两步replace | 基底#9 |
| 5 | **日志系统"⚙ 无限"** | addLog 45/47次不传结构化数据，前端渲染时stepInfo为undefined | addLog自动从msg提取结构化数据 | 基底#31 |

### 5.2 🟡 严重级（导致数据不一致或流程卡住）

| # | 坑 | 根因 | 修复 |
|---|---|------|------|
| 6 | **执行日志重启丢失** | 日志只存内存不持久化 | 持久化到store('pipeline-logs') |
| 7 | **返修员输出不可见** | review记录缺少type字段+reviserOutput保存原始响应 | 添加type字段+保存清理后正文 |
| 8 | **日志残留** | persistPipelineLog增量合并不清空 | 启动时清空+改为直接替换 |
| 9 | **科技术语穿透防线** | 仅靠提示词软约束 | detectTechJargon程序化检测+HARD BLOCK |
| 10 | **跨章逐字复制** | deduplicateContent只做章内去重 | detectCrossChapterRepetition+HARD BLOCK |
| 11 | **审核矫枉过正** | "严禁成人内心独白"没区分幼崽和成人角色 | 约束增加排除条款+检测器区分视角 |
| 12 | **约束矛盾** | adjuster自动添加规则导致矛盾 | 移除adjuster+isRuleRedundant去重 |
| 13 | **字数要求LLM不遵守** | system prompt用技术化格式"硬拦截区间=[1800,3500]" | 改为自然语言"你必须写出2200-2800字" |

### 5.3 🟠 中等级（导致体验差或环境脏乱）

| # | 坑 | 根因 | 修复 |
|---|---|------|------|
| 14 | **素材名称带Markdown前缀** | fallback解析nameMatch没清理`#` | replace(/^#+\s*/,'') |
| 15 | **多素材同一section漏解析** | match()只取第一个 | 用matchAll逐个匹配 |
| 16 | **中文引号破坏JSON** | 暴力替换不区分位置 | 先原样解析，失败再替换 |
| 17 | **素材库内容为空** | 前端用content字段，后端存currentContent | 兼容写法 |
| 18 | **项目隔离不严格** | queryItems用includes模糊匹配 | 改为===精确匹配 |

---

## 六、代码规范速查

### 6.1 修改代码前必读

1. **先读 PROJECT_STANDARDS.md** — 所有规范和踩坑记录
2. **先读相关模块代码** — 理解设计意图再改
3. **先问三个问题**：
   - 这个修复会影响哪些其他模块？
   - 这个修复的边界条件是什么？
   - 这个修复是否引入了新的状态/计数器？

### 6.2 修改后必做

1. **验证语法**：`node -e "require('./services/pipeline'); console.log('OK')"`
2. **验证前端**：`cd client && npx vite build`
3. **检查基底**：修改是否与基底规范冲突？
4. **举一反三**：同类Agent是否有相同问题？

### 6.3 禁止事项

| 禁止 | 原因 | 替代方案 |
|------|------|---------|
| 硬编码业务规则 | 新项目无法复用 | 用style-profiles/constraint-presets注入 |
| PowerShell操作Unicode文件 | 编码损坏 | Node.js脚本或SearchReplace |
| 只修症状不修根因 | 问题反复出现 | 追问根因，修prompt/约束/流程 |
| 跳过章节解决卡住 | 质量炸弹（素材+叙事断裂） | 修复约束/审核标准 |
| 新增正则不加测试 | 维护债务 | 必须有测试用例 |
| 新增计数器不定义生命周期 | 永不重置导致bug | 创建/递增/重置/上限四要素 |
| 只检测不拦截 | 等于没检测 | 集成到HARD BLOCK |

### 6.4 字数相关规范

- **统计方式**：统一用 `content.replace(/\s/g,'').length`
- **system prompt**：用自然语言"你必须写出X-Y字正文"，不用技术化格式
- **重写警告**：包含5条具体扩展策略 + 字数差距 + "只做加法"
- **旧正文截断**：8000字符（不是5000）

### 6.5 日志相关规范

- **addLog**：自动从msg提取结构化数据，不需要手动传递
- **persistPipelineLog**：直接替换，不增量合并
- **启动时清空**：runFullPipeline和runInfinitePipeline启动时清空旧日志
- **forceResetPipeline**：清除内存+持久化数据
- **前端渲染**：用AGENT_ICONS[step] + AGENT_LABELS[step]统一渲染

### 6.6 Review记录规范

- **必须包含**：step, type, passed, round, content, issues, suggestions
- **step和type保持一致**：如 step='reviser', type='reviser'
- **passed必须填写**：前端三处判断逻辑都依赖
- **fallback路径也必须保存review记录**

---

## 七、常见操作手册

### 7.1 清理项目数据

```javascript
// 在 server/ 目录下执行
const store = require('./store');
const PROJECT_ID = '<当前项目ID>';

// 1. 停流水线
// POST /api/pipeline/infinite/stop

// 2. 清旧项目
store.listItems('reviews').filter(r => r.projectId !== PROJECT_ID).forEach(r => store.deleteItem('reviews', r.id));
store.listItems('materials').filter(m => m.projectId !== PROJECT_ID).forEach(m => store.deleteItem('materials', m.id));
store.listItems('chapters').filter(c => c.projectId !== PROJECT_ID).forEach(c => store.deleteItem('chapters', c.id));
store.listItems('projects').filter(p => p.id !== PROJECT_ID).forEach(p => store.deleteItem('projects', p.id));

// 3. 重置指定章节
const chapters = store.queryItems('chapters', { projectId: PROJECT_ID });
chapters.filter(c => c.chapterNumber >= N).forEach(c => {
    store.listItems('reviews').filter(r => r.chapterId === c.id).forEach(r => store.deleteItem('reviews', r.id));
    store.queryItems('materials', { projectId: PROJECT_ID }).filter(m => m.sourceChapter === c.chapterNumber).forEach(m => store.deleteItem('materials', m.id));
    store.deleteItem('pipeline-logs', `${c.id}_pipeline`);
    store.setItem('chapters', c.id, { ...c, content: '', writerOutput: '', status: 'outlined', wordCount: 0 });
});

// 4. 验证
console.log('Reviews:', store.listItems('reviews').length);
console.log('Materials:', store.listItems('materials').filter(m => m.projectId === PROJECT_ID).length);
```

### 7.2 导入新项目

1. 准备范本JSON文件（参考 SYSTEM_REFERENCE.md 的范本规范）
2. 前端：创作工坊 → 导入范本
3. 或API：`POST /api/workshop/import-template`
4. 导入后检查：约束是否合理、风格是否加载、章节状态是否为outlined

### 7.3 切换LLM模型

1. 前端：系统设置 → 添加/修改API Key
2. 前端：Agent配置 → 绑定不同Agent到不同API Key
3. 或修改 `.env` 文件的 `LLM_PROVIDER` 变量

### 7.4 调试流水线

1. 查看执行日志：PipelinePage右侧面板
2. 查看Agent输出详情：切换activeOutputTab
3. 查看审核记录：reviewLogs列表
4. 查看后端日志：控制台输出 `[PIPELINE]` 前缀
5. 查看无限流水线状态：`GET /api/pipeline/infinite/status/:projectId`

---

## 八、文件索引

### 8.1 后端核心文件（修改频率最高）

| 文件 | 行数 | 职责 | 修改注意 |
|------|------|------|---------|
| `server/services/pipeline.js` | ~4000 | 流水线引擎 | 最核心，改动影响最大 |
| `server/services/agentPrompts.js` | ~800 | 提示词构建 | 修改需同步fallback |
| `server/services/contentUtils.js` | ~600 | 内容处理 | 正则修改需测试 |
| `server/store.js` | ~150 | 数据层 | 大小限制需同步 |
| `client/src/pages/PipelinePage.jsx` | ~1300 | 流水线页面 | 前端最复杂 |

### 8.2 配置文件

| 文件 | 职责 |
|------|------|
| `data/agent-templates/*.json` | Agent提示词模板 |
| `data/constraint-presets/*.json` | 约束预设 |
| `data/style-profiles/*.json` | 风格配置 |
| `data/foundation-prompts/*.json` | 基座提示词 |
| `server/services/pipelineConfig.js` | 流水线配置 |
| `.env` | 环境变量（LLM_PROVIDER, PORT等） |

---

## 九、已知限制与待改进

1. **单章流水线运行时前端无法实时获取步骤日志** — 需要SSE或WebSocket推送
2. **定稿人拒绝3轮后直接失败** — 应考虑更灵活的策略
3. **润色师依赖MiniMax API** — 本地模型不支持
4. **cleanChapterContent可能误删正文** — 正则匹配过于宽泛
5. **三幕结构节点（每15章）** — 已在style-profile中配置，但尚未在pipeline中强制执行
6. **模板导入后约束验证** — 需要更完善的冲突检测

---

## 十、快速上手步骤

1. **启动服务**：`cd server && npm start`
2. **打开前端**：`cd client && npm run dev`
3. **创建项目**：创作工坊 → 导入范本 或 手动创建
4. **配置LLM**：系统设置 → 添加API Key → 绑定Agent
5. **启动流水线**：流水线页面 → 启动无限流水线
6. **监控执行**：执行日志面板 + Agent输出详情
7. **遇到问题**：先查 PROJECT_STANDARDS.md 的踩坑记录，再查本文档的操作手册
