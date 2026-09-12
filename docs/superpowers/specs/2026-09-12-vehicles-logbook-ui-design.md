# Vehicles / Logbook UI — Design

**Slice:** Vehicles/Logbook UI (slice 2 of the roadmap).
**Date:** 2026-09-12.
**Status:** Approved design. Next step: implementation plan (`writing-plans`).

## Purpose

Deliver the first real UI and data-access plumbing on top of the completed tax engine
(slice 1). Let the single user set up their car and log trips year-round, and see a live
business-use percentage per financial year (derived by the existing tax engine). This slice
establishes the DB-access + server-action patterns every later slice reuses.

## Scope

**In scope**
- Vehicle setup/edit (single car).
- Trip log: add / edit / delete trips, listed per financial year (FY).
- Live FY business-use % (from the tax engine).
- First data-access layer (`getDb()`) and server-action mutation pattern.

**Out of scope (later slices)**
- Logbook *period* grouping/labels/CRUD (deferred — trips are tracked all year, `trip.periodId`
  stays nullable and unused this slice).
- Expenses capture, OCR, R2 upload (Expenses/OCR slice).
- Reports: BAS, annual deduction, CSV/PDF export (Reports slice).
- Auth via Cloudflare Access (Auth slice).
- PWA manifest / service worker (PWA polish slice).

## Decisions (from brainstorm 2026-09-12)

- **Single car.** UI manages one vehicle. Schema keeps `vehicleId` FKs and supports many, but the
  UI reads/writes the single vehicle row (first row; create on first save).
- **All trips year-round.** Not scoped to a 12-week period. `trip.periodId` nullable and unused.
  Business% = running total over the selected FY's trips.
- **Server Components + Server Actions.** Pages are RSC reading D1 directly via Drizzle; forms post
  to server actions. Minimal client JS. Chosen over REST route handlers (needless boilerplate for a
  single-user local-first app) and client-only (worst fit).

## Architecture

### Data access layer (new)
- `src/db/client.ts` → `getDb()`: wraps `getCloudflareContext().env.DB` (from
  `@opennextjs/cloudflare`) and returns `drizzle(DB, { schema })` — a typed Drizzle client, resolved
  per request.
- `src/lib/data/vehicle.ts`: `getVehicle()`, `upsertVehicle(input)`.
- `src/lib/data/trip.ts`: `listTrips(fyLabel)`, `createTrip(input)`, `updateTrip(id, input)`,
  `deleteTrip(id)`.
- Server actions (`"use server"`) wrap the data fns: validate input → write → `revalidatePath`.
  Actions live beside the data fns or in a colocated `actions.ts`; they return a typed result
  `{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string,string> }`.

### Pure logic (unit-tested, no DB)
Extracted to `src/lib/logbook/` so Vitest covers the risky derivations without touching I/O:
- `tripKm(trip)` = `odoEnd - odoStart`.
- `tripsToLegs(trips): TripLeg[]` — maps DB trip rows to the tax engine's `TripLeg` shape
  (`{ km, isBusiness }`).
- `filterTripsByFy(trips, fyLabel)` — keeps trips whose `date` falls in the FY.
- FY business% = `businessPctRounded(tripsToLegs(filterTripsByFy(trips, fy)))` — reuses the slice-1
  tax engine; no new percentage math.

### Routes (App Router)
- `/` — dashboard: vehicle summary card + current-FY business% + link to trips. Replaces the current
  placeholder `page.tsx`.
- `/vehicle` — setup/edit form: `make`, `model`, `rego`, `odoOpen`, `purchaseDate`,
  `purchaseCostCents`. `purchaseDate` and `purchaseCostCents` optional (feed the depreciation slice
  later).
- `/trips` — FY switcher (`?fy=2024-25`, default = current FY from today's date via `financialYear`)
  + trip list for that FY + add-trip form + per-row edit/delete.

### Components
- `src/components/` — `VehicleForm`, `TripForm`, `TripRow`, an FY switcher, and small
  money/date input helpers.

## Conventions

- **Money:** dollars only at the input/display edge; convert to integer cents on submit, format
  cents → dollars on render. Cents everywhere in DB + actions (matches slice-1 rule).
- **Dates:** native `<input type="date">`, stored as ISO `YYYY-MM-DD` text.
- **FY selection:** query param `?fy=YYYY-YY`; default current FY. Switcher lists FYs that have trips,
  plus the current FY.

## Data flow

1. RSC page → `getDb()` → data fn (`getVehicle` / `listTrips`) → render.
2. Form submit → server action → validate → Drizzle write → `revalidatePath('/trips'` or `'/')`.

## Error handling & edge states

- **Validation:** required fields; `odoEnd > odoStart`; `odoStart`, `odoEnd`, amounts ≥ 0. Actions
  return field-level errors; forms render them inline.
- **No vehicle yet:** dashboard and `/trips` prompt "set up your car first" → link to `/vehicle`.
- **No trips in FY:** empty state + inline add form; business% shows 0% (tax engine already returns 0
  for empty/zero-km input — no divide-by-zero).

## Testing & verification

- **Vitest** on the pure logic: `tripKm`, `tripsToLegs`, `filterTripsByFy`, and the FY-business%
  composition. No DB.
- **Data-access + server actions:** not unit-tested (I/O boundary); covered by `pnpm build` +
  `tsc --noEmit`.
- **Verification:** `corepack pnpm build` + `corepack pnpm exec tsc --noEmit` are the gates (local
  `pnpm dev` is blocked by the sandbox inotify limit). The user can run `corepack pnpm dev` to click
  through the flow manually.

## Implementation notes

- **Next 16 breaking changes:** per `AGENTS.md`, read the relevant guide under
  `node_modules/next/dist/docs/` before writing route/server-action/form code — App Router APIs and
  conventions may differ from prior versions.
- **Cloudflare binding in dev/build:** `getCloudflareContext()` requires the OpenNext dev setup;
  confirm the local D1 binding resolves (slice 1 already applies migrations + seed to local D1).
- **Single-vehicle upsert:** `upsertVehicle` targets the existing row if present, else inserts;
  `getVehicle` returns the first (only) row or `null`.

## Out-of-scope confirmations

Periods, expenses/OCR, reports, auth, PWA polish, and release infra are each their own later slice —
intentional decomposition, not gaps.
