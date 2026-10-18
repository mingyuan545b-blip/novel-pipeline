---
name: craft-quality
description: "Use when designing characters, highlights, quotes, worldbuilding, or reviewing AI-flavored prose."
---

# Craft Quality

## Read first

1. `docs/sop/12-创作工艺与反AI化规范.md`
2. `docs/design/角色编年史升级-多维分层与素材质检.md` section 十
3. `server/services/craftQualitySpec.js`

## Hard rules

- A highlight must pass the four questions: screenshot-worthy, only this character
  would do it, it has a cost, and it is irreversible.
- A quote must survive de-contextualisation, let the reader infer the speaker, and
  carry weight.
- Reject label-style `why`, plot-summary `what`, empty `scene`, and quotes that mix
  in the situation.
- Do not use review-speak such as "展现了…" or "体现了…".

## Workflow

1. Change the spec first (`craftQualitySpec.js`), then the validator.
2. Wire the validator into the single write path (`entityCRUD` / `craftWriteGate`).
3. Add positive and negative examples to the unit tests.
4. Run `node scripts/audit-craft-quality.js` and report violations.

## Never

- Relax a validator just to make generated data pass.
- Add a quality check that is only referenced in a UI audit route and never in the
  pipeline write path.
