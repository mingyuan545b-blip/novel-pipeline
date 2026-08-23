# 重构执行协议 v1.0

## 核心原则：不信任操作者，只信任检查点

操作者（AI）有已知缺陷：幻觉、失忆、逻辑漏洞、重复犯错。
因此所有质量保证必须依赖**外部约束**，而非内部自觉。

---

## 第一层：执行前强制检查（PRE-CHECK）

每个文件改造前，必须输出以下内容并记录：

```
[PRE-CHECK] 文件: xxx.js (当前xxx行)
1. 改造目标: 拆分为N个文件，每个≤200行
2. 依赖关系: 谁引用了这个文件？(必须用grep验证，不能凭记忆)
3. 导出接口: 当前导出哪些函数/常量？(必须用grep验证)
4. 风险评估: 改这个文件可能影响哪些功能？
5. 回滚方案: 如果出问题怎么恢复？
```

**禁止跳过PRE-CHECK直接改代码。**

---

## 第二层：改造中强制约束（IN-PROCESS）

### 2.1 硬编码扫描
每写完一个文件，必须运行：
```bash
node -e "扫描该文件中的魔法数字、硬编码URL、硬编码超时"
```

### 2.2 行数检查
每写完一个文件，必须运行：
```bash
wc -l <file>  # 必须 ≤ 200
```

### 2.3 导出完整性检查
拆分后必须验证：原文件的所有导出在新文件中都能找到
```bash
# 对比拆分前后的module.exports
```

### 2.4 引用完整性检查
拆分后必须验证：所有require该文件的地方不受影响
```bash
grep -r "require.*原文件名" server/
```

---

## 第三层：改造后强制验证（POST-CHECK）

### 3.1 单元测试
```bash
npx jest --testPathPattern="相关测试" --no-coverage --forceExit
```

### 3.2 全量测试
```bash
npx jest --testPathPattern="tests/unit" --no-coverage --forceExit
```

### 3.3 启动验证
```bash
node server/index.js  # 必须能启动，无报错
```

### 3.4 API验证
```bash
curl http://localhost:3001/api/health  # 必须返回200
```

---

## 第四层：持久化记录（AUDIT TRAIL）

每次改造必须记录到本文件末尾，格式：

```
## [日期] 文件名 改造记录
- 改造前: xxx行
- 改造后: N个文件，行数分别为xxx/xxx/xxx
- PRE-CHECK: ✅/❌
- IN-PROCESS: ✅/❌
- POST-CHECK: ✅/❌
- 遗留问题: 无/xxx
- 教训: xxx
```

---

## 第五层：反回归机制（ANTI-REGRESSION）

### 5.1 ESLint规则（已生效）
- max-lines: 200
- max-lines-per-function: 80

### 5.2 硬编码检测脚本（待建立）
扫描所有.js文件，检测：
- 魔法数字（除0/1/-1外的裸数字）
- 硬编码URL（http/https开头）
- 硬编码超时（setTimeout中>1000的数字）
- 硬编码项目ID（UUID格式）

### 5.3 CI检查清单
每次改动后必须确认：
- [ ] 没有新增超200行文件
- [ ] 没有新增硬编码
- [ ] 所有测试通过
- [ ] 服务器能正常启动

---

## 执行优先级

### P0: 8个800+行文件（阻塞级）
| 文件 | 行数 | 拆分策略 |
|------|------|---------|
| routes/pipeline.js | 1103 | 按功能拆为3-4个子路由 |
| infinitePipeline.js | 1035 | 已部分拆分，继续拆主循环 |
| qimaoPublisher.js | 1191 | 按发布阶段拆分 |
| materialUpdateProcessor.js | 899 | 按action类型拆分 |
| routes/knowledge.js | 892 | 按CRUD/查询/同步拆分 |
| contentUtils.js | 935 | 按功能域拆分 |
| memory.js | 887 | 按记忆层级拆分 |
| comfyuiWorkflow.js | 946 | 按工作流阶段拆分 |

### P1: 18个500-800行文件
逐个评估，优先拆核心业务文件。

### P2: Legacy文件清理
6个Legacy文件(6726行)需要先迁移功能再删除。

---

## 已知陷阱清单（持续更新）

1. ❌ 拆分时忘记更新require路径 → 必须grep验证
2. ❌ 拆分后导出接口变化但调用方没更新 → 必须对比module.exports
3. ❌ 循环依赖 → 拆分后必须检查双向require
4. ❌ 拆分时引入新硬编码 → 每个新文件必须扫描
5. ❌ 测试通过但运行时出错 → 必须启动验证
6. ❌ 改A文件时B文件也受影响 → 必须grep依赖关系
7. ❌ 自己加的新代码又制造硬编码 → 写完立刻扫描
8. ❌ 思考模型默认开启思考模式 → 新模型必须检查默认参数
9. ❌ 认证空值时随机生成 → 安全默认值不能引入副作用
10. ❌ 同类bug只修部分文件 → 必须全量grep同类模式

---

## 改造记录

### [2026-06-08] Pipeline契约系统建设
- 新建: pipelineOutputContract.js(316行) — 输出契约定义
- 新建: pipelinePollutionGuard.js(322行) — 污染检测器
- 新建: dataFlowSpec.js(260行) — 数据流规范
- 新建: pipelineErrors.js — 错误码从22个扩展到40+个
- 更新: pipelineContract.js 480行→215行（DATA_FLOW_SPEC拆出到dataFlowSpec.js）
- 更新: pipelinePreflight.js v1→v2（新增postflight/pollutionCheck/fullDiagnose）
- 更新: _pipelineLegacy.js — 集成输出契约和污染检测
- 更新: coreRoutes.js — 新增4个诊断API（dataflow/spec, dataflow/graph, output-contracts, full-diagnose）
- 更新: systemConfig.js — 新增PIPELINE_CONTRACT常量（9个阈值）
- PRE-CHECK: ✅
- IN-PROCESS: ✅（硬编码9处全部修复，空壳检查1处删除，超200行文件1处拆分）
- POST-CHECK: ✅（708测试全通过）
- 遗留问题: pipelineOutputContract.js 316行超200行限制（12个agent的输出契约定义，结构紧凑，拆分收益低）
- 教训: 1.写契约时先引用PIPELINE_CONTRACT常量，不要先硬编码再修；2.check直接return true的空壳检查不要写；3.偏移就是Bug不是"自由创作"
