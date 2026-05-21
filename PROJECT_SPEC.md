# Novel-Pipeline AI小说自动化流水线 — 项目说明文档

> 本文档供AI接手开发时使用，涵盖架构、核心逻辑、数据模型、API接口、已知问题和优化方向。

---

## 一、项目概述

**Novel-Pipeline** 是一个AI驱动的小说自动化创作系统，通过多Agent协作流水线完成从素材生成到正文创作、审核、定稿、素材更新的全流程。

- **前端**：React 19 + Vite + Zustand + Framer Motion
- **后端**：Express 5 + JSON文件存储
- **AI模型**：通过 `llm.js` 统一调用，支持 MiniMax / OpenAI / DeepSeek / 通义千问 / 智谱 / 月之暗面 / 硅基流动 / 自定义
- **数据目录**：`data/`（JSON文件存储）、`output/`（流水线输出文件）

### 核心流程

```
用户输入 → 素材生成 → 大纲生成 → [每章循环] → 执笔人 → 去重 → 截断 → 初审 → 复审 → 定稿人 → 清洗 → 素材更新 → 保存
```

### 5个Agent角色

| Agent | 角色 | 职责 | 输出格式 |
|-------|------|------|----------|
| `writer` | 执笔人 | 根据大纲+素材创作正文 | 纯文本正文 |
| `first-review` | 初审 | 审核与素材一致性、角色深度、剧情原创性、内容重复 | `{passed, issues, suggestions, summary}` |
| `second-review` | 复审 | 审核逻辑、字数(2500-3000)、风格、重复检测 | `{passed, issues, suggestions, summary, wordCount, styleScore}` |
| `final-editor` | 定稿人 | 最高裁定权，综合初审复审决定通过/拒绝 | `{approved, action, edits, ipDirection, materialGuidance, scheduleNote}` |
| `material-manager` | 素材管理 | 更新素材库、伏笔追踪、归档检查 | `{updates, archiveLog, foreshadowTracking}` |

---

## 二、目录结构

```
novel-pipeline/
├── client/                    # 前端 React 应用
│   ├── src/
│   │   ├── App.jsx           # 路由配置
│   │   ├── main.jsx          # 入口
│   │   ├── pages/            # 15个页面组件
│   │   ├── components/       # 公共组件 (Sidebar, Header, ErrorBoundary, CreateProjectModal)
│   │   ├── services/api.js   # API服务层（15个命名空间）
│   │   ├── store/useAppStore.js  # Zustand全局状态
│   │   └── styles/           # CSS样式 + 6个皮肤
│   └── package.json
├── server/                    # 后端 Express 应用
│   ├── index.js              # 服务器入口、路由挂载、License/Health/API-Keys端点
│   ├── store.js              # JSON文件数据层（CRUD + 写锁 + 原子写入）
│   ├── version.json          # 版本信息
│   ├── services/             # 服务层（核心业务逻辑）
│   │   ├── pipeline.js       # 流水线核心执行（2182行，已拆分）
│   │   ├── agentPrompts.js   # Agent提示词 + 约束预设 + buildConstraintInjection
│   │   ├── contentUtils.js   # 内容去重 + 截断 + 清洗（cleanFinalContent + cleanChapterContent）
│   │   ├── jsonUtils.js      # JSON提取工具
│   │   ├── fileOutput.js     # 文件输出路径管理 + AGENT_ROLE_NAMES
│   │   ├── memory.js         # 5层记忆系统（L0-L4）+ 缓存TTL + LRU
│   │   ├── consistency.js    # 一致性检查引擎（6维度）
│   │   ├── llm.js            # 多供应商LLM调用 + 重试 + 上下文溢出检测
│   │   ├── contextBudget.js  # Token预算分配 + 优先级槽位
│   │   ├── publish.js        # 平台元数据 + 账号CRUD + 发布队列 + 互动 + 内容格式化
│   │   ├── multiPlatformPublisher.js  # 5平台Playwright发布（番茄/七猫/抖音/掌阅/书旗）
│   │   ├── comfyuiWorkflow.js # ComfyUI工作流构建（LTX2.3/Wan2.2）
│   │   ├── comic.js          # 漫剧配置/分镜/渲染队列
│   │   ├── export.js         # FFmpeg漫剧导出
│   │   ├── stateSnapshot.js  # 状态快照（角色/关系/装备/伏笔/成长追踪）
│   │   ├── healthMonitor.js  # 健康监控（6项检查 + 自动清理）
│   │   ├── imageGen.js       # MiniMax图片生成
│   │   ├── workshop.js       # 设定导入/素材大纲生成/小说融合
│   │   ├── mapService.js     # 层级地图节点
│   │   ├── fileParser.js     # TXT/MD文件解析
│   │   ├── license.js        # License验证/会员/功能门控
│   │   └── tts.js + tts_runner.py  # Edge-TTS语音合成
│   └── routes/               # 路由层（16个路由文件）
│       ├── pipeline.js       # 流水线控制
│       ├── projects.js       # 项目CRUD + 关系图
│       ├── chapters.js       # 章节CRUD
│       ├── materials.js      # 素材CRUD
│       ├── reviews.js        # 审核记录CRUD
│       ├── publish.js        # 发布平台/账号/队列/番茄/多平台
│       ├── knowledge.js      # 记忆层/快照/一致性/关系图/战力追踪
│       ├── franchises.js     # 系列CRUD + 文件导入 + 产品继承
│       ├── comic.js          # 漫剧全功能
│       ├── workshop.js       # 工坊
│       ├── style-templates.js # 风格模板CRUD + AI分析
│       ├── settings.js       # 系统设置 + 测试连接
│       ├── agents.js         # Agent目录/配置/提示词
│       ├── guide.js          # 操作指南
│       ├── quests.js         # 任务/时间线
│       └── map.js            # 地图节点
├── data/                      # 运行时数据（JSON文件存储）
│   ├── projects/             # 项目
│   ├── materials/            # 素材
│   ├── chapters/             # 章节
│   ├── reviews/              # 审核记录
│   ├── api-keys/             # API密钥 + Agent绑定
│   ├── platform-accounts/    # 平台账号
│   ├── publish-queue/        # 发布队列
│   ├── interactions/         # 互动记录
│   ├── memory-layers/        # 记忆层缓存
│   ├── state-snapshots/      # 状态快照
│   ├── consistency-reports/  # 一致性报告
│   ├── franchises/           # 系列
│   ├── franchise-materials/  # 系列素材
│   ├── map-nodes/            # 地图节点
│   ├── quests/               # 任务
│   ├── timelines/            # 时间线
│   ├── style-templates/      # 风格模板
│   ├── comic-config/         # 漫剧配置
│   ├── comic-workflows/      # 漫剧工作流
│   ├── comic-storyboards/    # 漫剧分镜
│   └── comic-render-queue/   # 漫剧渲染队列
├── output/                    # 流水线输出文件
│   └── {projectId}/
│       ├── chapters/         # 各Agent输出txt
│       ├── final/            # 定稿后清洗的正文
│       └── consolidated/     # 合并输出
└── .env                       # 环境变量
```

---

## 三、核心数据模型

### Project（项目）

```javascript
{
    id: "proj_1776849429785_xingjuexing",  // 格式: proj_{timestamp}_{slug}
    name: "星际觉醒",
    genre: "科幻",
    description: "...",
    constraints: ["no-derailment", "character-consistency", ...],  // 写作约束ID
    styleTemplateId: "xxx",
    status: "active",
    createdAt: "ISO string",
    updatedAt: "ISO string"
}
```

### Material（素材）

```javascript
{
    id: "mat_xxx",
    projectId: "proj_xxx",
    type: "character|worldview|power-system|relationship|equipment|location|catchphrase|famous-scene|growth-history|foreshadowing|other",
    name: "陈星河",
    content: "详细描述...",
    tags: ["template", "核心", "主角"],
    status: "active|retired|deprecated|recycled",
    createdAt: "ISO string",
    updatedAt: "ISO string"
}
```

**素材类型优先级**（执笔人读取顺序）：
1. `character` — 人物设定
2. `relationship` — 人物关系
3. `growth-history` — 成长轨迹
4. `location` — 地点
5. `foreshadowing` — 伏笔
6. `worldview` — 世界观
7. `power-system` — 力量体系

### Chapter（章节）

```javascript
{
    id: "ch_xxx",
    projectId: "proj_xxx",
    chapterNumber: 1,
    title: "星际垃圾场的拾荒者",
    outline: "本章大纲内容...",
    content: "正文内容...",        // 定稿后为清洗过的正文
    rawContent: "原始正文...",     // 定稿前的原始内容
    status: "outlined|written|first-reviewing|second-reviewing|final-editing|approved|material-updated|rejected",
    reviewRounds: 0,              // 当前轮次
    maxReviewRounds: 3,           // 最大轮次
    wordCount: 2800,
    createdAt: "ISO string",
    updatedAt: "ISO string"
}
```

**章节状态流转**：
```
outlined → written → first-reviewing → second-reviewing → final-editing
    ↑          ↓           ↓                ↓                ↓
    └──── rejected ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ┘
                                                    ↓ (approved)
                                              material-updated
```

### Review（审核记录）

```javascript
{
    id: "rev_xxx",
    chapterId: "ch_xxx",
    projectId: "proj_xxx",
    agentType: "first-review|second-review|final-editor",
    round: 1,
    result: { passed: true/false, issues: [], suggestions: [], summary: "..." },
    createdAt: "ISO string"
}
```

---

## 四、核心服务详解

### 4.1 pipeline.js — 流水线核心（2182行，已拆分）

**已拆分出4个独立模块**：
- `agentPrompts.js` — AGENT_PROMPTS + CONSTRAINT_PRESETS + buildConstraintInjection + getAgentPrompt
- `contentUtils.js` — deduplicateContent + truncateChapter + cleanFinalContent + cleanChapterContent + MAX_CHAPTER_WORDS
- `jsonUtils.js` — extractJSON
- `fileOutput.js` — saveAgentOutput + saveFinalContent + getAgentOutputPaths + ensureOutputDir + AGENT_ROLE_NAMES + OUTPUT_DIR

**pipeline.js 保留的职责**：
- `runAgent()` — Agent执行（上下文预算分配+LLM调用）
- `runPipelineStep()` — 单步执行
- `runFullPipeline()` — 全流程执行
- `runInfinitePipeline()` — 无限流水线（自动推进章节）
- `generateInitialMaterials()` — 初始素材生成
- `generateChapterOutlines()` — 大纲生成
- `generateFromTemplate()` — 模板一键生成
- `consolidateChapters()` — 章节合并（已改为非AI版本）

**字数标准**：
- 目标：2500-3000字
- 硬上限：3300字（3000+10%）
- 不足2000字：拒绝
- 截断逻辑：优先在段落边界截断，其次句子边界，末尾非句号加"……"

**去重逻辑**：
- 段落级：标准化比较（去标点空格），完全相同或70%子串匹配视为重复
- 句子级：以。！？分割，标准化后去重
- 短于15字符的段落/句子跳过

**定稿清洗**：
- 移除 `# 第X章` 标题
- 移除 `---` 分隔线
- 移除 `【钩子/伏笔/悬念/下章预告】` 标注
- 压缩多余空行

### 4.2 memory.js — 5层记忆系统

| 层级 | 名称 | 内容 | 缓存 |
|------|------|------|------|
| L0 | 核心常驻 | 核心角色(tags=核心/主角/template) + 世界观 + 力量体系 | 5min TTL |
| L1 | 角色全量 | 所有角色 + 关系 + 装备 | 5min TTL |
| L2 | 章节相关 | 当前章节涉及的素材（按大纲关键词匹配） | 5min TTL |
| L3 | 近期上下文 | 最近N章的摘要 | 5min TTL |
| L4 | 卷摘要 | 每卷的压缩摘要 | 5min TTL |

**缓存机制**：
- `_CACHE_TTL = 5 * 60 * 1000`（5分钟过期）
- `_CACHE_MAX = 50`（最大50条）
- LRU淘汰策略

**执笔人素材读取逻辑**：
- L0/L1 已通过 memory 系统发送，覆盖类型：character, worldview, power-system, relationship, foreshadowing, growth-history, equipment
- 执笔人额外查询 memory 未覆盖的类型：location, catchphrase, famous-scene
- 按大纲关键词过滤相关素材
- `MAX_MATERIAL_TOKENS = 4000`（约8000字符）预算限制

### 4.3 llm.js — LLM统一调用

- 支持8个供应商：minimax, openai, deepseek, qwen, zhipu, moonshot, siliconflow, custom
- 自动重试：5次（可配置），指数退避
- 529/2064过载自动重试
- 上下文溢出检测（`CONTEXT_OVERFLOW` 错误）
- `</think` 标签自动剥离（支持推理模型）
- MiniMax 需要 `group_id`

### 4.4 store.js — JSON文件存储

- 每个实体类型一个目录，每条记录一个JSON文件
- **原子写入**：先写 `.tmp.{timestamp}` 再 `fs.renameSync`
- **写锁**：`acquireLock(type, id)` / `releaseLock(type, id)`，10秒死锁超时
- **BOM处理**：读取时 `.replace(/^\uFEFF/, '')`
- API：`listItems`, `getItem`, `setItem`, `deleteItem`, `queryItems`

### 4.5 healthMonitor.js — 健康监控

每5分钟自动检查：
1. **卡住章节**：状态为written/reviewing/editing超过2小时
2. **孤儿浏览器**：Chromium进程超过5个
3. **磁盘空间**：data目录超过500MB
4. **内存使用**：heap超过512MB（warning）或RSS超过1GB（critical）
5. **数据完整性**：JSON文件能否正常解析
6. **流水线日志**：单项目日志超过100条
7. **自动清理**：
   - `.log`/`.tmp`/`_test_*` 文件超过24小时
   - `_tts_tmp`/`comfyui_input` 目录超过24小时
   - 孤儿项目输出目录（data/projects中不存在的）超过24小时
   - 过期告警超过24小时

API端点：
- `GET /api/health` — 健康状态
- `GET /api/health/alerts` — 告警列表
- `POST /api/health/check` — 手动触发检查

### 4.6 contextBudget.js — Token预算

根据模型上下文窗口分配各部分预算：
- 优先级槽位：agent_prompt > memory_context > chapter_outline > materials > previous_chapter > review_feedback > style_template
- 超出预算时按优先级截断

### 4.7 consistency.js — 一致性检查（6维度）

1. 角色一致性
2. 关系一致性
3. 装备一致性
4. 战力一致性
5. 世界观一致性
6. 伏笔一致性

### 4.8 multiPlatformPublisher.js — 多平台发布

支持5个平台：番茄小说、七猫小说、抖音小说、掌阅iReader、书旗小说

每个平台有独立配置：
- `writerUrl` / `chapterEditorUrl`
- `loginIndicators` / `loginUrlKeywords`
- `selectors`（创建章节/标题输入/内容区域/下一步/定时发布/确认按钮/成功指标）

发布流程：连接浏览器(CDP/本地) → 检查登录 → 等待登录 → 导航到作品 → 逐章填充+发布

---

## 五、API接口速查

### 流水线

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/pipeline/step` | 执行单步（指定agentType） |
| POST | `/api/pipeline/full` | 执行全流程（单章） |
| POST | `/api/pipeline/infinite` | 启动无限流水线 |
| POST | `/api/pipeline/infinite/stop` | 停止无限流水线 |
| GET | `/api/pipeline/infinite/status` | 无限流水线状态 |
| POST | `/api/pipeline/materials` | 生成初始素材 |
| POST | `/api/pipeline/outlines` | 生成章节大纲 |
| POST | `/api/pipeline/merge` | 合并章节 |
| POST | `/api/pipeline/image` | 生成章节图片 |
| POST | `/api/pipeline/template` | 模板一键生成 |

### 项目/素材/章节

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/projects` | 项目列表/创建 |
| GET/PUT/DELETE | `/api/projects/:id` | 项目详情/更新/删除 |
| GET | `/api/projects/constraints` | 获取约束预设列表 |
| GET/POST | `/api/materials` | 素材列表/创建（需projectId） |
| GET/PUT/DELETE | `/api/materials/:id` | 素材详情/更新/删除 |
| GET/POST | `/api/chapters` | 章节列表/创建（需projectId） |
| GET/PUT/DELETE | `/api/chapters/:id` | 章节详情/更新/删除 |
| POST | `/api/chapters/clear-content` | 清空章节内容（保留大纲） |

### 知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge/layers` | 获取记忆层 |
| POST | `/api/knowledge/layers/refresh` | 刷新记忆层 |
| GET | `/api/knowledge/snapshots` | 状态快照 |
| POST | `/api/knowledge/snapshots` | 创建快照 |
| GET | `/api/knowledge/consistency` | 一致性报告 |
| POST | `/api/knowledge/consistency/check` | 执行一致性检查 |
| GET | `/api/knowledge/relationship-graph` | 关系图 |
| GET | `/api/knowledge/power-tracking` | 战力追踪 |
| GET | `/api/knowledge/overview` | 知识库概览 |

### 发布

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/publish/fanqie/publish` | 番茄小说发布 |
| POST | `/api/publish/fanqie/stop` | 停止番茄发布 |
| GET | `/api/publish/fanqie/status` | 番茄发布状态 |
| GET | `/api/publish/multi-platforms` | 多平台列表 |
| POST | `/api/publish/multi-publish` | 多平台发布 |
| POST | `/api/publish/multi-stop` | 停止多平台发布 |
| GET | `/api/publish/multi-status` | 所有平台状态 |
| POST | `/api/publish/consolidate` | 合并项目章节 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康状态 |
| GET | `/api/health/alerts` | 告警列表 |
| POST | `/api/health/check` | 手动健康检查 |
| GET | `/api/api-keys` | API密钥列表 |
| POST | `/api/api-keys` | 添加API密钥 |
| DELETE | `/api/api-keys/:id` | 删除API密钥 |
| GET/POST | `/api/api-keys/agent-bindings` | Agent绑定 |
| GET | `/api/providers` | LLM供应商列表 |
| GET/POST | `/api/settings` | 系统设置 |
| POST | `/api/settings/test` | 测试LLM连接 |

---

## 六、环境变量

```env
# LLM配置
LLM_API_KEY=your_api_key
LLM_PROVIDER=minimax
LLM_MODEL=MiniMax-M2.7
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_GROUP_ID=your_group_id

# MiniMax兼容（旧变量名，仍支持）
MINIMAX_API_KEY=your_api_key
MINIMAX_GROUP_ID=your_group_id
MINIMAX_MODEL=MiniMax-M2.7

# 服务器
PORT=3001
REQUEST_SECRET=random_secret

# 代理（可选）
HTTPS_PROXY=http://127.0.0.1:7897
```

---

## 七、关键常量和限制

| 常量 | 值 | 位置 | 说明 |
|------|-----|------|------|
| `MAX_CHAPTER_WORDS` | 3300 | pipeline.js | 章节硬上限字数 |
| `TARGET_MIN_WORDS` | 2500 | pipeline.js | 目标最低字数 |
| `TARGET_MAX_WORDS` | 3000 | pipeline.js | 目标最高字数 |
| `REJECT_MIN_WORDS` | 2000 | pipeline.js | 低于此字数拒绝 |
| `MAX_MATERIAL_TOKENS` | 4000 | pipeline.js | 执笔人素材Token预算 |
| `_CACHE_TTL` | 300000 | memory.js | 缓存过期时间5分钟 |
| `_CACHE_MAX` | 50 | memory.js | 最大缓存条目 |
| `CHECK_INTERVAL` | 300000 | healthMonitor.js | 健康检查间隔5分钟 |
| `MAX_LOG_AGE` | 86400000 | healthMonitor.js | 日志过期时间24小时 |
| `MAX_STUCK_CHAPTER_AGE` | 7200000 | healthMonitor.js | 章节卡住阈值2小时 |
| `MAX_ALERTS` | 200 | healthMonitor.js | 最大告警数 |
| Pipeline日志上限 | 500→300 | pipeline.js | 超过500条截断到300 |

---

## 八、写作约束预设（CONSTRAINT_PRESETS）

| ID | 标签 | 说明 |
|----|------|------|
| `no-derailment` | 不降智 | 角色不得智商断崖下降，反派不能为剧情变蠢 |
| `proper-introduction` | 出场铺垫 | 重要角色/道具/地点首次出现需前文暗示 |
| `character-consistency` | 角色定位一致 | 行为说话必须符合自身定位 |
| `worldview-consistency` | 世界观一致 | 不出现与世界观无关的元素 |
| `no-random-plot` | 不乱发挥 | 剧情必须基于已有设定和伏笔推进 |
| `power-consistency` | 战力不崩 | 战力体系前后一致 |
| `no-deus-ex` | 拒绝机械降神 | 不得用巧合解决核心冲突 |
| `dialogue-authentic` | 对话真实 | 不同角色说话方式有区分度 |
| `character-depth` | 角色深度 | 主角有弱点挣扎，配角有自身动机 |
| `plot-originality` | 剧情原创 | 战斗差异化，升级有代价 |
| `foreshadow-manage` | 伏笔管理 | 10-30章内回收，新伏笔标注 |

---

## 九、素材类型详解

| 类型 | 说明 | 模板素材示例 |
|------|------|-------------|
| `character` | 人物设定 | 陈星河、老郑、苏晚晴、韩青云、诺亚、观测者-7 |
| `worldview` | 世界观 | 星际时代背景、联邦体制、维度理论 |
| `power-system` | 力量体系 | 维度感知等级、觉醒测试 |
| `relationship` | 人物关系 | 陈星河↔老郑(师徒)、陈星河↔苏晚晴(对立转盟友) |
| `equipment` | 装备道具 | 维度信标、星际导航仪 |
| `location` | 地点 | 边缘带、中继站、遗迹星域 |
| `catchphrase` | 口头禅 | 角色标志性台词 |
| `famous-scene` | 名场面 | 关键剧情场景 |
| `growth-history` | 成长轨迹 | 角色成长记录 |
| `foreshadowing` | 伏笔 | 核心伏笔清单 |
| `other` | 其他 | 不属于以上类型的素材 |

**素材标签**：
- `template` — 模板导入的原始素材
- `核心` — 核心角色
- `主角` — 主角

---

## 十、已知架构问题和优化方向

### ✅ 已解决：pipeline.js 拆分（原2575行→2182行+4个新模块）

已拆分出：
| 模块 | 行数 | 职责 |
|------|------|------|
| `agentPrompts.js` | 155 | Agent提示词 + 约束预设 |
| `contentUtils.js` | 105 | 内容去重 + 截断 + 清洗 |
| `jsonUtils.js` | 25 | JSON提取工具 |
| `fileOutput.js` | 80 | 文件输出路径管理 |

### ✅ 已解决：publish.js 职责混杂

`cleanChapterContent()` 已移至 `contentUtils.js`，`multiPlatformPublisher.js` 改为从 `contentUtils.js` 引用。

### ✅ 已解决：fanqiePublisher 与 multiPlatformPublisher 冗余

`fanqiePublisher.js` 已删除（391行），番茄小说发布改为通过 `multiPlatformPublisher.js` 统一处理。

### ✅ 已解决：minimax.js 薄封装

`minimax.js` 已删除（37行），所有调用改为直接使用 `llm.js`。

### ✅ 已解决：workshop.js 与 pipeline.js 素材/大纲生成重叠

workshop.js 的 `generateMaterials()` 和 `generateOutlines()` 改为调用 pipeline.js 的 `generateInitialMaterials()` 和 `generateChapterOutlines()`，消除了约150行重复代码。

### ✅ 已解决：前端 CreateProjectModal 提交逻辑重复

提取公共 `handleTemplateGenerate()` 函数，template 模式和 manual+autoSupplement 模式共用，消除约60行重复代码。

### P1：路由层业务逻辑过重

- `franchises.js`（567行）：产品创建继承逻辑应下沉到 `franchiseService.js`
- `projects.js`（285行）：关系图生成逻辑应下沉到 `relationshipGraphService.js`
- `knowledge.js`（447行）：战力追踪/概览统计应下沉到对应服务

### P2：workshop.js 与 pipeline.js 素材/大纲生成重叠

两者都有素材生成和大纲生成功能，只是输入来源不同。建议提取公共的 `materialGenerator.js`。

### P3：comfyuiWorkflow.js 工作流节点重复

5个工作流构建函数有大量重复节点定义，建议提取公共节点构建函数，可减少200-300行。

### P4：publish.js 职责混杂

`cleanChapterContent()` 和 `consolidateProject()` 不属于发布模块，应移至 `contentUtils.js`。

### P5：前端 CreateProjectModal.jsx 提交逻辑重复

template模式和manual模式的提交逻辑几乎相同（约60行重复），应提取公共函数。

---

## 十一、启动和运行

### 安装依赖

```bash
cd server && npm install
cd ../client && npm install
```

### 启动开发服务器

```bash
# 后端
cd server && node index.js

# 前端
cd client && npm run dev
```

### 环境要求

- Node.js 18+
- Python 3.8+（Edge-TTS需要）
- FFmpeg（漫剧导出需要）
- ComfyUI（漫剧渲染需要，可选）
- Playwright Chromium（多平台发布需要）

---

## 十二、常见问题和注意事项

1. **MiniMax API 529过载**：llm.js 已有自动重试机制（5次，指数退避），但频繁529时流水线会很慢
2. **章节内容重复**：3层防护——deduplicateContent() + 3个审核Agent的重复检测规则 + 定稿人拒绝条件
3. **字数超标**：2层防护——truncateChapter()硬截断 + 复审/定稿人字数拒绝条件
4. **浏览器泄漏**：multiPlatformPublisher 异常时自动关闭非CDP浏览器 + SIGINT/SIGTERM清理钩子
5. **数据文件损坏**：healthMonitor 自动检测 + store.js 原子写入防损坏
6. **缓存过期**：memory.js 5分钟TTL + LRU淘汰，修改素材后需等5分钟或重启服务
7. **无限流水线状态**：`INFINITE_PIPELINE_STATE` 是内存变量，服务器重启后丢失
8. **output目录清理**：healthMonitor 每5分钟自动清理24小时以上的孤儿项目输出和临时文件

---

## 十三、当前活跃项目

- **星际觉醒** (`proj_1776849429785_xingjuexing`)
  - 类型：科幻
  - 状态：所有章节为 `outlined`（有大纲无正文），等待用新标准(2500-3000字)重新写作
  - 素材：36条模板素材（6角色 + 世界观 + 力量体系 + 关系 + 伏笔等）
  - output目录：仍有旧输出文件（proj_1776849429785_xingjuexing/），需手动清理或等healthMonitor自动清理

---

## 十四、最近完成的优化

### 第一轮优化（旧日志清理+代码精简）

| 操作 | 说明 |
|------|------|
| 删除 `minimax.js` | 37行薄封装，改为直接使用 `llm.js` |
| 删除 `fanqiePublisher.js` | 391行，功能完全被 `multiPlatformPublisher.js` 覆盖 |
| 删除 `test_params.json` | TTS测试残留 |
| 删除 `server/scripts/` 5个脚本 | 一次性数据操作脚本，不再需要 |
| 修复 `index.js` 重复health端点 | 删除第二个 `/api/health`（简单版），保留healthMonitor版 |
| 增强 `healthMonitor.cleanupOldFiles()` | 支持清理TTS临时目录、ComfyUI目录、孤儿项目输出、.tmp文件、_test_文件 |
| 清理output目录 | 删除6个孤儿项目目录、test-comic、test-shortfilm、workshop、_tts_tmp、测试文件（释放约15MB） |

### 第二轮优化（架构拆分+职责归位）

| 操作 | 说明 | 效果 |
|------|------|------|
| 提取 `agentPrompts.js` | 从pipeline.js拆出AGENT_PROMPTS + CONSTRAINT_PRESETS + buildConstraintInjection | 155行独立模块 |
| 提取 `contentUtils.js` | 从pipeline.js拆出deduplicateContent + truncateChapter + cleanFinalContent；从publish.js移入cleanChapterContent | 105行独立模块 |
| 提取 `jsonUtils.js` | 从pipeline.js拆出extractJSON | 25行独立模块 |
| 提取 `fileOutput.js` | 从pipeline.js拆出saveAgentOutput + saveFinalContent + getAgentOutputPaths + AGENT_ROLE_NAMES | 80行独立模块 |
| pipeline.js瘦身 | 删除已拆分代码，改为引用新模块 | 2575→2182行（-393行） |
| publish.js职责归位 | cleanChapterContent移到contentUtils.js，multiPlatformPublisher改为从contentUtils引用 | 消除跨模块职责混乱 |
| workshop.js去重 | generateMaterials/generateOutlines改为调用pipeline.js同名函数 | 369→220行（-149行） |
| 前端CreateProjectModal去重 | 提取handleTemplateGenerate公共函数 | 557→460行（-97行） |

---

## 十五、开发约定

1. **不加注释**：除非明确要求
2. **原子写入**：所有文件写入使用 tmp+rename 模式
3. **写锁**：并发写入同一记录时使用 acquireLock/releaseLock
4. **BOM处理**：读取JSON时 `.replace(/^\uFEFF/, '')`
5. **API响应格式**：成功返回 `{ success: true, ... }`，失败返回 `{ error: "message" }`
6. **章节字数**：中文字符计算，2500-3000目标，3300硬上限
7. **Agent提示词**：通过 `AGENT_PROMPTS` 对象管理，可通过 `/api/agents/:type/prompt` 动态获取
8. **素材去重**：名称相似度>70%视为重复，应update而非create
9. **伏笔管理**：10-30章内回收，超期30章标注警告
10. **License门控**：pipeline/workshop-fusion/publish/multi-api-key 需要对应会员等级
