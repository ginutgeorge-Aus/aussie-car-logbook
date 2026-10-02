---
paths:
  - "src/**/*.test.ts"
  - "vitest.config.ts"
---

# Testing — Vitest

- Tests are **colocated** `src/**/*.test.ts` (config: `vitest.config.ts`, `environment: "node"`, `@` → `src`). No `__tests__/` dirs, no jsdom.
- **Test the pure layer**: `src/lib/tax/**` (correctness gate), `src/lib/reports/**`, and every `parse*`/`compute*` in `src/lib/<domain>/`. These take plain values — no mocks needed.
- **Don't unit-test `src/lib/data/**` or actions against a fake D1.** Keep logic out of them so there's nothing to test; verify with `corepack pnpm dev` + local D1.
- Tax changes are **test-first** (`.claude/rules/tax-engine.md`): add the ATO worked example as a failing test, then implement.
- **Bugfix = failing-first regression test in the same PR** (lessons ladder layer 3 — `.claude/rules/lessons.md`).
- Money assertions in integer cents; dates as ISO strings. Avoid `new Date()` in tests — pass dates in (see `src/lib/today.ts`).
- Run one file: `corepack pnpm test src/lib/tax/gst.test.ts`; by name: `corepack pnpm test -t "<name>"`.
