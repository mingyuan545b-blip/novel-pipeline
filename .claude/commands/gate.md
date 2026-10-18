---
description: Run the project's five pre-commit gates plus unit tests
allowed-tools: Bash(npm run *), Bash(node scripts/*), Bash(npx lint-staged)
---

Run the project quality gates in order and stop at the first failure:

1. `node scripts/audit-iron-law.js --pre-commit`
2. `npx lint-staged`
3. `node scripts/audit-hardcode.js`
4. `node scripts/audit-cascade-delete.js --ci`
5. `node scripts/verifyProjectStandards.js`
6. `npm run test:unit`

Report each gate's result. Do not bypass a failing gate; fix the root cause.
If a gate is known to be flaky, report the evidence instead of skipping it.
