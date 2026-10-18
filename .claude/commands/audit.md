---
description: Run the audit scripts relevant to the current change
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(node scripts/*), Bash(npx eslint:*)
---

Inspect the current diff, then run only the audits that match the changed area:

- Pipeline / contracts: `node scripts/verifyDataFlow.js`, `node scripts/verifyApiContract.js`
- Vocabulary / status: `node scripts/audit-vocabulary-consistency.js`
- Material shape: `node scripts/audit-material-shape.js`
- Hardcode: `node scripts/audit-hardcode.js`
- Cascade delete: `node scripts/audit-cascade-delete.js --ci`
- Docs: `node scripts/audit-doc-sync.js`
- Config/test sync: `node scripts/audit-config-test-sync.js`

Report each audit's result and the exact failing file/line. Do not silence a
failing audit; either fix it or write down why it is a false positive.
