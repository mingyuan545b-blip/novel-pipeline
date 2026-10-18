---
description: Review the current diff against project standards and SOPs
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git status:*), Bash(npx eslint:*)
---

Review the current diff as a strict code reviewer. Check:

1. `PROJECT_STANDARDS.md` rules, especially R1 (no direct `store.getItem/queryItems/listItems` in agents) and R2 (no direct `res.status().json()`).
2. Files over the 200-line limit; suggest a split only when it improves cohesion.
3. Fail-open behavior: catch blocks that only log in `server/services/pipeline/**`.
4. Tests: missing assertions, conditional `expect`, or tests that only assert truthiness of a mock.
5. Docs: whether `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `CLAUDE.md`/`AGENTS.md` need syncing.
6. Runtime reachability: is the changed code actually called from a registered route/step?

Output findings ordered by severity. Do not modify files in this command.
