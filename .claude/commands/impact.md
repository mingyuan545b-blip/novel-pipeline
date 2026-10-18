---
description: Run GitNexus impact analysis before editing a symbol
allowed-tools: Bash(gitnexus:*), Bash(git status:*), Bash(git diff:*)
---

Run impact analysis for `$ARGUMENTS`:

1. `gitnexus impact "$ARGUMENTS" --direction upstream`
2. `gitnexus detect-changes`

Report:
- direct callers (d=1, WILL BREAK)
- affected execution flows
- risk level (LOW / MEDIUM / HIGH / CRITICAL)

If risk is HIGH or CRITICAL, warn the user before editing. If the index is stale,
run `gitnexus analyze` first.
