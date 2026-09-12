---
paths:
  - "src/lib/tax/**"
  - "src/lib/logbook/**"
---

# Tax engine (pure core)

`src/lib/tax/**` is the correctness core: **pure functions, no I/O, no DB, no Date-of-now**. Change it **test-first** (colocated `*.test.ts`, run `corepack pnpm test`). `src/lib/logbook/**` builds on it (compute + form parsers) — same purity rule.

## Non-negotiables

- **Integer cents everywhere.** Never floats for money inside tax/logbook functions. Dollars ↔ cents conversion lives only at the UI edge (`parse.ts` `dollarsToCents`/`centsToDollars`).
- **Dates = ISO `YYYY-MM-DD` text.** AU FY = 1 Jul–30 Jun. Never derive "now" inside a pure function — the caller passes the date string. (Callers must build today in `Australia/Sydney`, not UTC — `toISOString()` slices the wrong day near the 1 Jul boundary.)
- **Method = ATO logbook only.** `businessPct = businessKm / totalKm`. Guard divide-by-zero → 0. `businessPctRounded` is the rounding authority; UI must not re-round.
- **GST** = 1/11 of GST-inclusive amount, rounded. Income-tax deduction uses GST-**exclusive** amounts; BAS credit = `businessPct × ΣGST`.
- **Depreciation cost limit** is a per-FY constant in `depreciation.ts`. Update yearly from the ATO; never inline into logic.

## Module map

`dates` (FY/quarter math) · `logbook` (business%) · `gst` · `deduction` · `depreciation`. All re-exported from `index.ts`; import from `@/lib/tax`, not deep paths.

`businessPctBps` in the DB (`logbook_period`) is basis points (business% × 100) — a **computed cache**, not a source of truth. Recompute from trips; never trust the cache for reports.
