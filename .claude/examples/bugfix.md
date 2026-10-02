# Bug Fix Workflow

Standard skill order for any bug or test failure in Ginoo's Log Book.

## Steps

### 1. Systematic debugging
```
/systematic-debugging
```
Diagnose root cause before touching code. Surface assumptions. Check logs, tests, and stack traces.

### 2. Write a reproducing test
Before fixing, write a colocated `*.test.ts` that fails with the current bug. This is your success criterion (lessons ladder layer 3 — `.claude/rules/lessons.md`).

### 3. Fix — minimal, surgical
Touch only the broken code. Do not refactor adjacent code. Match existing style.

### 4. Verify fix
```bash
corepack pnpm test <affected-file>
corepack pnpm lint
corepack pnpm exec tsc --noEmit
```

### 5. Commit
```
/caveman-commit
```

## Common issues

| Symptom | Likely cause |
|---|---|
| Build fails "binding not found" / static render error | DB-backed route missing `export const dynamic = "force-dynamic"` |
| `getCloudflareContext` throws at import | Module-level DB/R2 access — call `await getDb()` inside the function |
| Wrong default FY on 1 Jul | Used `new Date().toISOString()` (UTC) — use `src/lib/today.ts` |
| Totals off by a cent | Rounded twice, or dollars math — keep integer cents, round once |
| `pnpm: command not found` | Use `corepack pnpm …` |
| Local D1 empty / table missing | Run `corepack pnpm db:local` (then `db:seed`) |
