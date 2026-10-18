---
name: pipeline-step
description: "Use when adding or modifying a pipeline step, its contract, or dataFlowSpec entry."
---

# Pipeline Step Change

## Read first

1. `docs/sop/07-Pipeline变更.md`
2. `ARCHITECTURE.md` section on the pipeline flow
3. `server/services/pipeline/dataFlowSpec.js`
4. `server/services/pipeline/contracts/_registry.js`

## Workflow

1. Run `gitnexus impact <stepName> --direction upstream` and report the blast radius.
2. Add or update the step under `server/services/pipeline/steps/`.
3. Update `dataFlowSpec.js` and the contract registry in the same change.
4. Add a unit test that asserts both success and failure paths; a step that only
   logs on failure is a fail-open bug.
5. Run `node scripts/verifyDataFlow.js` and `node scripts/verifyApiContract.js`.
6. Run the relevant unit tests, then `/gate`.

## Never

- Change a step name or contract key without updating every registry entry.
- Catch an error and only `logger.warn(...)`; return a failure or rethrow.
- Leave a step unreachable from the pipeline orchestrator.
