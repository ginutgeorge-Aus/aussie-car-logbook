# Foundation & Tax Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the open-source "Ginoo's Log Book" project skeleton (Next.js PWA on Cloudflare, D1+Drizzle, fake seed) and build the correctness-critical, fully unit-tested pure tax engine (business-use %, GST, annual deduction, FY/BAS bucketing, depreciation).

**Architecture:** Next.js 16 (App Router) deployed to Cloudflare Pages via `@opennextjs/cloudflare`. Persistence is Cloudflare D1 (SQLite) through Drizzle ORM. Receipt images will live in R2 and OCR in Workers AI (later slices). This plan delivers a running app shell, a versioned DB schema with fake seed data, and a standalone `src/lib/tax/` library of **pure functions** with Vitest coverage. No UI wiring of tax math yet — the engine is proven in isolation first.

**Tech Stack:** Next.js 16, TypeScript, Tailwind, `@opennextjs/cloudflare`, Wrangler, Cloudflare D1, Drizzle ORM + drizzle-kit, Vitest.

## Global Constraints

- **Money is integer cents everywhere** in DB and tax functions. Dollars only at UI edge.
- **Australian FY = 1 July – 30 June.** BAS quarters: Q1 Jul-Sep, Q2 Oct-Dec, Q3 Jan-Mar, Q4 Apr-Jun.
- **GST = 1/11 of GST-inclusive amount**, rounded to nearest cent.
- **GST-registered**: income-tax deduction uses GST-**exclusive** amounts (GST recovered via BAS).
- **Tax method: ATO logbook method only.** `businessPct = businessKm / totalKm`.
- **Car depreciation cost limit** is a per-FY constant (FY2024-25 = `6967400` cents = $69,674). Store in a constants map; must be updatable per year without code changes to logic.
- **No secrets, account IDs, DB IDs, personal data, or receipt images in the repo.** Commit only `*.example` config with placeholders.
- **Node/tooling:** pnpm as package manager. TypeScript strict mode on.
- **Import alias:** `@/` → `src/`.

## Design Record (approved)

Full app scope (this plan covers Foundation + Tax Engine only; later slices are separate plans):
Foundation+TaxEngine → Vehicles/Logbook UI → Expenses/OCR → Reports(BAS+Annual+export) → Auth(CF Access) → PWA polish → Release infra.

Data model tables: `vehicle`, `logbook_period`, `trip`, `expense`, `settings`. Single user per deployment. Deploy tagged releases to own Cloudflare; data stays in user's D1/R2.

## File Structure

- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs` — project config
- `wrangler.toml.example`, `.env.example`, `.dev.vars` (gitignored), `.gitignore`, `LICENSE`, `README.md` — OSS + CF config
- `drizzle.config.ts` — drizzle-kit config
- `src/db/schema.ts` — Drizzle table definitions (single responsibility: schema)
- `src/db/migrations/*` — generated SQL migrations
- `src/db/seed.ts` — fake sample data loader
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` — app shell
- `src/lib/tax/types.ts` — shared tax types (Trip, ExpenseInput, etc.)
- `src/lib/tax/dates.ts` — `financialYear`, `basQuarter`
- `src/lib/tax/logbook.ts` — `businessPct`, `businessPctRounded`
- `src/lib/tax/gst.ts` — `gstFromInclusive`, `gstCredit`
- `src/lib/tax/deduction.ts` — `annualDeduction`
- `src/lib/tax/depreciation.ts` — `diminishingValue`, `CAR_LIMIT_CENTS`
- `src/lib/tax/*.test.ts` — Vitest suites colocated with each module
- `vitest.config.ts` — test config

---

### Task 1: Project scaffold + OSS hygiene

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `.gitignore`, `LICENSE`, `README.md`, `.env.example`, `wrangler.toml.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces: a locally runnable Next.js app (`pnpm dev`), `@/` import alias, clean repo with no secrets.

- [ ] **Step 1: Scaffold Next.js app**

Run:
```bash
pnpm dlx create-next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-pnpm
```
Accept overwrite into current dir. Expected: `src/app/` created, `pnpm dev` boots.

- [ ] **Step 2: Add Cloudflare adapter + Drizzle + Vitest deps**

Run:
```bash
pnpm add drizzle-orm && pnpm add -D @opennextjs/cloudflare wrangler drizzle-kit vitest @cloudflare/workers-types
```

- [ ] **Step 3: Write `.gitignore` additions**

Append to `.gitignore`:
```
# Cloudflare / secrets
.dev.vars
.wrangler/
wrangler.toml
.env
.env.local
# build
.open-next/
```

- [ ] **Step 4: Write `wrangler.toml.example`**

```toml
name = "ginoos-log-book"
compatibility_date = "2025-09-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".open-next/assets"

# Copy this file to wrangler.toml and fill in your own IDs (gitignored).
[[d1_databases]]
binding = "DB"
database_name = "ginoos-log-book"
database_id = "REPLACE_WITH_YOUR_D1_ID"

[[r2_buckets]]
binding = "RECEIPTS"
bucket_name = "ginoos-log-book-receipts"

[ai]
binding = "AI"
```

- [ ] **Step 5: Write `.env.example`**

```
# Copy to .dev.vars for local dev (gitignored). No real values in this file.
APP_PASSWORD=change-me-local-only
```

- [ ] **Step 6: Write `LICENSE` (MIT) and README skeleton**

`LICENSE`: standard MIT text, author "Ginoo's Log Book contributors".
`README.md`: project purpose (AU car logbook, ATO logbook method), stack, "Deploy to Cloudflare" section placeholder, local dev steps, "no personal data in repo" note.

- [ ] **Step 7: Verify app runs**

Run: `pnpm dev`
Expected: server boots on :3000 with no errors. Ctrl+\ to stop (this terminal: Ctrl+C = copy).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js PWA on Cloudflare + OSS hygiene"
```

---

### Task 2: Vitest configuration

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `pnpm test` runs Vitest; `@/` alias resolves in tests.

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 2: Add test scripts to `package.json`**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Add a smoke test**

Create `src/lib/tax/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("vitest runs", () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: 1 passed.

- [ ] **Step 5: Delete smoke test and commit**

```bash
rm src/lib/tax/smoke.test.ts
git add -A
git commit -m "test: configure vitest with @/ alias"
```

---

### Task 3: Tax types

**Files:**
- Create: `src/lib/tax/types.ts`

**Interfaces:**
- Produces:
  - `type TripLeg = { km: number; isBusiness: boolean }`
  - `type ExpenseInput = { amountInclCents: number; gstCents: number; dateISO: string; category: ExpenseCategory }`
  - `type ExpenseCategory = "fuel" | "rego" | "insurance" | "service" | "repairs" | "tyres" | "interest" | "lease" | "depreciation" | "other"`

- [ ] **Step 1: Write `src/lib/tax/types.ts`**

```ts
export type ExpenseCategory =
  | "fuel" | "rego" | "insurance" | "service" | "repairs"
  | "tyres" | "interest" | "lease" | "depreciation" | "other";

export type TripLeg = { km: number; isBusiness: boolean };

export type ExpenseInput = {
  amountInclCents: number;
  gstCents: number;
  dateISO: string; // YYYY-MM-DD
  category: ExpenseCategory;
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(tax): add shared tax types"
```

---

### Task 4: FY and BAS-quarter date bucketing

**Files:**
- Create: `src/lib/tax/dates.ts`
- Test: `src/lib/tax/dates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `financialYear(dateISO: string): { startISO: string; endISO: string; label: string }` — label like `"2024-25"`.
  - `basQuarter(dateISO: string): { quarter: 1|2|3|4; startISO: string; endISO: string; label: string }` — label like `"Q2 2024-25"`.

- [ ] **Step 1: Write the failing test**

`src/lib/tax/dates.test.ts`:
```ts
import { expect, test } from "vitest";
import { financialYear, basQuarter } from "@/lib/tax/dates";

test("July date is start of new FY", () => {
  expect(financialYear("2024-07-01")).toEqual({ startISO: "2024-07-01", endISO: "2025-06-30", label: "2024-25" });
});
test("June date is end of FY started prior year", () => {
  expect(financialYear("2025-06-30")).toEqual({ startISO: "2024-07-01", endISO: "2025-06-30", label: "2024-25" });
});
test("BAS quarters map correctly", () => {
  expect(basQuarter("2024-08-15").quarter).toBe(1); // Jul-Sep
  expect(basQuarter("2024-11-01").quarter).toBe(2); // Oct-Dec
  expect(basQuarter("2025-02-10").quarter).toBe(3); // Jan-Mar
  expect(basQuarter("2025-05-20").quarter).toBe(4); // Apr-Jun
  expect(basQuarter("2024-11-01").label).toBe("Q2 2024-25");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/tax/dates.test.ts`
Expected: FAIL — cannot find module `dates`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/tax/dates.ts`:
```ts
const FY_START_MONTH = 7; // July

function fyBounds(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00Z");
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-12
  const startYear = m >= FY_START_MONTH ? y : y - 1;
  return { startYear };
}

export function financialYear(dateISO: string) {
  const { startYear } = fyBounds(dateISO);
  const endYear = startYear + 1;
  return {
    startISO: `${startYear}-07-01`,
    endISO: `${endYear}-06-30`,
    label: `${startYear}-${String(endYear).slice(2)}`,
  };
}

export function basQuarter(dateISO: string) {
  const fy = financialYear(dateISO);
  const m = Number(dateISO.slice(5, 7));
  // Jul(7)-Sep(9)=Q1, Oct-Dec=Q2, Jan-Mar=Q3, Apr-Jun=Q4
  const quarterMap: Record<number, 1 | 2 | 3 | 4> = {
    7: 1, 8: 1, 9: 1, 10: 2, 11: 2, 12: 2, 1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4,
  };
  const quarter = quarterMap[m];
  const startYear = Number(fy.startISO.slice(0, 4));
  const ranges: Record<1 | 2 | 3 | 4, [string, string]> = {
    1: [`${startYear}-07-01`, `${startYear}-09-30`],
    2: [`${startYear}-10-01`, `${startYear}-12-31`],
    3: [`${startYear + 1}-01-01`, `${startYear + 1}-03-31`],
    4: [`${startYear + 1}-04-01`, `${startYear + 1}-06-30`],
  };
  const [startISO, endISO] = ranges[quarter];
  return { quarter, startISO, endISO, label: `Q${quarter} ${fy.label}` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/tax/dates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tax): FY and BAS-quarter date bucketing"
```

---

### Task 5: Business-use percentage

**Files:**
- Create: `src/lib/tax/logbook.ts`
- Test: `src/lib/tax/logbook.test.ts`

**Interfaces:**
- Consumes: `TripLeg` from `@/lib/tax/types`.
- Produces:
  - `businessPct(trips: TripLeg[]): number` — ratio 0..1; returns 0 when total km is 0.
  - `businessPctRounded(trips: TripLeg[]): number` — whole-number percentage (e.g. 67).

- [ ] **Step 1: Write the failing test**

`src/lib/tax/logbook.test.ts`:
```ts
import { expect, test } from "vitest";
import { businessPct, businessPctRounded } from "@/lib/tax/logbook";

const trips = [
  { km: 100, isBusiness: true },
  { km: 100, isBusiness: true },
  { km: 100, isBusiness: false },
];

test("business ratio is businessKm/totalKm", () => {
  expect(businessPct(trips)).toBeCloseTo(200 / 300, 10);
});
test("rounded percentage", () => {
  expect(businessPctRounded(trips)).toBe(67);
});
test("no trips -> 0, no divide-by-zero", () => {
  expect(businessPct([])).toBe(0);
  expect(businessPctRounded([])).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/tax/logbook.test.ts`
Expected: FAIL — cannot find module `logbook`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/tax/logbook.ts`:
```ts
import type { TripLeg } from "@/lib/tax/types";

export function businessPct(trips: TripLeg[]): number {
  const total = trips.reduce((s, t) => s + t.km, 0);
  if (total === 0) return 0;
  const business = trips.filter((t) => t.isBusiness).reduce((s, t) => s + t.km, 0);
  return business / total;
}

export function businessPctRounded(trips: TripLeg[]): number {
  return Math.round(businessPct(trips) * 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/tax/logbook.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tax): business-use percentage from logbook trips"
```

---

### Task 6: GST helpers

**Files:**
- Create: `src/lib/tax/gst.ts`
- Test: `src/lib/tax/gst.test.ts`

**Interfaces:**
- Consumes: `ExpenseInput` from `@/lib/tax/types`.
- Produces:
  - `gstFromInclusive(amountInclCents: number): number` — 1/11, rounded to nearest cent.
  - `gstCredit(expenses: ExpenseInput[], businessPctRatio: number): number` — cents; `round(businessPct × Σ gstCents)`.

- [ ] **Step 1: Write the failing test**

`src/lib/tax/gst.test.ts`:
```ts
import { expect, test } from "vitest";
import { gstFromInclusive, gstCredit } from "@/lib/tax/gst";

test("GST is 1/11 rounded to nearest cent", () => {
  expect(gstFromInclusive(11000)).toBe(1000); // $110 -> $10
  expect(gstFromInclusive(9625)).toBe(875);   // $96.25 -> $8.75
});
test("GST credit is businessPct x total GST, rounded", () => {
  const exp = [
    { amountInclCents: 11000, gstCents: 1000, dateISO: "2024-08-01", category: "fuel" as const },
    { amountInclCents: 5500, gstCents: 500, dateISO: "2024-08-10", category: "service" as const },
  ];
  expect(gstCredit(exp, 0.5)).toBe(750); // 0.5 * 1500
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/tax/gst.test.ts`
Expected: FAIL — cannot find module `gst`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/tax/gst.ts`:
```ts
import type { ExpenseInput } from "@/lib/tax/types";

export function gstFromInclusive(amountInclCents: number): number {
  return Math.round(amountInclCents / 11);
}

export function gstCredit(expenses: ExpenseInput[], businessPctRatio: number): number {
  const totalGst = expenses.reduce((s, e) => s + e.gstCents, 0);
  return Math.round(totalGst * businessPctRatio);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/tax/gst.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tax): GST inclusive-split and BAS credit"
```

---

### Task 7: Annual income-tax deduction

**Files:**
- Create: `src/lib/tax/deduction.ts`
- Test: `src/lib/tax/deduction.test.ts`

**Interfaces:**
- Consumes: `ExpenseInput` from `@/lib/tax/types`.
- Produces:
  - `annualDeduction(expenses: ExpenseInput[], businessPctRatio: number, gstRegistered: boolean): number` — cents. GST-registered → deduct on GST-exclusive (`amountIncl - gst`); else on GST-inclusive. Result = `round(businessPct × Σ base)`.

- [ ] **Step 1: Write the failing test**

`src/lib/tax/deduction.test.ts`:
```ts
import { expect, test } from "vitest";
import { annualDeduction } from "@/lib/tax/deduction";

const exp = [
  { amountInclCents: 11000, gstCents: 1000, dateISO: "2024-08-01", category: "fuel" as const },
];

test("GST-registered deducts on GST-exclusive base", () => {
  // base = 11000 - 1000 = 10000; 60% -> 6000
  expect(annualDeduction(exp, 0.6, true)).toBe(6000);
});
test("not GST-registered deducts on GST-inclusive base", () => {
  // base = 11000; 60% -> 6600
  expect(annualDeduction(exp, 0.6, false)).toBe(6600);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/tax/deduction.test.ts`
Expected: FAIL — cannot find module `deduction`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/tax/deduction.ts`:
```ts
import type { ExpenseInput } from "@/lib/tax/types";

export function annualDeduction(
  expenses: ExpenseInput[],
  businessPctRatio: number,
  gstRegistered: boolean,
): number {
  const base = expenses.reduce((s, e) => {
    const amt = gstRegistered ? e.amountInclCents - e.gstCents : e.amountInclCents;
    return s + amt;
  }, 0);
  return Math.round(base * businessPctRatio);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/tax/deduction.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tax): annual income-tax deduction (GST-aware)"
```

---

### Task 8: Depreciation (diminishing value, car-limit capped)

**Files:**
- Create: `src/lib/tax/depreciation.ts`
- Test: `src/lib/tax/depreciation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CAR_LIMIT_CENTS: Record<string, number>` — keyed by FY label, e.g. `{ "2024-25": 6967400 }`.
  - `carLimitFor(fyLabel: string): number` — returns limit for FY, throws if unknown.
  - `diminishingValue(input: { openingValueCents: number; daysHeld: number; effectiveLifeYears: number }): number` — DV formula `openingValue × (daysHeld/365) × (2/effectiveLife)`, rounded cents.

- [ ] **Step 1: Write the failing test**

`src/lib/tax/depreciation.test.ts`:
```ts
import { expect, test } from "vitest";
import { CAR_LIMIT_CENTS, carLimitFor, diminishingValue } from "@/lib/tax/depreciation";

test("car limit lookup by FY", () => {
  expect(carLimitFor("2024-25")).toBe(6967400);
  expect(() => carLimitFor("1999-00")).toThrow();
});
test("diminishing value full year, 8yr life", () => {
  // 40000 * (365/365) * (2/8) = 10000
  expect(diminishingValue({ openingValueCents: 4000000, daysHeld: 365, effectiveLifeYears: 8 })).toBe(1000000);
});
test("diminishing value part year", () => {
  // 40000 * (182/365) * (2/8) ≈ 4986.30 -> 498630
  expect(diminishingValue({ openingValueCents: 4000000, daysHeld: 182, effectiveLifeYears: 8 })).toBe(498630);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/tax/depreciation.test.ts`
Expected: FAIL — cannot find module `depreciation`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/tax/depreciation.ts`:
```ts
// GST-exclusive car depreciation cost limit per FY (in cents).
// Update yearly from ATO. Source: ATO "car cost limit for depreciation".
export const CAR_LIMIT_CENTS: Record<string, number> = {
  "2023-24": 6864900, // $68,649
  "2024-25": 6967400, // $69,674
};

export function carLimitFor(fyLabel: string): number {
  const v = CAR_LIMIT_CENTS[fyLabel];
  if (v === undefined) throw new Error(`No car cost limit configured for FY ${fyLabel}`);
  return v;
}

export function diminishingValue(input: {
  openingValueCents: number;
  daysHeld: number;
  effectiveLifeYears: number;
}): number {
  const { openingValueCents, daysHeld, effectiveLifeYears } = input;
  const decline = openingValueCents * (daysHeld / 365) * (2 / effectiveLifeYears);
  return Math.round(decline);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/tax/depreciation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tax): diminishing-value depreciation with car-limit constants"
```

---

### Task 9: Drizzle schema + first migration

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema.ts`
- Create (generated): `src/db/migrations/*.sql`

**Interfaces:**
- Consumes: `ExpenseCategory` values (mirror as text column; enforce in app layer).
- Produces: D1 tables `vehicle`, `logbook_period`, `trip`, `expense`, `settings`. All money columns integer cents; all dates `text` ISO `YYYY-MM-DD`.

- [ ] **Step 1: Write `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
```

- [ ] **Step 2: Write `src/db/schema.ts`**

```ts
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const vehicle = sqliteTable("vehicle", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  make: text("make").notNull(),
  model: text("model").notNull(),
  rego: text("rego"),
  odoOpen: integer("odo_open"),
  odoClose: integer("odo_close"),
  purchaseDate: text("purchase_date"),
  purchaseCostCents: integer("purchase_cost_cents"),
});

export const logbookPeriod = sqliteTable("logbook_period", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  businessPctBps: integer("business_pct_bps"), // basis points (business% x 100), computed cache
  validUntil: text("valid_until"),
});

export const trip = sqliteTable("trip", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  periodId: integer("period_id").references(() => logbookPeriod.id),
  date: text("date").notNull(),
  odoStart: integer("odo_start").notNull(),
  odoEnd: integer("odo_end").notNull(),
  purpose: text("purpose"),
  isBusiness: integer("is_business", { mode: "boolean" }).notNull(),
});

export const expense = sqliteTable("expense", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  date: text("date").notNull(),
  category: text("category").notNull(),
  amountInclCents: integer("amount_incl_cents").notNull(),
  gstCents: integer("gst_cents").notNull().default(0),
  vendor: text("vendor"),
  receiptKey: text("receipt_key"), // R2 object key
  notes: text("notes"),
  ocrRaw: text("ocr_raw"),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fyStartMonth: integer("fy_start_month").notNull().default(7),
  gstRegistered: integer("gst_registered", { mode: "boolean" }).notNull().default(true),
  abn: text("abn"),
});
```

- [ ] **Step 3: Generate migration**

Run: `pnpm drizzle-kit generate`
Expected: a `.sql` file created under `src/db/migrations/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): Drizzle schema + first migration"
```

---

### Task 10: Local D1 + fake seed

**Files:**
- Create: `src/db/seed.ts`
- Modify: `package.json` (scripts), `wrangler.toml` (local only, gitignored — instruct copy from example)

**Interfaces:**
- Consumes: schema tables.
- Produces: `pnpm db:local` applies migrations to local D1; `pnpm db:seed` inserts fake sample rows. All seed data is fictional.

- [ ] **Step 1: Create local `wrangler.toml` from example**

Run: `cp wrangler.toml.example wrangler.toml`
Then set `database_id` to a placeholder acceptable for local (`local`); note this file is gitignored.

- [ ] **Step 2: Write `src/db/seed.ts` (fake data only)**

```ts
// Fake sample data for local dev/demo. No real personal or tax data.
export const seedSql = `
INSERT INTO settings (fy_start_month, gst_registered, abn) VALUES (7, 1, '00 000 000 000');
INSERT INTO vehicle (make, model, rego, odo_open, purchase_date, purchase_cost_cents)
  VALUES ('Toyota', 'Corolla', 'ABC123', 50000, '2023-07-01', 3000000);
INSERT INTO logbook_period (vehicle_id, start_date, end_date, business_pct_bps, valid_until)
  VALUES (1, '2024-07-01', '2024-09-23', 6700, '2029-06-30');
INSERT INTO trip (vehicle_id, period_id, date, odo_start, odo_end, purpose, is_business) VALUES
  (1, 1, '2024-07-02', 50000, 50040, 'Client visit', 1),
  (1, 1, '2024-07-03', 50040, 50060, 'Groceries', 0);
INSERT INTO expense (vehicle_id, date, category, amount_incl_cents, gst_cents, vendor) VALUES
  (1, '2024-07-05', 'fuel', 8900, 809, 'BP'),
  (1, '2024-08-01', 'service', 45000, 4091, 'Local Mechanic');
`;
```

- [ ] **Step 3: Add DB scripts to `package.json`**

Add to `"scripts"`:
```json
"db:local": "wrangler d1 migrations apply DB --local",
"db:seed": "wrangler d1 execute DB --local --command \"$(node -e \"import('./src/db/seed.ts').then(m=>process.stdout.write(m.seedSql))\" 2>/dev/null || cat src/db/seed.sql)\""
```
Note: if the inline node import is awkward in the runner, generate `src/db/seed.sql` from `seedSql` and run `wrangler d1 execute DB --local --file src/db/seed.sql`. Prefer the `.sql` file approach for reliability.

- [ ] **Step 4: Apply migrations + seed locally**

Run:
```bash
pnpm db:local
wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```
Expected: lists `vehicle`, `logbook_period`, `trip`, `expense`, `settings`.

- [ ] **Step 5: Verify seed loads**

Run: `wrangler d1 execute DB --local --file src/db/seed.sql` (after writing seed.sql), then
`wrangler d1 execute DB --local --command "SELECT count(*) FROM expense;"`
Expected: 2.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): local D1 apply + fake seed data"
```

---

### Task 11: Wire tax engine to seeded data (integration smoke)

**Files:**
- Create: `src/lib/tax/index.ts` (barrel export)
- Test: `src/lib/tax/integration.test.ts`

**Interfaces:**
- Consumes: all tax functions.
- Produces: `@/lib/tax` barrel exporting every public function; one end-to-end test proving the engine composes over realistic (fake) inputs matching the seed.

- [ ] **Step 1: Write barrel `src/lib/tax/index.ts`**

```ts
export * from "@/lib/tax/types";
export * from "@/lib/tax/dates";
export * from "@/lib/tax/logbook";
export * from "@/lib/tax/gst";
export * from "@/lib/tax/deduction";
export * from "@/lib/tax/depreciation";
```

- [ ] **Step 2: Write the failing integration test**

`src/lib/tax/integration.test.ts`:
```ts
import { expect, test } from "vitest";
import { businessPct, gstCredit, annualDeduction, basQuarter } from "@/lib/tax";

test("end-to-end over seed-like data", () => {
  const trips = [
    { km: 40, isBusiness: true },
    { km: 20, isBusiness: false },
  ];
  const pct = businessPct(trips); // 40/60
  const expenses = [
    { amountInclCents: 8900, gstCents: 809, dateISO: "2024-07-05", category: "fuel" as const },
    { amountInclCents: 45000, gstCents: 4091, dateISO: "2024-08-01", category: "service" as const },
  ];
  expect(basQuarter("2024-08-01").quarter).toBe(1);
  expect(gstCredit(expenses, pct)).toBe(Math.round((809 + 4091) * (40 / 60)));
  expect(annualDeduction(expenses, pct, true)).toBe(
    Math.round((8900 - 809 + 45000 - 4091) * (40 / 60)),
  );
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm test src/lib/tax/integration.test.ts`
Expected: PASS.

- [ ] **Step 4: Run full suite**

Run: `pnpm test`
Expected: all tax suites green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(tax): end-to-end engine integration + barrel export"
```

---

## Verification (whole plan)

- `pnpm test` → all tax suites pass (dates, logbook, gst, deduction, depreciation, integration).
- `pnpm dev` → app shell boots with no errors.
- `pnpm db:local` + seed → 5 tables exist, fake rows load, counts correct.
- `git log --oneline` → one commit per task, no secrets/IDs/personal data committed (`git ls-files | grep -E 'wrangler.toml$|.dev.vars|.env$'` returns nothing).

## Out of Scope (later plans)

Vehicles/Logbook UI, Expenses capture + Workers AI OCR + R2 upload, Reports (BAS/annual/CSV/PDF export), Cloudflare Access auth, PWA manifest/service-worker polish, release infra (CHANGELOG, tags, Deploy-to-Cloudflare button, backup/export command).

## Self-Review Notes

- Spec coverage: foundation + full tax-math core covered; UI/OCR/reports/auth deferred to named later plans (listed above) — intentional decomposition, not gaps.
- Money as integer cents consistent across all tasks. `businessPct` returns ratio 0..1 consumed uniformly by `gstCredit`/`annualDeduction`.
- Naming consistent: `businessPct`, `gstCredit`, `annualDeduction`, `diminishingValue`, `financialYear`, `basQuarter` used identically in producer and consumer tasks.
- Depreciation is computed standalone here; its integration into the annual report total is a Reports-plan task.
