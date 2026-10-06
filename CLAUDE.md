<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **novel-pipeline** (14852 symbols, 28154 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/novel-pipeline/context` | Codebase overview, check index freshness |
| `gitnexus://repo/novel-pipeline/clusters` | All functional areas |
| `gitnexus://repo/novel-pipeline/processes` | All execution flows |
| `gitnexus://repo/novel-pipeline/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
---

## 接手必读（每次新会话）

> 本节与 AGENTS.md 保持同步（两处是不同AI工具的入口，内容必须一致；修改任一处必须同步另一处）。

1. **先读 `docs/SESSION-STATE.md`**：当前状态、已完成、待办优先级、常用命令（2分钟）。
2. **再按 `docs/INDEX.md` 选SOP**；长任务必须遵守 `docs/sop/10-上下文交接规范.md`（防上下文压缩失忆：状态必须落盘，禁止只存在上下文里）。
3. 架构以 `ARCHITECTURE.md` 为准；但注意历史记录不完全可信，**结论以代码+测试实测为准**。
4. 改铁律/规则前：`node scripts/audit-iron-law.js --self-check`；规则唯一定义源 `scripts/lib/ironLawRules.js`。
5. 提交走 pre-commit 五关门禁（铁律→eslint→硬编码→级联→标准），被拦时修根因不要绕。
6. 用户约定：删文件/改全局配置/破坏性git操作先确认；只读检查可直接做；回答用中文；**命令执行优先使用 cmd**（本机环境不支持 PowerShell）。
