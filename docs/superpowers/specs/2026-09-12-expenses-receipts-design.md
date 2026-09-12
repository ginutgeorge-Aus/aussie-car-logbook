# Slice 3a — Expenses & Receipts (design)

**Date:** 2026-09-12
**Status:** approved (brainstorm)
**Scope:** Expense CRUD + R2 receipt upload/view + per-receipt GST + light dashboard FY summary.
**Out of scope (→ later slices):** Workers AI OCR pre-fill (**slice 3b**); full BAS/annual reports + export (**Reports slice**).

## Goal

Let the single user capture car expenses (with optional receipt photo), track GST per
receipt, and see a live current-FY tax summary — building on the slice-2 vehicle/logbook
foundation and the existing pure tax engine.

## Locked decisions (from 2026-09-12 brainstorm)

1. **Slice split** — 3a = CRUD + R2 + GST (all local-testable). OCR is a separate slice 3b.
2. **Receipt image is optional** — an expense can be saved with typed fields only.
3. **Category = fixed dropdown + Other** — consistent data for later report grouping.
4. **GST = auto-fill, editable, GST-free toggle** — field defaults to `amount / 11`, stays
   editable, and a "GST-free" checkbox zeroes it (rego, some insurance).
5. **R2 I/O = server action upload + streamed route** — file rides in FormData to a server
   action which puts to the `RECEIPTS` binding; a Next route handler streams it back.
6. **Dashboard gains a light FY summary** — FY total expenses, est. GST credit, est. deduction.

## What already exists (no change needed)

- **`expense` table** (`src/db/schema.ts`) already has every column: `id, vehicleId, date,
  category, amountInclCents, gstCents (default 0), vendor, receiptKey, notes, ocrRaw`.
  **No new migration in this slice.** (`ocrRaw` stays unused until 3b.)
- **Tax engine** (`src/lib/tax/`): `gstFromInclusive(cents) = round(cents/11)`,
  `gstCredit(expenses, pctRatio)`, `annualDeduction(expenses, pctRatio, gstRegistered)`,
  and FY date helpers in `dates.ts`.
- **Patterns**: `getDb()` (`src/db/client.ts`), data layer with a `currentVehicleId()`
  helper (`src/lib/data/trip.ts`), server actions returning `ActionResult` with a `parse*`
  validator (`src/lib/actions.ts`, `src/lib/logbook/parse.ts`), inline-edit row pattern
  (`TripRow`), `dollarsToCents` at the UI edge.
- **`wrangler.toml.example`** already declares the `RECEIPTS` R2 bucket and `AI` bindings.

## Components

Each unit has one purpose, a narrow interface, and is independently reasoned about.

### 1. `src/lib/expenses/categories.ts`
Single source of truth for categories:
`["Fuel","Registration","Insurance","Servicing","Repairs","Tyres","Car wash","Interest/Lease","Other"]`
Exported as a readonly tuple + a `Category` union type. Consumed by the parser (validation)
and the form dropdown.

### 2. `src/lib/expenses/parse.ts` (+ `parse.test.ts`) — **pure, unit-tested**
`parseExpenseForm(fd: FormData): ParseResult<ExpenseInput>`
- **date** — required, ISO `YYYY-MM-DD`.
- **category** — required, must be a member of the categories tuple.
- **amountIncl** — dollars string → `dollarsToCents`; must be a positive integer of cents (> 0).
- **gstFree** — checkbox. When checked, GST = 0.
- **gst** — dollars string → cents. If blank and not GST-free, default to
  `gstFromInclusive(amountInclCents)`. Clamp to `0 ≤ gst ≤ amountInclCents`.
- **vendor / notes** — optional trimmed text → `null` when empty.
- Returns `ExpenseInput = { date, category, amountInclCents, gstCents, vendor, notes }`
  (no file — the file is handled in the action, not the pure parser).
- Field-level errors via the existing `ParseResult` shape → `ActionResult.fieldErrors`.

### 3. `src/lib/data/receipts.ts` — R2 wrapper (not unit-tested; live binding)
- `putReceipt(vehicleId, file): Promise<string>` — validates content-type is an image and
  size ≤ a sane cap (e.g. 10 MB); key = `receipts/<vehicleId>/<uuid>.<ext>`; `env.RECEIPTS.put`.
- `getReceipt(key): Promise<R2ObjectBody | null>` — `env.RECEIPTS.get`.
- `deleteReceipt(key): Promise<void>` — `env.RECEIPTS.delete`; no-op on empty key.
- UUID via `crypto.randomUUID()` (Workers runtime).

### 4. `src/lib/data/expense.ts` — Drizzle data layer (live binding)
- `listExpenses(): Promise<ExpenseRow[]>` — all expenses, `orderBy(desc(date))`.
- `createExpense(input, receiptKey|null)` — resolves `currentVehicleId()` (throws
  "No vehicle set up yet." when none, mirroring `createTrip`); inserts.
- `updateExpense(id, input, receiptKey?)` — updates fields; only overwrites `receiptKey`
  when a new one is provided (undefined = keep existing).
- `deleteExpense(id)` — reads the row's `receiptKey`, deletes the row, then
  `deleteReceipt(key)` if present.

### 5. `src/app/receipt/[...key]/route.ts` — GET stream
Catch-all (keys contain `/`). Rebuilds the key from `params.key.join("/")`, `getReceipt`,
returns `404` when missing, else streams `object.body` with `Content-Type` from
`object.httpMetadata` (fallback `application/octet-stream`) and a private `Cache-Control`.
Access-gated at the platform layer (Cloudflare Access), no in-app auth.

### 6. `src/lib/actions.ts` — server actions
- `createExpenseAction(_prev, fd)` — `parseExpenseForm`; if a non-empty file is present,
  `putReceipt` → key; `createExpense`; `revalidatePath("/expenses")` + `"/"`.
- `updateExpenseAction(id, _prev, fd)` — parse; optional new file → new key (and delete the
  old object on successful replace); `updateExpense`; revalidate.
- `deleteExpenseAction(fd)` — `deleteExpense(id)` (which cleans R2); revalidate.
- All wrap data calls in try/catch → `ActionResult.error` (surfaced in UI; slice-2 left this
  unsurfaced — fix it here).

### 7. UI — `src/app/expenses/page.tsx` + `ExpenseForm` + `ExpenseRow`
- Server page: `listExpenses()` → renders `ExpenseForm` (add) + a list of `ExpenseRow`.
- **`ExpenseForm`** (client): category `<select>`, amount, GST (auto-mirrors `amount/11`
  live, editable), "GST-free" checkbox (disables/zeroes GST), date (default today via
  `todayIso`), vendor, notes, `<input type="file" accept="image/*" capture="environment">`.
  Uses `useActionState` + `FieldError` like `TripForm`.
- **`ExpenseRow`** (client): display + inline edit (same toggle pattern as `TripRow`),
  a receipt thumbnail linking to `/receipt/<key>` when present, and a delete button.
- Money shown in dollars; cents only cross the wire.

### 8. Dashboard — `src/app/page.tsx`
Add a current-FY summary card using existing helpers: filter expenses to the active FY
(`dates.ts`), then show **FY total expenses**, **est. GST credit** = `gstCredit(fyExpenses,
businessPctRatio)`, **est. income-tax deduction** = `annualDeduction(fyExpenses,
businessPctRatio, settings.gstRegistered)`. Reuses the existing FY business% already on the
dashboard. Labelled "estimate" — full reports come in the Reports slice.

### 9. `cloudflare-env.d.ts`
Add `RECEIPTS: R2Bucket` to `CloudflareEnv`. (AI binding deferred to 3b.)

## Data flow

- **Create:** form (dollars) → action → `parseExpenseForm` (→cents) → optional `putReceipt`
  → `createExpense`. Server GST is authoritative (`gstFromInclusive` + clamp).
- **View receipt:** `<img src="/receipt/<key>">` → route → R2 → streamed bytes.
- **Delete:** `deleteExpense` → drop row + `deleteReceipt(key)`.

## Error handling

- Parser → `fieldErrors` rendered inline by `FieldError`.
- Data/R2 failures → caught → `ActionResult.error`, shown near the form.
- No vehicle yet → action surfaces "No vehicle set up yet." (same as trips).
- Receipt route → `404` on missing key; empty/oversized/non-image upload rejected in
  `putReceipt` with a clear message.

## Testing & known gaps

- **Unit-tested (Vitest):** `parseExpenseForm` — ISO date, category membership,
  amount > 0, GST default/clamp, GST-free zeroing, dollars→cents, optional-field nulling.
- **Not locally testable:** R2 put/get/stream + Drizzle data layer need live Cloudflare
  bindings. Gate = `tsc --noEmit` + `next build` (+ CI). Real R2 behaviour verified on a
  Cloudflare deploy — the same live-binding gap accepted for D1 in slice 2.

## Scope guards (decided by default, confirmed)

- **Expenses list = all expenses**, newest first. No FY filter / FySwitcher on the expenses
  page in this slice (dashboard summary is FY-scoped). Deferrable.
- **No new migration** — `expense` table already sufficient.
- **No OCR, no `ocrRaw` writes** — slice 3b.

## File map (new unless noted)

```
src/lib/expenses/categories.ts
src/lib/expenses/parse.ts
src/lib/expenses/parse.test.ts
src/lib/data/receipts.ts
src/lib/data/expense.ts
src/app/receipt/[...key]/route.ts
src/app/expenses/page.tsx
src/components/ExpenseForm.tsx
src/components/ExpenseRow.tsx
src/lib/actions.ts        (extend)
src/app/page.tsx          (extend: FY summary)
cloudflare-env.d.ts       (extend: RECEIPTS)
```
