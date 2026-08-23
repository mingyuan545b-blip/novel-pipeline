# Novel-Pipeline 系统改造总控清单

> 本文件是所有改造项目的索引和进度追踪器。
> 新AI窗口读取此文件即可了解全局进度，再读取对应子清单即可接手具体任务。

---

## 改造项目索引

| 编号 | 项目 | 文件 | 行数 | 优先级 | 状态 | 清单文件 |
|------|------|------|:----:|:------:|:----:|----------|
| G-01 | 多平台发布器拆分 | `_multiPlatformPublisherLegacy.js` | 2334 | P0 | ✅已完成 | [G-01-multiPlatformPublisher.md](G-01-multiPlatformPublisher.md) |
| G-02 | 大纲生成器拆分 | `outlineGenerator.js` | 1354 | P0 | ✅已完成 | [G-02-outlineGenerator.md](G-02-outlineGenerator.md) |
| G-04 | Pipeline路由拆分 | `pipeline.js`(路由) | 1085 | P0 | ✅已完成 | [G-04-pipelineRoute.md](G-04-pipelineRoute.md) |
| G-05 | 素材库页面拆分 | `MaterialsPage.jsx` | 1498 | P0 | ✅已完成 | [G-05-materialsPage.md](G-05-materialsPage.md) |
| G-06 | 仪表盘页面拆分 | `Dashboard.jsx` | 1169 | P1 | ✅已完成 | [G-06-dashboard.md](G-06-dashboard.md) |
| G-07 | 知识库页面拆分 | KnowledgePage.jsx | 1087 | P1 | ✅已完成 | [G-07-knowledgePage.md](G-07-knowledgePage.md) |
| G-08 | 发布页面拆分 | PublishPage.jsx | 1034 | P1 | ✅已完成 | [G-08-publishPage.md](G-08-publishPage.md) |
| G-09 | Legacy文件清理 | 3~6个Legacy文件 | ~4700 | P1 | ✅已完成 | [G-09-legacyCleanup.md](G-09-legacyCleanup.md) |
| G-10 | 无限Pipeline重构 | `infinitePipeline.js` | 872 | P1 | ✅已完成 | [G-10-infinitePipeline.md](G-10-infinitePipeline.md) |
| G-13 | Agent提示词拆分 | `_agentPromptsLegacy.js` | 813 | P1 | ✅已完成 | [G-13-agentPrompts.md](G-13-agentPrompts.md) |
| G-18 | 前端状态管理优化 | `useAppStore.js` | - | P2 | ✅已完成 | [G-18-stateManagement.md](G-18-stateManagement.md) |
| G-22 | 测试覆盖补充 | `tests/` | - | P2 | ✅已完成 | [G-22-testCoverage.md](G-22-testCoverage.md) |

---

## 已完成的改造

| 编号 | 项目 | 改造前 | 改造后 | 完成日期 |
|------|------|:------:|:------:|----------|
| G-17 | PipelinePage拆分 | 2009行 | 830行 | 2026-05-22 |
| R-01~R-11 | 后端基础设施(锁/日志/安全/熔断) | - | - | 2026-05-21 |

---

## 推荐执行顺序

### 第一批: 零风险清理 + 高ROI拆分
1. **G-09** Legacy文件清理 — 先删除死代码，减少系统复杂度
2. **G-04** Pipeline路由拆分 — 990行路由是日常开发痛点
3. **G-05** MaterialsPage拆分 — 前端最大页面

### 第二批: 核心后端重构
4. **G-01** 多平台发布器拆分 — 系统最大单文件
5. **G-02** 大纲生成器拆分 — 含608行超大函数
6. **G-13** Agent提示词拆分 — 系统最关键文件之一

### 第三批: 前端页面拆分
7. **G-06** Dashboard拆分
8. **G-07** KnowledgePage拆分
9. **G-08** PublishPage拆分
10. **G-10** infinitePipeline重构

### 第四批: 架构升级
11. **G-18** React Query引入
12. **G-22** 测试覆盖补充

---

## 执行规范

### 每个改造项目必须遵守
1. **改前**: 读取对应清单文件，了解完整步骤
2. **改中**: 逐步执行，每完成一步更新清单中的 `[ ]` 为 `[x]`
3. **改后**: 运行 `npm run check` + `npm test` + `npx vite build`，三项都通过才能标记完成
4. **更新**: 完成后更新本文件的"状态"列

### 跨窗口接手指南
1. 读取本文件了解全局进度
2. 找到"⬜待开始"或"🔄进行中"的项目
3. 读取对应的清单文件
4. 从未勾选的步骤继续执行

### 状态标记
- ⬜待开始 — 尚未开始
- 🔄进行中 — 正在执行
- ✅已完成 — 全部步骤完成且验证通过
- ⏸️暂停 — 因依赖/阻塞暂停
- ❌取消 — 经评估不再需要

---

## 文件路径速查

### 后端大文件
```
server/services/_multiPlatformPublisherLegacy.js   2334行
server/services/pipeline/outlineGenerator.js       1354行
server/services/_chapterAuditorLegacy.js            1105行
server/routes/pipeline.js                           1085行
server/services/_pipelineLegacy.js                   932行
server/services/pipeline/infinitePipeline.js         872行
server/services/_agentPromptsLegacy.js                813行
server/services/pipeline/fullPipeline.js              ~700行
```

### 前端大文件
```
client/src/pages/MaterialsPage.jsx     1498行
client/src/pages/Dashboard.jsx         1169行
client/src/pages/KnowledgePage.jsx     1087行
client/src/pages/PublishPage.jsx       1034行
client/src/pages/WorkshopPage.jsx       744行
client/src/pages/ComicStoryboardPage.jsx 656行
client/src/pages/CreateProjectModal.jsx  649行
client/src/pages/PipelinePage.jsx        830行(已优化)
```

### 清单文件目录
```
.trae/renovation/
├── README.md                      ← 本文件(总控清单)
├── G-01-multiPlatformPublisher.md
├── G-02-outlineGenerator.md
├── G-04-pipelineRoute.md
├── G-05-materialsPage.md
├── G-06-dashboard.md
├── G-07-knowledgePage.md
├── G-08-publishPage.md
├── G-09-legacyCleanup.md
├── G-10-infinitePipeline.md
├── G-13-agentPrompts.md
├── G-18-stateManagement.md
└── G-22-testCoverage.md
```
