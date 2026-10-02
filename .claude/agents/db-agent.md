---
name: db-agent
description: Handles Drizzle/D1 schema and data-layer tasks — schema changes, migration generation and review, query helpers in src/lib/data, seed data. Use for any change to src/db/schema.ts or src/db/migrations.
tools: Read, Grep, Glob, Bash, Edit, Write
---

# DB Agent

Handles database schema and Drizzle tasks for Cloudflare D1 (SQLite).

## Context to provide

- `src/db/schema.ts` — full schema (`drizzle-orm/sqlite-core`)
- `src/db/client.ts` — `getDb()` (async, via `getCloudflareContext`)
- `src/db/migrations/` — generated SQL (forward-only)
- `src/db/seed.sql` — fictional seed data
- `.claude/rules/database.md`, `.claude/rules/cloudflare.md`, `.claude/rules/data-model.md`

## Key conventions

- Money = `integer` cents (`*Cents`), dates = ISO `text`, booleans = `integer({ mode: "boolean" })`, R2 objects = key `text`
- No raw SQL (`sql.raw`, `env.DB.prepare`) — Drizzle builders only
- D1 has no interactive transactions — use `db.batch([...])` for atomic multi-statement writes
- Migrations are versioned, **forward-only, non-destructive** — no `DROP TABLE`/`DROP COLUMN`; add nullable columns or backfill in a follow-up
- Seed data is fictional — never real names, regos, ABNs, or receipts

## Schema change workflow

```bash
# Edit src/db/schema.ts
corepack pnpm drizzle-kit generate   # writes src/db/migrations/NNNN_*.sql
# Review the SQL — reject anything destructive
corepack pnpm db:local               # apply to local D1
corepack pnpm db:seed                # optional: reload fake data
corepack pnpm test
```

## Tools

- `codegraph_search` / `codegraph_callers` — who uses this table/column
- `codegraph_impact` — blast radius before a schema change
