---
paths:
  - "src/db/**"
  - "src/lib/data/**"
  - "drizzle.config.ts"
---

# Database — Drizzle on D1 (SQLite)

Bindings, `getDb()`, `force-dynamic`, migration policy and column conventions → `.claude/rules/cloudflare.md`. This file = query rules only.

- **No raw SQL.** Use Drizzle builders (`db.select/insert/update/delete`). `sql.raw()` and direct `env.DB.prepare/exec` are blocked by semgrep `glb-no-raw-sql`. Drizzle's tagged `` sql`…` `` is parameterised and OK.
- **DB access only in `src/lib/data/**`.** Pages and actions call these helpers — never import `getDb` from a component or action.
- **Money into `*Cents` columns comes from `dollarsToCents()`** (validates + rounds), never inline `Number()`/`parseFloat()` — semgrep `glb-no-float-money`.
- **Integer ids from FormData**: `Number(fd.get("id"))` then `Number.isInteger(id)` guard before any write (see `deleteTripAction`).
- **D1 has no interactive transactions.** Multi-statement writes that must be atomic use `db.batch([...])`, not `db.transaction`.
- **Booleans** are `integer(..., { mode: "boolean" })` — compare as `true/false`, never `1/0`.
- **Schema change workflow**: edit `src/db/schema.ts` → `corepack pnpm drizzle-kit generate` → review the SQL in `src/db/migrations/` (forward-only, no `DROP`/destructive `ALTER`) → `corepack pnpm db:local` → update `src/db/seed.sql` (fictional data only).
