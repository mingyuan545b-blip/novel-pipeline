# Novel-Pipeline 项目规范与交付标准

> 本文档为所有接手AI的开发规范和交付标准，任何修改必须遵循以下原则。
> 最后更新：2026-06-03（守卫服务+DataContext规范更新）

---

## 一、核心设计原则

### 1. 禁止硬编码业务规则
- **风格规则**：不得在Agent模板中硬编码特定风格的审核标准（如"爽点密度"、"打脸质量"等）
- **字数阈值**：不得在模板中写死具体数字，必须引用 `[WORD_LIMITS]` 占位符，由系统动态注入
- **审核标准**：通用审核清单放在模板中，风格特定规则由 `styleProfile` 动态注入
- **正确做法**：模板只定义结构规则，业务规则通过 `style-profiles/`、`constraint-presets/`、`pipelineConfig.js` 注入

### 2. 传输格式业务流程写死在基座
- Agent的输出格式（JSON结构）是基座协议，不可由模板或项目覆盖
- 所有审核Agent必须返回JSON，格式在 `pipeline.js` 的 `runPipelineStep` 中定义
- JSON解析失败时的fallback逻辑是基座行为，必须在 `pipeline.js` 中统一处理
- 新项目只需配置素材和风格，不需要重新搭建逻辑

### 3. 交付前必须测试
- 任何修改Agent模板、pipeline逻辑、风格配置后，必须运行完整流水线测试
- 测试必须覆盖：执笔人→审核→定稿人→润色→素材管理 全流程
- 测试结果必须验证：章节状态=approved、字数达标、review记录完整保存

### 4. 执行前考虑以往设计风格
- 修改前先阅读现有代码和模板，理解设计意图
- 不破坏已有的一致性设计（如review记录保存、fallback逻辑、PIPELINE_BLOCK机制）
- 新功能必须与现有架构兼容，不引入新的硬编码

### 5. 举一反三
- 修复一个Agent的问题时，检查所有同类Agent是否有相同问题
- 例如：修复fast-review的fallback不保存review记录时，同时检查first-review、second-review、final-editor
- 添加新检测逻辑时，考虑是否适用于其他步骤

### 6. 解决方案层级选择（治本优先于治标）
- **语义理解问题**（视角区分/术语判定/风格判断）→ 优先用LLM prompt工程解决
- **模式匹配**（正则检测）→ 只做安全网，只收题材特有造词，不收通用术语
- **判断标准**：如果LLM能理解这个概念（如"传感器是科技术语"），就不需要正则；如果LLM不认识（如"微胶囊网络"是本作造词），才需要正则兜底
- **新术语出现时**：不应扩展术语库，而应强化LLM视角感知能力（修prompt > 加正则）
- **反面教训**：曾把术语库从30条扩到100条，结果通用术语误杀日常用语，维护成本高，新术语还是检测不到

### 7. 修复必须追问根因
- 问题表面往往是症状，不是病因
- "术语没检测到" → 症状；"审核LLM没有视角感知" → 病因
- "章节卡住" → 症状；"约束矛盾/审核标准不合理" → 病因
- "字数膨胀到4800" → 症状；"流水线4个关卡无MAX_CHAPTER_WORDS拦截" → 病因
- 修症状=治标（加正则/加阈值/加计数器），修病因=治本（改prompt/改约束/改流程/补拦截关卡）
- 每次修复前必须问：这是症状还是病因？修症状的方案会不会引发新问题？

### 8. 两套系统必须对齐（流水线 vs 审计系统）
- pipeline.js（正常流水线）和 chapterAuditor.js（审计/返修系统）的检测逻辑必须一致
- 新增检测函数时，必须同时集成到两套系统
- 两套系统的硬性拦截等级必须对齐（什么该hardBlock，什么该warning）
- **血泪教训**：审计系统有MAX_CHAPTER_WORDS硬拦截，但流水线first-review/second-review/polisher/final-editor都没有，导致4800字膨胀

### 9. DataContext统一数据入口（强制）
- **所有Agent必须通过DataContext读取数据**，禁止直接调用store.getItem/queryItems
- DataContext是唯一数据入口，内部委托各服务层（entityCenter/timelineService/powerGuard等）
- 新增数据访问需求时，必须先在DataContext中添加委托方法，再在Agent中调用
- DataContext有缓存机制，同一projectId只创建一个实例，避免重复IO
- **违反此规则的代码不得合并**：任何`store.getItem('projects', projectId)`在Agent代码中出现都是违规
- **正确做法**：`const ctx = await getDataContext(projectId); const project = await ctx.getProject();`

### 10. 源头治理 · 增量演进（用户明确定调，最高优先级）
> 用户原话钉死：**"不要再对已存在的小说内容做改动，要在源头生成环节解决"**。
- **源头优先，禁止回炉改文**：问题在**生成端**解决（prompt/约束/校验/设计期/装配），
  **不得**去改写已产出的小说正文或既有素材来“把数据凑对”。
- **拒绝堵漏/打补丁**：不做**堵漏式**、**头痛医头脚痛医脚**、**打补丁**、**硬编码**式修复；
  一律追问根因（见原则 6/7），在**通用机制层**一次修好，而非逐点加特判。
- **开源 · 模块化 · 灵活**：以「开源模块化、灵活可扩展」为设计理念；能力走**注册表/配置/插件**
  驱动（如 `pipelineModuleRegistry`、字段注册表、题材插件），避免把业务写死进基座。
- **小步增量**：**每次只改一点点**，宁可多轮小改也不做大爆炸；**不堆屎山**式修复。
- **质量稳定优先于效率**：**不追求绝对效率**；**质量与稳定第一**，其次**体验**，最后才是**效率**。
- **落地判据**：改动前自问——(1) 是否在改已有内容？→ 停；(2) 是否只是掩盖症状的补丁/特判？→ 停；
  (3) 能否做成模块/配置而非硬编码？→ 做；(4) 这一步是否足够小、可回滚、可测？→ 否则拆小。

---

## 二、Agent输出格式规范（基座协议）

### 审核类Agent（first-review, second-review, fast-review）
```json
{
  "passed": true/false,
  "summary": "审核总结",
  "issues": [{"title": "问题标题", "description": "问题描述", "severity": "critical/high/medium"}],
  "suggestions": ["建议1"]
}
```

### 定稿人Agent（final-editor）
```json
{
  "approved": true/false,
  "action": "approve/reject/revise",
  "edits": [{"description": "修改项", "severity": "critical/minor"}],
  "ipDirection": "后续剧情方向",
  "materialGuidance": "素材更新建议",
  "scheduleNote": "排期备注"
}
```

### 写作类Agent（writer, reviser, polisher）
- 直接输出纯文本正文
- 不附加任何说明、不插入多余空行、不使用Markdown
- 若检测到无法完成的约束，输出 `[PIPELINE_BLOCK:原因]`

---

## 三、Pipeline流程规范

### 长篇模式（统一模式，完整审核链）
```
意图规划 → 执笔人(writer) → [字数检查] → 初审(first-review) → 复审(second-review) → 定稿人(final-editor) → 润色师 → 素材管理
                ↓失败          ↓失败+硬性检测     ↓失败+硬性检测      ↓字数检查
            字数不足→重写   返修员←──┘        返修员←──┘       截断超限
```

> 说明：系统已统一为长篇模式（novel），爽文(shuangwen)和番茄短篇(tomato-short)模式已移除。

### 字数阈值（由 server/config/wordConfigSchema.js + project.wordConfig 动态管理）

| 字段 | 默认值 | 说明 |
|------|--------|------|
| rejectMin | 1800 | 拒绝下限（兼容字段，新数据用 minWords） |
| targetMin | 2200 | 目标字数下限 |
| targetMax | 2800 | 目标字数上限 |
| maxWords | 3500 | 章节最大字数（系统上限 MAX_WORD_COUNT） |
| MAX_RETRIES | 3 | 最大重试次数（来自 PIPELINE.MAX_CHAPTER_RETRIES） |

> 配置层级：systemConfigDefs.js（系统默认）→ project.wordConfig（项目覆盖）→ 题材插件（题材特定）

### 字数拦截关卡（6道防线）

| 关卡 | 位置 | 检查内容 | 行为 |
|------|------|---------|------|
| 1 | writer输出后 | wordCount < REJECT_MIN | 退回重写 |
| 2 | writer输出后 | wordCount > MAX_CHAPTER | 截断 |
| 3 | first-review前 | wordCount < REJECT_MIN | hardBlock |
| 4 | **first-review前** | **wordCount > MAX_CHAPTER** | **hardBlock** ✅新增 |
| 5 | **second-review后** | **wordCount > MAX_CHAPTER** | **hardBlock** ✅新增 |
| 6 | **final-editor后** | **wordCount > MAX_CHAPTER** | **截断** ✅新增 |
| 7 | **polisher后** | **wordCount > MAX_CHAPTER** | **截断** ✅新增 |

**血泪教训**：之前只有关卡1和2，关卡3只检查下限不检查上限。reviser/publish可膨胀到任意字数，导致第一章4800字（超标37%）。现在6道防线全覆盖。

### 审核不通过时的重写逻辑
1. 字数不足 → 用writer全文重写
2. 字数足够但审核不通过 → 用reviser局部修改
3. 多位审核者拒绝 → 汇总所有反馈，标注"多位审核者意见汇总"
4. 达到MAX_ROUNDS仍未通过 → 章节状态重置为outlined

---

## 四、LLM路由规范

### 默认路由（统一aliyunCoding）
- **所有Agent**：aliyunCoding（qwen3.6-plus）— 由 `server/config/providerDefs.js` 的 `DEFAULT_STEP_ASSIGNMENTS` 统一分配
- 覆盖Agent：writer, reader, reviser, intent-planner, material-manager, polisher, first-review, second-review, fast-review, final-editor

### 配置层级
1. **项目级**：`project.agentModelConfig[step]`（项目设置中按Agent配置provider/model/keyId）
2. **步骤覆盖**：`project.agentStepOverrides`（按provider扩展步骤分配）
3. **全局默认**：`LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL` 环境变量
4. **系统兜底**：aliyunCoding（qwen3.6-plus）

### 已弃用Provider（自动迁移到aliyunCoding）
- minimax / lmstudio / openai — 详见 `server/config/providerRegistry.js` 的 `DEPRECATED_PROVIDERS`

### 返修系统LLM路由
- **返修(repair)**：与正常流水线相同路由（可在前端选择provider/model）
- **返修审核(review)**：与正常流水线相同路由
- **后续流水线**：与正常流水线相同路由

---

## 五、HARD BLOCK机制（完整版）

程序化检测在初审前/复审后/返修后执行，检测到问题直接拦截：

### 流水线first-review硬性检测

| 检测器 | 检测内容 | 拦截级别 | 位置 |
|--------|---------|---------|------|
| `detectModernSlang` | 网络用语/网文腔 | 🔴 critical hardBlock | contentUtils.js |
| `detectAdultPerspective` | 视角违规(critical级) | 🔴 critical hardBlock | contentUtils.js |
| `detectPipelineMetadataLeak` | 管线元数据泄露 | 🔴 critical hardBlock | contentUtils.js |
| `scanSensitiveWords` | 敏感词(block级) | 🔴 **critical hardBlock** ✅升级 | sensitiveWordGuard.js |
| 字数 < REJECT_MIN | 字数不达标 | 🔴 critical hardBlock | pipeline.js |
| **字数 > MAX_CHAPTER** | **字数超标** | 🔴 **critical hardBlock** ✅新增 | pipeline.js |
| `detectTechJargon` | 科技术语(幼崽视角) | ⚠️ high warning | contentUtils.js |
| `detectCrossChapterRepetition` | 跨章重复 | ⚠️ high warning | contentUtils.js |
| `detectOnomatopoeiaDensity` | 拟声词密度 | ⚠️ warning | contentUtils.js |
| `detectVisualAnchors` | 视觉锚点 | ⚠️ warning | contentUtils.js |
| `detectMotherChildDialogue` | 母子对话 | ⚠️ warning | contentUtils.js |

### 流水线second-review硬性检测

| 检测器 | 检测内容 | 拦截级别 |
|--------|---------|---------|
| `detectTechJargon` | 科技术语(幼崽视角) | 🔴 critical hardBlock |
| **字数 > MAX_CHAPTER** | **字数超标** | 🔴 **critical hardBlock** ✅新增 |

### 审计系统_runHardBlockChecks

| 检测器 | 检测内容 | 拦截级别 |
|--------|---------|---------|
| `detectAdultPerspective` | 视角违规(critical) | 🔴 hardBlock |
| `detectTechJargon` | 科技术语 | 🔴 hardBlock |
| `detectPipelineMetadataLeak` | 元数据泄露 | 🔴 hardBlock |
| `detectModernSlang` | 网络用语 | 🔴 hardBlock |
| `scanSensitiveWords` | 敏感词 | 🔴 hardBlock |
| **`detectCrossChapterRepetition`** | **跨章重复** | 🔴 **hardBlock** ✅新增 |
| 字数 < REJECT_MIN | 字数不足 | 🔴 hardBlock |
| 字数 > MAX_CHAPTER | 字数超标 | 🔴 hardBlock |

### 初审技法提示（注入审核prompt，不拦截）

| 检测器 | 提示标记 |
|--------|---------|
| `detectTellVerbs` | 【展示代替告知检测】 |
| `calcInfoDripScore` | 【信息注入节奏检测】 |
| `extractEndingTension` | 【章节收尾检测】 |
| `detectModernSlang` | 【年代语言污染检测 - 严重违规】 |
| `detectAdultPerspective` | 【视角违规检测 - 严重违规】/【视角偏移检测 - 需调整】 |
| `detectTechJargon` | 【科技术语检测 - 幼崽视角违规】 |
| `detectCrossChapterRepetition` | 【跨章相似提示】 |

---

## 六、返修系统架构规范

### 1. 返修必须复用流水线检测体系
- 返修不是独立系统，是流水线的延伸
- 返修后必须执行与流水线相同的硬性检测（_runHardBlockChecks）
- 返修后的字数控制必须与流水线一致：0.9x ≤ 新字数 ≤ 1.1x 原字数
- 返修不得绕过流水线的任何质量关卡

### 2. 返修字数控制（4重检查）
- **相对下限**：返修后字数不得低于原字数的90%（防止丢失内容）
- **相对上限**：返修后字数不得超过原字数的110%（防止膨胀）
- **绝对下限**：返修后字数不得低于REJECT_MIN_WORDS（1800字）
- **绝对上限**：返修后字数超过MAX_CHAPTER_WORDS（3500字）则截断
- **血泪教训**：之前只有相对检查(90%-110%)，没有绝对阈值，形成膨胀链：2000→2200→2420→2662→2928→3221→3543→3897→4287→4716→4800

### 3. 返修内容清洗流程
```
LLM输出 → cleanChapterContent → deduplicateContent → cleanFinalContent
        → validateTomatoMetrics(pipelineConfig) → ensureCliffhanger
        → 字数检查(4重) → _runHardBlockChecks → 保存
```

> 说明：`validateTomatoMetrics` 和 `ensureCliffhanger` 仍保留为通用清洗函数，参数已改为 `pipelineConfig`，不再绑定特定模式。

### 4. 返修重试机制（repairWithRetry）
- 支持一直重试直到通过（maxRetries默认10）
- 每次重试后执行 auditChapter + reviewChapter
- 通过条件：(reviewPassed && !hasCriticalViolation) || (auditClean && reviewPassed)
- 支持用户中途取消（shouldCancel回调）
- 通过后自动走后续流水线（first-review → second-review → final-editor → polisher → material-manager）

### 5. 返修层级选择
- **规则层修复**（优先）：用正则/规则引擎做确定性替换（如术语替换、拟声词插入）
- **LLM层修复**（次选）：只有规则层无法处理的才调用LLM（如视角转换、情节调整）
- **流水线层修复**（最后）：严重问题应走完整流水线重写，而非局部返修

### 6. 返修不得影响正常流水线
- 返修操作不得修改流水线核心逻辑（pipeline.js）
- 返修后的章节如果走后续流水线，必须从复审开始，不得跳过任何步骤
- 返修的快照/回滚机制独立于流水线的版本快照

---

## 七、Fallback逻辑规范

### JSON解析失败时的处理
1. **检测PIPELINE_BLOCK**：`/\[PIPELINE_BLOCK:/` → 视为阻断，不通过
2. **检测小说正文**：文本长度>500且前50字无`{` → 视为模型输出错误，不通过
3. **检测严重问题关键词**：严重问题/设定矛盾/逻辑错误/重大缺陷 → 不通过
4. **其他情况**：通过

### 必须保存review记录
- 即使JSON解析失败，也必须保存fallback review记录到store
- 记录中标注"Markdown格式"或"PIPELINE_BLOCK"以便追踪

---

## 八、风格配置规范

### style-profiles/ 目录
- 每个风格一个JSON文件
- 包含：name, description, rules（POV, dialogue, behavior, tone, reviewFocus, forbidden）
- 审核Agent通过 `styleProfile` 字段动态加载对应规则

### constraint-presets/ 目录
- 每个约束一个JSON文件
- 可组合使用，项目创建时选择需要的约束
- 不得在模板中硬编码约束内容

---

## 九、交付检查清单

### 代码修改后必检项
- [ ] 是否引入了硬编码的业务规则？（字数、风格、审核标准）
- [ ] 是否所有审核Agent的fallback都保存了review记录？
- [ ] 是否所有审核Agent的prompt都强制了JSON输出格式？
- [ ] 修改是否与现有设计一致？（review记录格式、fallback逻辑）
- [ ] 是否举一反三检查了同类Agent？
- [ ] **新增检测是否同时集成到pipeline.js和chapterAuditor.js？**
- [ ] **字数检查是否覆盖所有输出点（writer/reviser/polisher/final-editor）？**
- [ ] **是否通过DataContext读取数据？（禁止Agent直接调用store）**
- [ ] **新守卫服务是否集成到DataContext？**
- [ ] **知识库表DDL是否同步到knowledgeSchema.js？**

### 流水线测试必检项
- [ ] 章节最终状态是否为 `approved`？
- [ ] 字数是否在目标区间内？
- [ ] review记录是否完整保存（每个审核步骤都有记录）？
- [ ] 定稿人是否返回了JSON格式（而非小说正文）？
- [ ] 润色师是否正常执行？
- [ ] 素材管理是否正常更新？
- [ ] **字数是否超过MAX_CHAPTER_WORDS？**

---

## 十、代码操作安全规范（血泪教训）

### 1. 优先使用 cmd / Node，禁止用 PowerShell 操作含 Unicode 的文件
- 本机环境不支持 PowerShell → **命令一律优先使用 cmd 或 Node.js**
- 禁止用 PowerShell 的 `Set-Content`、`-replace` 等命令修改包含中文/emoji 的源代码文件
  （PowerShell 默认编码会破坏 UTF-8 多字节字符，导致文件不可逆损坏）
- **推荐替代**：使用 Node.js 脚本（`node -e`）或 SearchReplace 工具操作文件

### 2. 禁止用 PowerShell 进行 API 测试
- 禁止使用 PowerShell 的 `Invoke-RestMethod` 等命令测试 API
  （PowerShell 对 JSON 嵌套、特殊字符、长响应处理差，容易超时或丢失数据）
- **推荐替代**：使用 `node -e` 脚本测试 API
- **示例**：`node -e "fetch('http://localhost:3001/api/models').then(r=>r.json()).then(d=>console.log(d))"`

### 3. 命令语法（cmd 为准）
- cmd 支持 `&&` / `&` / `||` 串联命令；**禁止混入 bash 专有语法**（`| tail`、`$1`、`2>&1`）或 PowerShell 专有语法
- **错误**：`cd dir; npm start`（分号是 PowerShell/bash 写法）
- **正确**：`cd dir && npm start` 或分两步执行
- 含中文的 `.bat` 需存为 **ASCII 或 GBK** 并保持 **CRLF** 换行（UTF-8 会被 cmd 按 OEM 代码页误读）

### 4. 文件修改工具优先级
1. **SearchReplace工具**（首选）- 精确替换，不破坏编码
2. **Node.js脚本**（次选）- `node -e "const fs=require('fs');..."`
3. **Write工具**（重写整个文件时使用）
4. **cmd 批处理 / 其他**（最后手段；操作含中文文件时仍优先 Node/SearchReplace）

### 5. 修改前必须备份关键文件
- 对PipelinePage.jsx等大文件（>500行）做修改前，先确认有恢复手段
- 如果文件被损坏，优先用git恢复：`git checkout -- <file>`
- 没有git时，用Node.js脚本修复编码，不要用PowerShell（本机不支持）

### 6. 批量替换必须验证
- 任何批量替换操作后，必须立即编译验证（`node -c <file>`）
- 发现编译错误时，立即停止，不要继续做其他修改
- 一次只做一个修改，验证通过后再做下一个

---

## 十一、Review记录保存规范

### 所有审核步骤必须保存的统一字段
```javascript
{
    id: uuidv4(),
    chapterId,
    projectId,
    step: '<step-name>',        // 必填！'first-review'|'second-review'|'fast-review'|'final-editor'
    type: '<step-name>',        // 与step保持一致
    reviewer: '<step-name>-agent',
    result: parsedObject,       // 保存完整解析后的对象，不是字符串
    passed: boolean,            // 必填！从parsed.passed或parsed.approved提取
    content: parsed.summary || '',
    issues: parsed.issues || parsed.edits || [],
    suggestions: parsed.suggestions || [],
    round,
    createdAt: new Date().toISOString()
}
```

### 关键约束
- `step`字段**必须填写**，前端依赖此字段匹配pipelineSteps显示标签
- `passed`字段**必须填写**，前端三处判断逻辑都依赖此字段
- `result`必须保存**对象**而非字符串，前端通过`result.passed`/`result.approved`判断
- fallback路径和正常JSON解析路径**都必须保存**review记录
- 定稿人的`passed`从`parsed.approved`提取：`passed: !!parsed.approved`

### 前端判断"通过"的三重逻辑（必须兼容）
```javascript
// Pipeline Logs
log.result?.passed !== undefined  →  log.result.passed ? '通过' : '未通过'

// Review Logs
review.result?.passed === true || review.result?.approved === true || review.passed === true

// Agent输出详情
parsed.passed || parsed.approved  →  '✅ 通过' : '❌ 未通过'
```

---

## 十二、素材库数据规范

### 素材创建时字段映射
- 前端可能传`content`、`initialContent`、`currentContent`中的任意一个
- 后端POST接口必须兼容：`currentContent || initialContent || content`
- `initialContent`和`currentContent`都必须赋值，不能为空

### 素材加载规范
- 选择素材时**必须从服务器获取最新数据**，不能只读内存中的旧数据
- 编辑素材时**必须从服务器获取最新数据**填充表单
- 保存/删除/创建后**必须重新加载素材列表**

---

## 十三、Agent输出渲染规范

### Markdown渲染
- 所有Agent输出（审核类+写作类）统一使用ReactMarkdown渲染
- ReactMarkdown必须添加`className="markdown-content"`以应用样式
- 审核类输出先解析JSON，再对文本字段使用Markdown渲染

### 审核输出布局：建议与通过分离
- **左侧**：审核状态卡片（通过/未通过 + 风格评分 + 动作 + 字数）
- **右侧**：审核摘要（Markdown渲染）
- **下方分块**：
  - ⚠ 发现问题（红色边框，severity颜色区分）
  - ✏ 修改项（橙色边框）
  - 💡 建议（蓝色边框，独立区块）
  - 📌 后续方向 / 📦 素材指导（绿色/紫色边框）

---

## 十四、项目隔离规范

### 核心原则：数据按projectId隔离，互不干扰

1. **store.queryItems必须使用精确匹配**：`queryItems` 对所有字段使用 `===` 精确比较，禁止 `includes` 模糊匹配
2. **所有数据查询必须带projectId**：素材、章节、审核记录、任务、时间线等所有项目级数据查询必须传 `projectId`
3. **Agent提示词项目级覆盖**：通过 `project.agentOverrides[agentType]` 实现，不影响全局模板和其他项目
4. **Agent列表接口从store加载**：`GET /pipeline/agents` 从 `agent-templates` store读取，不依赖内存全局对象
5. **Agent提示词保存支持项目级**：`PUT /agents/:type/prompt` 有projectId时保存到 `project.agentOverrides`，无projectId时保存到 `agent-templates` store

---

## 十五、数据清理规范

### 清日志标准检查清单

#### 第一步：确定清理范围
- [ ] 确认当前活跃项目的projectId
- [ ] 列出所有项目，标记哪些是旧项目
- [ ] 确认要保留的章节数量

#### 第二步：Store数据清理（必须按顺序）
- [ ] **1. 先停流水线**：调用 `POST /api/pipeline/infinite/stop`
- [ ] **2. 再删reviews**：删除非当前项目的reviews
- [ ] **3. 再删materials**：删除非当前项目的materials
- [ ] **4. 再删chapters**：删除非当前项目的chapters + 重置状态为outlined
- [ ] **5. 最后删projects**：删除非当前项目
- [ ] **6. 验证孤儿记录**
- [ ] **7. 验证素材残留**
- [ ] **8. 验证章节状态**

#### 第三步：Output文件清理
- [ ] 删除非当前项目的output目录
- [ ] 删除指定章节的审核文件和最终稿

#### 第四步：验证
- [ ] 验证Store数据
- [ ] 验证章节状态
- [ ] 验证审核记录
- [ ] 验证服务启动

---

## 十六、基座固化规范

> 核心原则：所有修复过的bug，必须在基座代码中固化，不能只改项目数据。新项目导入时自动生效。

### 已固化到代码的修复（完整版，50+轮迭代）

| # | 坑 | 固化位置 | 固化方式 |
|---|---|---------|---------|
| 1 | 流水线卡死在失败章节 | pipeline.js | `_pipelineRetries` 持久化，超限永久跳过 |
| 2 | 字数不达标没拦截 | pipeline.js | writer后+审核前双重硬拦截 |
| 3 | 伏笔预算超限 | hookBudget.js | 活跃伏笔达MAX_ACTIVE_HOOKS(12)拒绝注册 |
| 4 | 垃圾伏笔数据 | hookBudget.js | 流水线启动时自动清理 |
| 5 | 审核约束重复注入 | pipeline.js | content中不再重复调用buildConstraintInjection |
| 6 | 润色/执笔输出分析内容 | pipeline.js + contentUtils.js | prompt强化 + cleanChapterContent后处理 |
| 7 | writer输出未清理 | pipeline.js | writer输出经过cleanChapterContent清理后再保存 |
| 8 | Foundation prompt输出格式 | agentPrompts.js | 绝对红线增加"严禁输出分析过程" |
| 9 | 模板导入不过滤约束 | templateImporter.js | 萌宝题材自动移除不兼容约束 |
| 10 | Style profile无fallback | agentPrompts.js | FALLBACK_BABY_PROFILE硬编码 |
| 11 | Constraint presets无fallback | agentPrompts.js | FALLBACK_CONSTRAINT_PRESETS硬编码 |
| 12 | stop不清理计数器 | pipeline.js | 停止时必须清除所有计数器 |
| 13 | permanentlySkipped判断过宽 | pipeline.js | 只检查status，不凭计数器强制标记 |
| 14 | 去重正则malformed | contentUtils.js | normalizeForDedup拆分两步replace |
| 15 | 科技术语无程序化检测 | contentUtils.js | detectTechJargon + HARD BLOCK |
| 16 | 无跨章重复检测 | contentUtils.js | detectCrossChapterRepetition + HARD BLOCK |
| 17 | 素材注入三重叠加 | pipeline.js | 统一MEMORY_COVERED集合 |
| 18 | 金句/名场面全量注入无上限 | pipeline.js | catchphrase限5条、famous-scene限3条 |
| 19 | 敏感词漏检 | pipeline.js | scanSensitiveWords集成到初审HARD BLOCK |
| 20 | **字数膨胀到4800** | **pipeline.js** | **6道防线：first-review/second-review MAX硬拦截 + final-editor/polisher截断** |
| 21 | **敏感词仅warning不拦截** | **pipeline.js** | **scanSensitiveWords升级为critical hardBlock** |
| 22 | **审计系统缺跨章重复检测** | **chapterAuditor.js** | **_runHardBlockChecks添加detectCrossChapterRepetition** |
| 23 | **返修缺清洗函数支持** | **chapterAuditor.js** | **repairChapter添加validateTomatoMetrics+ensureCliffhanger** |
| 24 | **返修审核缺技法提示** | **chapterAuditor.js** | **reviewChapter添加_buildTechniqueHints** |
| 25 | **wordCount计算不统一** | **pipeline.js** | **全部统一为.replace(/\s/g,'').length** |
| 26 | 执行日志重启丢失 | pipeline.js | 持久化到store('pipeline-logs') |
| 27 | 返修员输出不可见 | pipeline.js | reviserOutput保存清理后正文 |
| 28 | 日志残留 | pipeline.js | 启动时清空+直接替换 |
| 29 | 审核矫枉过正 | agentPrompts.js | 约束增加排除条款+检测器区分视角 |
| 30 | 约束矛盾 | reviewRemediation.js | 移除adjuster+isRuleRedundant去重 |
| 31 | 字数要求LLM不遵守 | agentPrompts.js | 改为自然语言"你必须写出X-Y字" |
| 32 | 发布超时 | routes/publish.js | 异步任务模式+前端轮询 |
| 33 | 约束词极度膨胀 | promptAuditor.js | 概念注册表+膨胀规则+自动去重 |
| 34 | 多平台发布 | multiPlatformPublisher.js | Playwright驱动5个平台 |
| 35 | 章节审计系统 | chapterAuditor.js | 全量扫描+违规记录+定点返修+批量操作 |
| 36 | 提示词自动优化 | promptOptimizer.js | 问题模式检测+安全优化建议 |
| 37 | 返修重试机制 | chapterAuditor.js | repairWithRetry支持一直重试到通过 |
| 38 | 返修停止按钮 | chapterAudit.js + PipelinePage.jsx | 任务取消API+前端停止按钮 |

---

## 十七、踩坑归因分类体系（基底 vs 规范）

> 核心原则：**基底 = 程序化强制执行，系统自动拦截；规范 = 人工/AI自觉遵守的规则。**
> 所有踩过的坑必须先问：**能不能用代码自动防止？**如果能，归入基底；如果不能，归入规范。

### A. 基底类（已固化到代码，系统自动防护）

| # | 规律/坑 | 固化方式 | 防护效果 |
|---|---------|---------|---------|
| 1 | 章节状态卡在中间态 | 状态机常量+启动校验 | STUCK_STATUSES不含completed状态 |
| 2 | 删除章节不级联 | DELETE自动删除关联reviews+materials | 无孤儿数据 |
| 3 | 字数不达标没拦截 | writer后+审核前双重硬拦截 | 低于REJECT_MIN直接退回 |
| 4 | **字数超标没拦截** | **6道防线全覆盖** | **超过MAX_CHAPTER自动拦截/截断** |
| 5 | 伏笔预算超限 | registerHook硬上限 | 达MAX_ACTIVE_HOOKS拒绝注册 |
| 6 | 科技术语穿透防线 | detectTechJargon+HARD BLOCK | 题材术语程序化检测 |
| 7 | 跨章逐字复制 | detectCrossChapterRepetition+HARD BLOCK | 重叠>40%自动拦截 |
| 8 | 素材注入三重叠加 | 统一MEMORY_COVERED集合 | 已覆盖类型不重复注入 |
| 9 | 金句/名场面无限膨胀 | catchphrase限5条、famous-scene限3条 | 硬上限防止上下文溢出 |
| 10 | 敏感词漏检 | scanSensitiveWords+HARD BLOCK | block级敏感词自动拦截 |
| 11 | **敏感词仅warning** | **升级为critical hardBlock** | **不再放行block级敏感词** |
| 12 | 流水线卡死在失败章节 | _pipelineRetries持久化+MAX_CHAPTER_RETRIES | 超限自动标记permanently-skipped |
| 13 | stop不清理计数器 | stopInfinitePipeline清除所有计数器 | 停止时自动重置 |
| 14 | 审核反馈累积无去重 | addFeedbackPart统一去重 | 同来源反馈只保留最新 |
| 15 | wordCount虚高 | 统一.replace(/\s/g,'').length | 字数统计准确 |
| 16 | **返修字数膨胀链** | **4重字数检查(相对+绝对)** | **不再形成膨胀链** |
| 17 | **两套系统检测不一致** | **pipeline+auditor同步更新** | **检测逻辑对齐** |

### B. 规范类（需人工/AI自觉遵守）

| # | 规律/坑 | 规范内容 |
|---|---------|---------|
| 1 | 禁止硬编码业务规则 | 模板只定义结构，业务规则通过配置注入 |
| 2 | 传输格式写死在基座 | Agent输出JSON格式是基座协议 |
| 3 | 修复bug必须同时修两处 | 代码逻辑+fallback/默认值 |
| 4 | 正则必须单元测试 | 所有正则模式必须有测试用例 |
| 5 | 计数器必须定义完整生命周期 | 创建/递增/重置/上限四要素 |
| 6 | 状态枚举必须明确分类 | 进行中/已完成/失败/终态 |
| 7 | 清日志必须先停流水线 | 否则清完又被重新生成 |
| 8 | 清日志必须全链路同步 | reviews→materials→chapters→output级联 |
| 9 | 优先cmd，禁止用PowerShell操作Unicode文件 | 用cmd/Node.js脚本或SearchReplace替代 |
| 10 | 命令记录禁bash/PowerShell专有语法 | 用cmd语法（&&/&）或分步执行 |
| 11 | 新增检测必须集成到HARD BLOCK | 检测而不拦截等于没检测 |
| 12 | **新增检测必须同时集成到两套系统** | **pipeline.js和chapterAuditor.js同步** |
| 13 | **字数检查必须覆盖所有输出点** | **writer/reviser/polisher/final-editor** |
| 14 | 修复必须追问根因 | 症状vs病因，治本优先 |
| 15 | 两套系统必须对齐 | 流水线vs审计系统的检测逻辑必须一致 |

---

## 十八、前端UI设计原则

### 核心理念：一切以人的视角去考虑

1. **数据先行，交互在后**：页面加载时自动拉取已有数据
2. **字段名必须匹配后端数据结构**：用兼容写法 `c.label || c.name || c.id`
3. **审核结果结构化展示**：必须解析为issues/edits/suggestions分块展示
4. **正文分段显示**：按段落分隔，交替背景色
5. **点击查看，编辑需确认**：列表项点击=查看详情
6. **约束和风格必须可见**：核心业务数据必须有独立Tab页
7. **Agent配置自动加载**：页面加载时自动拉取显示
8. **智能解析审核输出**：JSON解析成功则结构化展示，失败则fallback原始文本
9. **返修进度实时可见**：显示每次尝试的结果、模型、修复项数
10. **返修可中断**：长时间返修提供停止按钮

---

## 十九、多平台发布系统

### 支持平台
| 平台 | 发布方式 | 特殊处理 |
|------|---------|---------|
| 七猫 | Playwright自动化 | AI内容声明弹窗、5秒等待确认 |
| 番茄 | Playwright自动化 | - |
| 起点 | Playwright自动化 | - |
| 晋江 | Playwright自动化 | - |
| 飞卢 | Playwright自动化 | - |

### 发布配置缓存
- 发布配置（平台选择、作品ID等）缓存到project对象
- 避免每次发布都重新输入

### 发布超时处理
- 发布改为异步任务模式
- 前端通过轮询获取状态
- 默认超时10分钟

---

## 二十、提示词审计与优化系统

### promptAuditor.js — 约束词审计
- **概念注册表**：防止同一概念多次注入
- **膨胀规则**：检测约束词是否过度膨胀
- **自动去重**：STYLE_COVERED_CONSTRAINTS自动跳过已覆盖约束
- **健康度评分**：综合评估提示词质量

### promptOptimizer.js — 提示词自动优化
- **问题模式检测**：detectProblemPatterns分析多章重复问题
- **安全优化建议**：只建议不自动执行
- **版本快照**：优化前自动保存当前版本

---

## 二十一、章节审计系统

### chapterAuditor.js — 全量章节扫描与返修

**核心方法**：
| 方法 | 职责 |
|------|------|
| `auditChapter` | 扫描单章所有违规（12项检测） |
| `auditAll` | 批量扫描所有章节 |
| `repairChapter` | 单次返修（LLM调用+内容清洗+硬性检测） |
| `repairWithRetry` | 循环返修直到通过 |
| `reviewChapter` | LLM审核（含技法提示注入） |
| `_runHardBlockChecks` | 硬性检测（8项，与流水线对齐） |
| `_buildTechniqueHints` | 构建技法提示（7项，与流水线初审对齐） |
| `rollbackRepair` | 回滚返修（使用快照） |

**前端入口**：PipelinePage.jsx 审计面板
- 全量扫描按钮
- 分页显示（每页30章）
- 单章/批量返修
- 返修进度实时显示
- 停止按钮
- 返修结果对比窗口

---

## 二十二、关键数据流图

### 正常流水线数据流
```
用户点击"启动无限流水线"
  → runInfinitePipeline(projectId)
    → 循环所有章节:
      → runFullPipeline(projectId, chapterId)
        → runPipelineStep('intent-planner')
        → runPipelineStep('writer')
          → cleanChapterContent → deduplicateContent → truncateChapter
          → 字数 < REJECT_MIN → 退回重写
        → runPipelineStep('first-review')
          → 技法提示注入(detectTellVerbs/calcInfoDripScore/...)
          → LLM审核
          → 硬性检测(detectModernSlang/detectAdultPerspective/...)
          → 字数 < REJECT_MIN → hardBlock
          → 字数 > MAX_CHAPTER → hardBlock ✅新增
        → runPipelineStep('second-review')
          → LLM审核
          → detectTechJargon hardBlock
          → 字数 > MAX_CHAPTER → hardBlock ✅新增
        → runPipelineStep('final-editor')
          → LLM审核
          → cleanFinalContent
          → 字数 > MAX_CHAPTER → 截断 ✅新增
        → runPipelineStep('polisher')
          → cleanChapterContent ✅新增
          → 字数 > MAX_CHAPTER → 截断 ✅新增
        → runPipelineStep('material-manager')
```

### 返修数据流
```
用户点击"返修"或"直到修复为止"
  → repairWithRetry(chapterId, instructions, llm, pipeline)
    → 循环(maxRetries=10):
      → repairChapter(chapterId, instructions, llm)
        → LLM返修
        → cleanChapterContent → deduplicateContent → cleanFinalContent
        → validateTomatoMetrics(pipelineConfig) ✅新增
        → ensureCliffhanger ✅新增
        → 字数4重检查(相对90%-110% + 绝对REJECT_MIN + 绝对MAX_CHAPTER)
        → _runHardBlockChecks(8项检测，含跨章重复) ✅增强
        → auditChapter(12项检测)
        → _updateMaterial(素材同步)
      → reviewChapter(chapterId, llm)
        → _buildTechniqueHints(7项技法提示) ✅新增
        → LLM审核(含科技术语判定标准) ✅新增
        → _runHardBlockChecks
      → 判断通过条件
      → 通过 → _runFollowUpPipeline(first-review→second-review→final-editor→polisher→material-manager)
```

---

## 二十三、文件索引与修改频率

### 后端核心文件（修改频率最高）

| 文件 | 行数 | 职责 | 修改注意 |
|------|------|------|---------|
| `server/services/pipeline.js` | ~4000 | 流水线引擎 | 最核心，改动影响最大 |
| `server/services/agentPrompts.js` | ~800 | 提示词构建 | 修改需同步fallback |
| `server/services/contentUtils.js` | ~1000 | 内容处理+检测 | 正则修改需测试 |
| `server/services/chapterAuditor.js` | ~900 | 章节审计+返修 | 检测逻辑须与pipeline对齐 |
| `server/services/promptAuditor.js` | ~500 | 约束词审计 | 健康度评分阈值 |
| `server/services/promptOptimizer.js` | ~400 | 提示词优化 | 只建议不执行 |
| `server/services/multiPlatformPublisher.js` | ~600 | 多平台发布 | Playwright选择器易过时 |
| `server/store.js` | ~150 | 数据层 | 大小限制需同步 |
| `client/src/pages/PipelinePage.jsx` | ~1500 | 流水线页面 | 前端最复杂 |

### 配置文件

| 文件 | 职责 |
|------|------|
| `data/agent-templates/*.json` | Agent提示词模板 |
| `data/constraint-presets/*.json` | 约束预设 |
| `data/style-profiles/*.json` | 风格配置 |
| `data/foundation-prompts/*.json` | 基座提示词 |
| `server/services/pipelineConfig.js` | 流水线配置 |
| `.env` | 环境变量 |

---

## 二十四、已知限制与待改进

1. **单章流水线运行时前端无法实时获取步骤日志** — 需要SSE或WebSocket推送
2. **定稿人拒绝3轮后直接失败** — 应考虑更灵活的策略
3. **润色师依赖aliyunCoding API** — 本地模型不支持
4. **cleanChapterContent可能误删正文** — 正则匹配过于宽泛
5. **三幕结构节点（每15章）** — 已在style-profile中配置，但尚未在pipeline中强制执行
6. **模板导入后约束验证** — 需要更完善的冲突检测
7. **返修后素材同步不够精确** — 只做简单字符串匹配
8. **多平台发布选择器易过时** — 平台改版后需手动更新

---

## 二十五、快速上手步骤

1. **启动服务**：`cd server; npm start`
2. **打开前端**：`cd client; npm run dev`
3. **创建项目**：创作工坊 → 导入范本 或 手动创建
4. **配置LLM**：系统设置 → 添加API Key → 绑定Agent
5. **启动流水线**：流水线页面 → 启动无限流水线
6. **监控执行**：执行日志面板 + Agent输出详情
7. **审计章节**：审计面板 → 全量扫描 → 定点返修
8. **发布章节**：发布页面 → 选择平台 → 配置作品ID → 发布
9. **遇到问题**：先查本文档的踩坑记录，再查 [docs/INDEX.md](docs/INDEX.md) 的SOP索引

---

## 二十六、守卫服务开发规范

### 1. 守卫服务标准接口

每个守卫服务必须提供以下三类方法：

| 方法类型 | 命名规范 | 说明 | 调用方 |
|---------|---------|------|--------|
| 检查方法 | `checkXxx(projectId, chapterNumber)` | 执行检查，返回问题列表 | review步骤 |
| 提示方法 | `generateXxxHint(projectId, chapterNumber)` | 生成writer注入文本 | writer步骤 |
| 审计方法 | `generateXxxCheckHint(projectId, chapterNumber)` | 生成review注入文本 | review步骤 |

### 2. 守卫服务集成流程

新增守卫服务时，必须按以下步骤集成：

1. **创建服务文件**：`server/services/xxxGuard.js`
2. **实现标准接口**：checkXxx / generateXxxHint / generateXxxCheckHint
3. **集成到DataContext**：在dataContext.js中import并添加委托方法
4. **writer集成**：在writer.js中调用ctx.getXxxHint()注入提示
5. **review集成**：在review.js中调用ctx.getXxxCheckHint()注入检查结果
6. **API路由**：在knowledge.js中添加GET/POST路由
7. **前端API**：在api.js中添加对应方法
8. **验收脚本**：创建verify-tX.js验收脚本

### 3. 守卫服务配置常量

每个守卫服务的阈值必须提取为CONFIG常量，禁止硬编码：

```javascript
// 正确
const FORESHADOW_CONFIG = {
    OVERDUE_ADVANCE_CHAPTERS: 10,
    OVERDUE_RESOLVE_CHAPTERS: 30,
    IMPORTANT_OVERDUE_CHAPTERS: 5,
    TARGET_RESOLVE_RATE: 0.7
};

// 错误
if (chaptersSinceAdvance > 10) { ... }
```

### 4. 守卫服务与题材插件的关系

- 守卫服务是**通用逻辑**，不依赖特定题材
- 题材特定阈值通过genre插件的entitySchema或constraints定义
- 守卫服务从genreSchema读取阈值，不从代码中硬编码
- 例如：PowerGuard的战力突变阈值，修仙题材50%，都市题材30%，从genreSchema.powerChangeThreshold读取

### 5. 知识库表开发规范

- 新增知识库表DDL必须写在`server/db/knowledgeSchema.js`中，不写在pgSchema.js
- store-pg.js的knowledge表handler条件必须同步更新
- database-pg.js的DEDICATED_TABLES必须同步添加新表名
- 知识库表统一使用JSONB（而非TEXT+safeParse），因为知识库数据结构更灵活
- 每张知识库表必须有projectId索引

### 6. 已有守卫服务清单

| 服务 | 文件 | 集成状态 |
|------|------|---------|
| TimelineService | timelineService.js | writer+review+materialUpdateProcessor |
| PowerGuard | powerGuard.js | review |
| ForeshadowGuard | foreshadowGuard.js | writer+review |
| CharacterArcGuard | characterArcGuard.js | writer+review |
| ConsistencyAuditService | consistencyAuditService.js | review（每10章自动触发） |
| MaterialLifecycleService | materialLifecycleService.js | API+前端 |
