# 《勘定》项目 · 开工作业书（Agent 规则与流程 · 容量评估）

> 用途：方向 A 开工前的**前置体检结论**。回答用户三问：①agent 提示词要不要改？②各 agent 规则流程是什么？③能不能承载四五百万字？
> 结论先行：**不改任何 agent 提示词**。本项目走**题材分支注入**（`branchKanDing`），零返工面。
> 关联：`docs/design/无限流压测项目-三方向与选定设定.md`（选定方向 A）

---

## 一、前置结论：agent 提示词**不需要改**

Agent 的提示词 = `agentJobTemplates`(拿哪些槽位) + `agentSlotRegistry`(槽位→配置源) + `constraintInjector`(约束词按题材/分支分发)。
**题材差异全部通过"分支"注入**（`branches/index.js` 的 `applyBranch`）：

```
项目 branchKey='kanding'
  → applyBranch(genre,'kanding') 深拷贝题材并合并分支配置
  → 分支的 extraConstraints / extraFoundationRules / styleProfileOverrides / genreBaseOverrides / moduleOverrides
  → 被 constraintInjector / styleInjector / genreInjector 按 agent 分发
```

**所以**：新增一个分支文件 + 注册，所有 agent（writer/review/intent-planner…）就自动拿到"勘定"的术语、约束、风格。
**不用动 `agentJobTemplates`/`agentSlotRegistry`/任何 prompt 文件** —— 这正是"不返工"的关键。
（唯一的代码改动是"新增文件"，不是"修改既有 agent 规则"。）

---

## 二、Agent 清单与规则（11 个，代码实测）

| Agent | 职责 | 槽位（拿什么） | 素材声明（必需项 / 总预算） | 本项目注意点 |
|---|---|---|---|---|
| **writer** 执笔 | 按大纲+素材写正文 | 全套（红线/技法/约束/风格/风味/记忆金字塔/输出） | character(full,4000)+relationship+worldview 必需；总 9000 | 是"界限知/带出/勘阶"的主要落点 |
| **intent-planner** 意图规划 | 规划章节意图与大纲 | 题材铁律/约束/风格/记忆金字塔 | character(summary)+…(3000) | 决定每章"接哪个界的界务" |
| **reviser** 返修 | 按审核反馈改稿 | 返修红线+风格等 | character(full,3000)+relationship 必需；6000 | 带出/串台违规返修在此 |
| **first-review** 初审 | 质量初审 | 约束+风格+注册表 | character(summary)+knowledge-access；4500 | 校验带出门禁/限知不越权 |
| **second-review** 复审 | 复审 | 同上 | 同上；3500 | 同上 |
| **fast-review** 快审 | 快审（替代路径） | 同上 | character(brief)+…；2500 | 软门禁放行时的兜底审 |
| **polisher** 润色 | 润色优化 | 润色红线+风格+风味 | character(summary)+…;3000 | 反AI味/方言语感在此收口 |
| **final-editor** 定稿 | 最终定稿 | 约束+风格+注册表 | character(summary)+foreshadow(all)；3500 | 看全量伏笔，保一致 |
| **material-manager** 素材管理 | 素材增删改查 | 角色边界+约束+风格 | index 级；— | 归属/生命周期写入 |
| **material-organizer** 素材整理 | 整理章节素材变化+限知认知变化 | 角色边界+约束+风格+注册表 | — | **限知变化(organizingPlan)出处**（陷阱#90） |
| **reader** 读者 | 读者视角评价 | 仅角色边界 | character(brief)；2000 | 老书虫体验关 |

> 注：`outline`（大纲生成）不是 agent，是 pipeline 直调 `outlineGenerator`。

---

## 三、Pipeline 主流程（逐章）

```
outline(远景粗纲/far) → intent-planner(near细纲) → writer → first-review
  → (fast-review 快审) → material-manager(素材归档) → second-review → approved
```

**章节因果门槛**（`materialGate`）：第 N 章开工前，要求第 1..N-1 章状态=`material-updated`；
不满足则**升序补跑 material-manager**，仍缺 → 阻塞+告警（不静默）。→ 本项目跨界连环作业**必须守这条**。

---

## 四、旁路抽取链（写库后跑，喂实体中心）

| 抽取器 | 产出 | 喂给 |
|---|---|---|
| `chronicleExtractor` | 编年史 8 维（日常/心理/立场/立场变化/高光/名言/事迹/关系） | 角色编年史 → 回流 `quoteLibrary`/`highlightScenes` |
| `knowledgeExtractor` | 限知三维度（factId×entityId×confidence×sourceHow） | 限知树 |
| `worldScopeExtractor` | 实体归属(`scopeWorldId`/`locationSlot`)+跨界事件(channel/medium) | 世界域/穿越事件/带出违规面板 |
| `materialOrganizer` | organizingPlan（素材变化+认知变化） | material-manager 落库 |
| `entityCraftReflow` | 四要素合格名言/高光 → 实体 | `entities.quoteLibrary`/`highlightScenes` |

---

## 五、本项目落地：新增分支 `kanding`（唯一代码改动）

| 要做的事 | 落点 | 类型 |
|---|---|---|
| 新增分支 | `server/services/genres/high-martial-crossplane/branches/branchKanDing.js` | **新增文件** |
| 注册分支 | `branches/index.js`（+require +registry） | 追加 4 行 |
| 约束词/铁律/风格/术语 | 全部写在分支文件内（extraConstraints/extraFoundationRules/styleProfileOverrides/detectorConfig/moduleOverrides） | 无 |
| 六类界 + 归属 + 限知种子 | 项目初始化时落库（脚本/初始化步骤） | 数据 |
| 人物工艺 | 跑既有 `scripts/designCharacterCraft.js` | 无 |
| 方言 | 复用 `data/dialects/*.json` + 角色 `defaultDialects` | 数据 |

**不动**：`agentJobTemplates`/`agentSlotRegistry`/`constraintModules`/任何 agent prompt 文件。

---

## 六、章节与测试量估算

**目标体量**：框架按 6 卷 / 2500 章 / ~500 万字设计（每章 2400–2800 字，取自题材 `pipelineConfig`）。

**测试量分层**（全量 2500 章不现实也没必要；按"测到位"设四档）：

| 档 | 章数 | 覆盖 | 成本（参照 100章≈1000万tokens≈¥20/3.3h） | 通过判据 |
|---|---|---|---|---|
| T0 冒烟 | 3 | 主流程跑通、无崩 | 极低 | 三张图有数据 |
| T1 核心 | 20 | 浅界(medium/plot/native)、编年史八维首轮、限知 F1/F2、带出门禁软拦 | 中 | §四映射表前半 |
| T2 中程 | 60 | permission/locked 界、跨域串台检测、卷末节奏、编年史回流积累 | 中高 | §四映射表全表 |
| T3 长程 | 120 | 跨卷、限知 F3、势力线、章节门槛跳章回归 | 高（~¥24） | 长程一致 |

> 建议：**T0→T1 必跑；T2 按 bug 收敛情况决定；T3 仅在长程问题复现时跑**。这样用最小成本把 13 类问题点全覆盖。

---

## 七、承载能力判断（能不能扛四五百万字）

**能，前提是守住三条**：

1. **舞台可无限扩展** ✅：六类"界" + 主位面 + 源界层级；界的题材不设限（都市/民俗/时代/科幻），每卷换一批 → 胃口不腻。
2. **资源循环有稀缺、有代价** ✅：带出六档策略 + 勘四阶代价（走音/失忆/认同）→ 装备/归属/带出 天然通胀可控。
3. **信息主线不断线** ✅：F1–F6 六层限知，跨 6 卷逐层揭示 → 单元剧之上有总账。

**风险点（须在开写前写进约束词）**：主位面锚点戏份不能被副本挤没（每卷主位面势力线必须推进）。

---

## 八、开工步骤（本次执行）

1. ✅ 建分支 `branchKanDing` + 注册（本作业书同批完成）。
2. 配 `narrativePromise` 四件 + 六类界 + 归属/限知种子（下一步）。
3. 人物工艺（`designCharacterCraft.js`）产出 9 人四件套。
4. 跑 T0(3章) → 看三张图 → T1(20章) 逐条过 §四映射表。
