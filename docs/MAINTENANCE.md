# 变更-文档同步矩阵（强制维护）

> **每次代码/数据/功能变更后必读本文件**，对照矩阵确认需更新哪些文档。
> 漏更新=文档腐烂=AI接手时误判=bug复现。本机制是防止文档过时的唯一防线。

---

## 一、同步矩阵（变更类型 → 必更新文档）

| # | 变更类型 | 必更新文档 | 验证点 |
|---|---------|-----------|--------|
| 1 | 新增PG表/字段/索引 | `sop/05-数据库变更.md` + `reference/文件地图.md` + `sop/00-陷阱清单.md`(如有新陷阱) | DEDICATED_TABLES+handler+schema+读写一致 |
| 2 | 新增Agent/修改Agent | `sop/07-Pipeline变更.md` + `reference/题材插件规范.md` + `sop/00-陷阱清单.md` | 契约+数据流+错误码 |
| 3 | 新增/修改题材Plugin | `sop/06-题材插件.md` + `reference/题材插件规范.md` + `reference/题材配置系统.md` | validateGenre通过 |
| 4 | 新增前端Tab/组件 | `sop/03-新功能开发.md` + `reference/文件地图.md` | TABS+TAB_GROUPS+API方法 |
| 5 | 新增配置项/常量 | `sop/03-新功能开发.md` + `reference/项目身份与硬约束.md` | systemConfig.js+configManifest.js |
| 6 | 修复bug(任何) | `sop/04-bug修复.md`(修复记录) + `sop/00-陷阱清单.md`(如有新陷阱) | 根因分析+全量grep |
| 7 | 重构代码(拆分/迁移) | `sop/02-重构任务.md`(改造记录) + `reference/文件地图.md` | 行数≤200+导出完整 |
| 8 | 新增API端点 | `sop/03-新功能开发.md` + `sop/07-Pipeline变更.md`(如涉及Pipeline) | 路由注册+契约校验 |
| 9 | 修改硬约束/架构规范 | `reference/项目身份与硬约束.md` + 受影响sop | grep验证一致性 |
| 10 | 新增素材类型 | `sop/06-题材插件.md` + `reference/题材插件规范.md` + `sop/00-陷阱清单.md`(陷阱#27类) | DEFINITION_TYPES+BINDABLE_TYPES |
| 11 | 删除/废弃功能 | `reference/文件地图.md`(技术债务) + 相关sop标注[已废弃] | grep无残留引用 |
| 12 | 发现新陷阱 | `sop/00-陷阱清单.md`(对应类别追加) + 相关sop的"常见陷阱"章节 | 编号+1+根因+对策 |

---

## 二、更新位置精准指南

### 2.1 陷阱清单更新（sop/00-陷阱清单.md）
- 新陷阱：追加到对应类别末尾，编号=最大值+1
- 新类别：在最后一类后新建"十三、XXX类"，含4-5项
- 格式：`| # | 陷阱简述 | 根因+对策（含具体文件名/函数名/SQL） |`

### 2.2 改造记录更新（sop/02-重构任务.md 第八章）
- 每次重构追加一条到末尾
- 格式：`### [日期] 文件名 改造记录` + 改造前/后+PRE/IN/POST-CHECK+教训

### 2.3 修复记录更新（sop/04-bug修复.md 第七章）
- 每次bug修复追加一条到末尾
- 格式：`## [日期] Bug描述` + 症状/根因/影响/修复/验证/陷阱追加

### 2.4 文件地图更新（reference/文件地图.md）
- 新增文件：追加到对应层
- 文件拆分：原行标注"已拆分到X/Y/Z"
- 技术债务：P0/P1状态变更同步

### 2.5 数据库Schema更新（reference/文件地图.md 第八章）
- 新表：追加到8.2节"新增专用表"
- 字段变更：同步8.1节对应行

---

## 三、自动化扫描脚本

运行 `node scripts/audit-doc-sync.js` 扫描git diff，输出需更新的文档清单：

```bash
# 扫描未提交的变更
node scripts/audit-doc-sync.js

# 扫描最近N次提交
node scripts/audit-doc-sync.js --last 3
```

脚本根据文件变更模式匹配同步矩阵，输出形如：
```
[需更新] docs/sop/05-数据库变更.md
  原因: 检测到 pgSchemaEntity.js 变更
  验证: 新表是否注册DEDICATED_TABLES+handler

[需更新] docs/sop/00-陷阱清单.md
  原因: 检测到 store-pg-writer-*.js 变更
  验证: 是否有新陷阱需追加
```

### 3.2 配置-测试同步检查（audit-config-test-sync.js）

检测配置变更是否同步到测试文件，防止"改配置忘改测试"导致的测试假绿：

```bash
# 扫描未提交的变更
node scripts/audit-config-test-sync.js

# 扫描最近N次提交
node scripts/audit-config-test-sync.js --last 3
```

覆盖6类规则：genreDefaults / systemConfig / dataStoreRegistry / worldConstants / 术语变更 / fieldRegistry。

### 3.3 级联删除注册检查（audit-cascade-delete.js）

扫描PG schema中所有含projectId列的表，对比dataStoreRegistry的cascadable标记，防止新增表忘记注册级联删除导致孤儿数据（陷阱#32）：

```bash
# 普通模式（输出报告）
node scripts/audit-cascade-delete.js

# CI模式（有问题时退出码1，用于阻断流水线）
node scripts/audit-cascade-delete.js --ci
```

### 3.4 硬编码与文件行数审计（audit-hardcode.js）

扫描源码中的魔法数字、硬编码URL、超时时间，同时检测超200行文件：

```bash
node scripts/audit-hardcode.js
```

输出形如：
```
Files scanned: 741
Files over 200 lines: 0
Total issues: 0
```

### 3.5 全量审计一键执行

任务完成前建议并行运行4个audit脚本，确认全部0问题：

```bash
# 文档同步
node scripts/audit-doc-sync.js
# 配置-测试同步
node scripts/audit-config-test-sync.js
# 级联删除注册
node scripts/audit-cascade-delete.js --ci
# 硬编码+行数
node scripts/audit-hardcode.js
```

---

## 四、强制检查点

### 4.1 任务完成前（必做）
```bash
# 4个audit脚本并行运行，确认全部0问题
node scripts/audit-doc-sync.js           # 文档同步
node scripts/audit-config-test-sync.js   # 配置-测试同步
node scripts/audit-cascade-delete.js --ci # 级联删除注册（CI模式）
node scripts/audit-hardcode.js           # 硬编码+行数
```
所有"需更新/需检查/CRITICAL/issues"项必须处理（更新文档/同步测试/注册级联删除/清理硬编码，或确认无需更新）。

或一键运行：`npm run audit:quality`（仅hardcode+cascade，快速） / `npm run audit:all`（全部7个audit脚本）。

### 4.2 Git提交时（自动）
**pre-commit hook**（.husky/pre-commit，阻断式）：
- verifyProjectStandards.js — 项目标准校验
- lint-staged — ESLint暂存区校验
- audit-hardcode.js — 硬编码+行数审计（0 issues才通过）
- audit-cascade-delete.js --ci — 级联删除注册检查（0 CRITICAL才通过）

**pre-push hook**（.husky/pre-push，提醒式）：
- audit-doc-sync.js — 文档同步检查（仅输出警告，不阻断）
- audit-config-test-sync.js — 配置-测试同步检查（仅输出警告，不阻断）

> pre-push为提醒式设计，避免历史积累的git diff误报阻断正常推送。开发者应根据提醒人工确认是否需更新文档/测试。

### 4.3 PR/提交前（建议手动）
```bash
node scripts/audit-doc-sync.js --last 1
node scripts/audit-config-test-sync.js --last 1
```
确保最近一次变更的文档和测试已同步。

### 4.4 接手session时（建议）
```bash
node scripts/audit-doc-sync.js --last 5
node scripts/audit-config-test-sync.js --last 5
```
了解最近5次变更可能影响的文档和测试，判断文档可信度。

---

## 五、维护责任矩阵

| 角色 | 职责 |
|------|------|
| 代码变更执行者 | 变更后立即运行audit-doc-sync.js，更新所有"需更新"文档 |
| 接手AI | session开始时运行audit-doc-sync.js --last 5，判断文档可信度 |
| 总工程师 | 定期审查文档与代码一致性，发现腐烂立即修复 |

---

## 六、反模式（禁止）

- ❌ 改代码不更新文档，等"以后再说"
- ❌ 更新文档到错误位置（如把陷阱写到sop/04而不是sop/00）
- ❌ 陷阱清单只追加不编号，导致编号混乱
- ❌ 改造记录只写"已重构"不写具体行数/教训
- ❌ 文件地图不标注拆分后去向，导致找不到代码
- ❌ audit脚本输出"需更新"但直接忽略

---

## 七、覆盖率基线（P3任务建立）

### 7.1 基线策略

- **全局基线**：略低于当前实际值，防止覆盖率退化（不阻断已有功能）
- **关键模块基线**：对已高覆盖模块设较高阈值，防止核心逻辑退化
- **0%模块暂不强制**：避免历史积累的未测试模块阻断CI，按优先级逐步补测

### 7.2 当前基线（jest.config.js coverageThreshold）

**全局基线**（采集日期：2026-06-28，阶段十二 S5 升级后）：

| 指标 | 当前实际 | 基线阈值 | 余量 |
|------|---------|---------|------|
| Statements | 94.29% | 91% | 3.29% |
| Branches | 83.85% | 78% | 5.85% |
| Functions | 94.4% | 83% | 11.4% |
| Lines | 96.38% | 93% | 3.38% |

> 注：阶段十二 S5 将全局基线从 15/11/12/15 升级至 91/78/83/93（留3%缓冲防退化）。
> jest global threshold 计算含未测试文件，校验值低于 All files 行的实际值。
> Functions 余量较大（11.4%），因 jest global threshold 含未测试文件的 0% 函数覆盖。

**关键模块基线**（19个高覆盖模块）：

| 模块 | Stmts% | Branch% | Func% | 当前实际 |
|------|--------|---------|-------|---------|
| server/config/ | 85 | 75 | 90 | 88.9%-100% |
| server/shared/ | 90 | 80 | 95 | 98.5% |
| server/db/dbHelpers.js | 90 | 85 | 95 | 96.9% |
| server/db/storeCommon.js | 85 | 85 | 95 | 88.6% |
| server/services/llmRequestBuilder.js | 95 | 95 | 100 | 100% |
| server/services/llmResponseParser.js | 95 | 85 | 100 | 100% |
| server/services/llmRetryUtils.js | 95 | 90 | 100 | 100% |
| server/services/materialIntegrityCheck.js | 95 | 95 | 100 | 100% |
| server/services/materialIntegrityHelpers.js | 95 | 95 | 100 | 100% |
| server/services/materialValidator.js | 90 | 80 | 100 | 94.4% |
| server/services/genreConfig.js | 75 | 55 | 85 | 80.5% |
| server/services/genreDetectorHelpers.js | 85 | 85 | 100 | 90.6% |
| server/services/chapterStatus.js | 80 | 80 | 80 | 83.9% |
| server/services/contentCleaners.js | 85 | 70 | 100 | 89.8% |
| server/services/rateLimiter.js | 75 | 60 | 80 | 82.35% |
| server/services/tokenBucketLimiter.js | 80 | 65 | 75 | 85.7% |
| **server/core/pipeline/** **(阶段十二 S5 新增独立阈值)** | 95 | 83 | 92 | 98.9%/86.7%/95.8%/99.4% |
| **server/middleware/** **(阶段十二 S5 新增独立阈值)** | 92 | 90 | 92 | 96.8%/93.7%/95.8%/97.3% |

### 7.3 补测优先级评估

**P0（高优先级，核心业务逻辑）**：
- `server/services/pipeline/`（149文件，24.5%）— Pipeline核心流程
- `server/services/genres/`（158文件，27.5%）— 题材插件逻辑
- `server/services/prompts/`（23文件，37.1%）— 提示词构建

**P1（中优先级，数据一致性相关）**：
- `server/services/consistencyEngine/`（8文件，0%）— 一致性引擎
- `server/services/chapterAuditor/`（7文件，0%）— 章节审计
- `server/services/memory/`（10文件，0%）— 记忆系统
- `server/services/entityCenter/`（7文件，12.1%）— 实体中心

**P2（低优先级，外部集成/辅助功能）**：
- `server/services/publishers/`（20文件，0%）— 发布平台
- `server/services/templateImporter/`（5文件，0%）— 模板导入
- `server/services/comic/`（4文件，0%）— 漫画生成
- `server/services/comfyui/`（7文件，0%）— ComfyUI集成
- `server/services/multiPublisher/`（3文件，0%）— 多平台发布

### 7.4 维护命令

```bash
# 生成覆盖率报告
npm run coverage

# 查看覆盖率摘要（按目录排序）
npm run coverage:summary

# 覆盖率阈值检查（CI用，不达标退出码1）
npm run coverage:check
```

### 7.5 基线升级规则

1. **补测后升级**：某模块补测后覆盖率提升，应同步提高该模块的coverageThreshold
2. **全局基线升级**：当全局覆盖率提升超过2%时，考虑升级全局基线
3. **降级禁止**：基线只能升不能降，降级需总工程师审批并在本文件记录原因
4. **新模块基线**：新增核心模块应在补测后立即建立基线，避免长期0%

### 7.6 陷阱#36（预防）

**陷阱#36：覆盖率基线设置过高导致CI阻断**
- 根因：基线设为当前实际值，任何微小波动都会导致CI失败
- 对策：基线应略低于实际值（保留1-2%余量），关键模块余量可更小
- 验证：每次升级基线后运行`npm run coverage:check`确认通过
