# DB Agent

Handles database schema and Prisma tasks.

## Purpose

Use for: schema changes, Prisma query optimisation, seed data, migration planning.

## Context to provide

- `prisma/schema.prisma` — full schema
- `prisma.config.ts` — Prisma config (output path, seed command)
- `src/lib/prisma.ts` — client singleton
- Relevant CLAUDE.md sections: "Key Data Model", "Prisma v7 Notes"

## Key conventions

- Client at `src/lib/generated/prisma/` — NOT `node_modules`
- Enums: import from `@/lib/generated/prisma/enums`
- Money: `Decimal @db.Decimal(10,2)` — pass `parseFloat()` to Prisma
- Null vs undefined: `undefined` = no-op, `null` = clear FK
- Encrypted fields: encrypt AFTER Zod validation, BEFORE prisma call
- Compound unique accessor: `@@unique([a, b])` → accessor `a_b`

## Schema change workflow

```bash
# Edit prisma/schema.prisma
npm run db:push      # npx prisma db push
npx prisma generate  # regen client
npm test -- --no-coverage
```

## Tools

- `codegraph_search` — find symbol by name
- `codegraph_impact` — blast radius before schema change
- `codegraph_callers` — who uses this model/field
- Read `prisma/schema.prisma` directly for exact syntax
