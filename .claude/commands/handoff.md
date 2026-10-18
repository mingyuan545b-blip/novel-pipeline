---
description: Persist session state before context compaction
allowed-tools: Read, Write, Edit, Bash(git status:*), Bash(git diff:*), Bash(node scripts/audit-doc-sync.js)
---

Follow `docs/sop/10-上下文交接规范.md` exactly. Before the context is compacted:

1. Write a worklog under `docs/worklog/YYYY-MM-DD-<topic>.md` containing:
   - root cause and evidence
   - files changed and why
   - verification commands and results
   - recovery anchors for the next window
2. Update `docs/SESSION-STATE.md`: current state, one-line conclusion, detail path.
3. Update `docs/INDEX.md` only if task routing or document structure changed.
4. Run `node scripts/audit-doc-sync.js` and report the result.
5. Do not read `docs/archive/` during cold start; link to it instead.
