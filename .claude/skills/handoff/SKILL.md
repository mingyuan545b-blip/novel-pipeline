---
name: handoff
description: "Use before context compaction or at the end of a long task to persist recoverable state."
---

# Context Handoff

## Read first

`docs/sop/10-上下文交接规范.md`

## Workflow

1. Write `docs/worklog/YYYY-MM-DD-<topic>.md` with:
   - current goal and status
   - root cause and evidence
   - files changed
   - verification commands and results
   - recovery anchors (exact commands, file paths, line references)
2. Update `docs/SESSION-STATE.md`:
   - current state (one entry)
   - one-line conclusion
   - detail path
3. Update `docs/INDEX.md` only if routing changed.
4. Run `node scripts/audit-doc-sync.js`.

## Never

- Leave state only in the conversation context.
- Write a conclusion without a reproducible command or file reference.
- Read `docs/archive/` during cold start.
