---
paths:
  - "prisma/**"
  - "prisma.config.ts"
  - "src/lib/prisma.ts"
  - "src/lib/generated/**"
---

# Database Access & Prisma v7

All DB via `@prisma/adapter-pg`. No raw SQL.

```typescript
import { prisma } from "@/lib/prisma"
```

Generated client at `src/lib/generated/prisma/`. Import enums from `@/lib/generated/prisma/enums`.

**Prisma singleton (`src/lib/prisma.ts`):** `prisma` is a lazy `Proxy` that constructs the real client on first property access and caches it on `globalThis`, so every App Router chunk shares ONE `PrismaClient` + `pg.Pool` (not one per bundled chunk). It is lazy because `next build`'s page-data collection imports this module inside the Docker build stage, which has no `DATABASE_URL` — an eager client would throw and break the image build (v1.1.4). First real use at runtime still fails loudly if `DATABASE_URL` is unset (#296). Prod is Azure PostgreSQL Flexible Server (Supabase was decommissioned in #210).
```typescript
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = (globalForPrisma.prisma ??= createPrismaClient())
    const v = Reflect.get(client, prop, client)
    return typeof v === "function" ? v.bind(client) : v
  },
})
```

## Prisma v7 Notes

- Client at `src/lib/generated/prisma/` — import `PrismaClient` from `./generated/prisma/client`
- Direct TCP via `@prisma/adapter-pg` — HTTP proxy (`prisma+postgres://`) not used (version mismatch)
- Config: `prisma.config.ts` (dotenv, CLI only). Local DB: port 51214, database `template1`.
- **Destructive push consent**: `prisma db push --force-reset` (used by e2e `global-setup.ts`) blocked under Claude Code unless `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=1` set in env.
- **Enum syntax**: multi-line only — single-line → P1012
- **Money**: `Decimal @db.Decimal(10, 2)`. Pass `parseFloat(str)` to Prisma (accepts `number`). Use `toFloat(d)` from `src/lib/utils.ts` to read back.
- **Dates / timezone (#364)**: prod server is UTC, church is Australia/Sydney. Store calendar dates at **UTC midnight** (`new Date("YYYY-MM-DD")` or `fyDateRange()`); never `new Date(y, m, d)` (server-local). For a default "today"/FY use `lib/dates` (`sydneyToday`, `sydneyTodayYMD`, `currentFYYear`) — derived from the Sydney wall clock, not the server clock. Date-range `lte` upper bounds must use `endOfDayUTC(date)` (`T23:59:59.999Z`) so the whole `to` day is included.
- **null vs undefined**: `undefined` = no-op, `null` = clear. Use `null` for any optional field user might clear — FK fields (`familyId`, `personId`) AND clearable strings (`bankingName`). Zod transform: `z.string().optional().transform((v) => v?.trim() || null)`.
- **`@@unique` compound accessor**: `@@unique([a, b])` → accessor `a_b`. e.g. `AccountGroup` → `prisma.accountGroup.findUnique({ where: { name_type: { name, type } } })`
- **`select` over `include`**: Always `select` in queries feeding Server Components or `ActivityFeed`-style presentational components. `include` fetches all scalar fields incl PII (`email`, `phone`, `ip`, `metadata`). Fetch only what component type needs.

**Schema change workflow:** edit `prisma/schema.prisma` → `npm run db:push` → `npx prisma generate`. For prod, use Prisma Migrate — see `docs/deployment.md`.
