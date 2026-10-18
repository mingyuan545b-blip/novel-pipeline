---
name: db-change
description: "Use when adding or changing PostgreSQL tables, columns, indexes, or migrations."
---

# Database Change

## Read first

1. `docs/sop/05-数据库变更.md`
2. `DATABASE_SCHEMA.md`
3. `server/db/migrations/` latest migration

## Workflow

1. Write a numbered migration; keep it idempotent where the project convention requires it.
2. Update `DATABASE_SCHEMA.md` in the same change.
3. Update the cascade-delete registry if a new FK/ownership relation is added.
4. Add a test for the new field/constraint, including invalid input.
5. Run:
   - `node scripts/verifyConstraintChain.js`
   - `node scripts/verifyMaterialMigration.js`
   - `node scripts/audit-cascade-delete.js --ci`
6. Run `npm run backup:dry` before applying anything destructive.

## Never

- Add a column without documenting it.
- Use string concatenation for SQL values.
- Delete data without a backup and an explicit user confirmation.
