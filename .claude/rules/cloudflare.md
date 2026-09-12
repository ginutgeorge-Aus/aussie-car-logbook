---
paths:
  - "src/db/**"
  - "src/lib/data/**"
  - "src/lib/actions.ts"
  - "next.config.ts"
  - "cloudflare-env.d.ts"
  - "wrangler.toml"
---

# Cloudflare bindings (D1 / R2 / Workers AI / Access)

Deploy target: **Cloudflare Pages** via `@opennextjs/cloudflare`. Bindings are typed in `cloudflare-env.d.ts` (`interface CloudflareEnv`) — add `RECEIPTS` (R2) and `AI` there when a slice first uses them.

## Data access

- **Always** get the DB via `await getDb()` (`src/db/client.ts`) — it calls `getCloudflareContext({ async: true })`, so it is `async`. No module-level DB singleton (no request context at import time).
- Query/mutation helpers live in `src/lib/data/**` (Drizzle). Server Components read them directly; forms post to Server Actions in `src/lib/actions.ts`.
- **DB-backed routes must set `export const dynamic = "force-dynamic"`** — otherwise Next tries to static-render at build with no binding and fails.
- Server actions: validate (`parse*`) → write → `revalidatePath(...)`, return typed `ActionResult`. Never trust FormData shapes without a parser.

## Schema / migrations

- Schema: `src/db/schema.ts` (SQLite via `drizzle-orm/sqlite-core`). Generate migrations with `corepack pnpm drizzle-kit generate`; apply locally with `db:local`.
- **Migrations are versioned, forward-only, non-destructive** — data survives upgrades. Add a backup step before a major upgrade.
- Column conventions: money = `integer` cents (`*Cents`), dates = `text` ISO, booleans = `integer(..., { mode: "boolean" })`, R2 objects stored as key text (`receiptKey`).

## Secrets (public repo — hard rule)

Never commit secrets, `account_id`/`database_id`, personal data, or receipt images. `.dev.vars`, `wrangler.toml`, `.env*`, `.wrangler/`, `.open-next/` are gitignored. Commit only `*.example` with placeholders. Auth is Cloudflare Access (no in-app auth code).
