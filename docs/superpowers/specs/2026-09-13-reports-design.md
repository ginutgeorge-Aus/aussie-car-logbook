# Reports slice — design

**Date:** 2026-09-13
**Slice:** Reports (BAS quarterly + annual income-tax deduction, with car depreciation)
**Roadmap position:** Foundation+TaxEngine → Vehicles/Logbook → Expenses/OCR → **Reports** → Auth → PWA → Release

## Goal

Give the self-hosting user two tax outputs for a chosen financial year, printable to PDF for their accountant / ATO records:

1. **Quarterly BAS** — GST credit claimable per BAS quarter (Q1 Jul–Sep … Q4 Apr–Jun) and the FY total.
2. **Annual income-tax deduction** — business-use portion of running costs (GST-exclusive when GST-registered) **plus** diminishing-value car depreciation.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Scope | BAS + Annual, annual **includes** depreciation |
| Effective life | 8 years, fixed constant (ATO Commissioner default for motor vehicles → 2/8 = 25% diminishing rate) |
| Export | Print-optimized page; user does browser Print → Save as PDF. No server PDF lib (Cloudflare Workers-friendly). |
| Page layout | Single `/reports` page with an FY switcher; BAS section + Annual section |

## Architecture

Pure aggregation core composing existing tax functions, rendered by a thin server component. **No new DB columns** — `vehicle` already has `purchaseDate` and `purchaseCostCents`.

```
src/lib/tax/depreciation.ts   (+ depreciationForFy, EFFECTIVE_LIFE_YEARS)   ← pure, test-first
src/lib/tax/dates.ts          (+ fyQuarters, daysHeldInFy)                   ← pure, test-first
src/lib/reports/build.ts      (buildFyReport)                                ← pure, test-first
src/app/reports/page.tsx      (server component, force-dynamic)              ← thin render
src/app/reports/PrintButton.tsx (client, window.print())
src/app/globals.css           (@media print rules)
```

## Components

### 1. Tax core additions (`src/lib/tax/`, pure, colocated `*.test.ts`)

**`depreciation.ts`**
- `export const EFFECTIVE_LIFE_YEARS = 8;`
- `depreciationForFy(input: { purchaseCostCents: number; purchaseDateISO: string; fyLabel: string; effectiveLifeYears?: number }): number`
  - Cost base = `min(purchaseCostCents, carLimitFor(purchaseFyLabel))` where `purchaseFyLabel = financialYear(purchaseDateISO).label`.
  - Roll the written-down value **forward**, FY by FY, from the purchase FY up to `fyLabel`:
    - Purchase FY: `daysHeld = daysHeldInFy(purchaseDateISO, purchaseFyLabel)` (purchaseDate → 30 Jun inclusive).
    - Later FYs: `daysHeld = 365`.
    - Each FY: `decline = diminishingValue({ openingValueCents, daysHeld, effectiveLifeYears })`, clamp so `closing = max(0, opening − decline)`; next FY `opening = closing`.
  - Return the **full** decline for the target `fyLabel` (business-use % is applied by the caller, not here — decline reduces the asset's tax value regardless of business use).
  - If `fyLabel` is **before** the purchase FY → return `0`.
  - Relies on `carLimitFor` throwing when the purchase FY has no configured limit; the report layer catches and surfaces a notice (see Error handling).

**`dates.ts`**
- `fyQuarters(fyLabel: string): Array<{ quarter: 1|2|3|4; label: string; startISO: string; endISO: string }>` — the four BAS quarter ranges for an FY label (derived the same way `basQuarter` already derives them).
- `daysHeldInFy(dateISO: string, fyLabel: string): number` — inclusive day count from `max(dateISO, fyStart)` to `fyEnd`; `0` if the date is after the FY.

### 2. Reports aggregation (`src/lib/reports/build.ts`, pure + `build.test.ts`)

```ts
buildFyReport(input: {
  trips: Trip[];
  expenses: Expense[];
  vehicle: Vehicle | null;
  settings: Settings;
  fyLabel: string;
}): FyReport
```

`FyReport` shape:
```ts
{
  fyLabel: string;
  businessPct: number;          // recomputed from FY trips (never the bps cache)
  bas: {
    quarters: Array<{ quarter: 1|2|3|4; label: string; gstCreditCents: number }>;
    totalGstCreditCents: number;
  };
  annual: {
    runningCostsDeductionCents: number;   // annualDeduction(fyExpenses, ratio, gstRegistered)
    depreciationDeductionCents: number;   // round(businessPct × depreciationForFy(...)); 0 if no purchase data
    totalDeductionCents: number;
    byCategory: Array<{ category: ExpenseCategory; totalInclCents: number }>;
  };
  notices: string[];            // e.g. "No car cost limit configured for FY 2025-26 — depreciation omitted."
}
```

- `businessPct` ratio = `businessPct(tripsToLegs(filterTripsByFy(trips, fyLabel)))` — same source as the dashboard.
- Each quarter's `gstCreditCents` = `round(ratio × Σ gstCents of expenses whose date falls in that quarter range)`.
- Depreciation: if `vehicle.purchaseDate` and `vehicle.purchaseCostCents` are both present, compute `depreciationForFy` and multiply by ratio; on a thrown missing-limit error, set `depreciationDeductionCents = 0` and push a notice. Missing purchase data → `0`, no notice.

### 3. Page (`src/app/reports/page.tsx`, `force-dynamic`)

- Fetch `getVehicle`, `listTrips`, `listExpenses`, `getSettings` in parallel; resolve `fyLabel` from the search param (default = current FY via `financialYear(todayIso()).label`).
- Call `buildFyReport`, render:
  - **FY switcher** — reuse existing `FySwitcher` (available-FYs derived from trip + expense dates).
  - **BAS section** — table: 4 quarter rows (label, GST credit) + FY total row.
  - **Annual section** — running-costs deduction, depreciation deduction, total; category breakdown table.
  - **Notices** — render any `notices` as a warning banner.
  - **PrintButton** (client) calling `window.print()`.
- Nav link to `/reports` added to the dashboard action row (and trips/expenses page headers for parity).
- Dollars only at the render edge via `centsToDollars`.

### 4. Print styling (`globals.css`)

`@media print` — hide nav, action buttons, and the print button; ensure tables render cleanly; show FY label + report title as a header. No new dependency.

## Data flow

`page (server)` → `data layer (getDb/Drizzle)` → `buildFyReport (pure)` → JSX → (`window.print()` → browser PDF).

## Error handling

- Missing car cost limit for the purchase FY → caught in `buildFyReport`, depreciation set to 0, notice shown (not a crash).
- No vehicle / no purchase data → depreciation 0, annual still shows running costs.
- Zero total km → `businessPct` guards to 0 (existing behaviour); all credits/deductions 0.
- Empty FY (no trips/expenses) → all-zero report, no error.

## Testing

- `depreciation.test.ts`: purchase-year part-year decline; full-year roll-forward chain (year 2, year 3); cost-base capping at car limit; target FY before purchase → 0; write-off clamp at 0.
- `dates.test.ts`: `fyQuarters` ranges; `daysHeldInFy` for mid-FY purchase, pre-FY, post-FY.
- `build.test.ts`: quarter GST bucketing; FY total = Σ quarters; annual = running costs + depreciation; missing-limit notice path; no-vehicle path.
- Existing suite stays green; `tsc --noEmit` + `next build` gate.

## Assumptions (documented)

- `purchaseCostCents` is used as the depreciation cost base **as entered**. (GST-exclusive vs inclusive handling for GST-registered users is a future refinement; note in `docs/`.)
- Business-use % applied to reports = the FY-trips %, consistent with the dashboard. The ATO logbook-period validity window (~5 years) is a future refinement.
- Diminishing-value full-year `daysHeld` = 365 (ignores leap-day; matches ATO's /365 formula denominator).

## Out of scope (this slice)

- CSV / line-item export.
- Configurable effective life per vehicle.
- Expenses-page FY filter (deferred minor c).
- Multi-car.
- `currentVehicleId` dedup (deferred minor b) and unreachable `gstCents<0` guard (deferred minor a) — unrelated, leave for a cleanup pass.
