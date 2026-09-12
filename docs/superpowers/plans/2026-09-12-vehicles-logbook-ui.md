# Vehicles / Logbook UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first real UI + data-access layer on the slice-1 tax engine: set up one car, log trips year-round, and see a live per-FY business-use %.

**Architecture:** Next.js 16 App Router. Server Components read Cloudflare D1 via a `getDb()` Drizzle client; forms post to Server Actions that validate, write, and `revalidatePath`. All risky derivations (km, trip→leg mapping, FY filtering, money/form parsing) are pure functions unit-tested with Vitest, with zero I/O. The tax engine's `businessPctRounded` is reused unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM (`drizzle-orm/d1`), `@opennextjs/cloudflare` (`getCloudflareContext`, `initOpenNextCloudflareForDev`), Cloudflare D1, Vitest, Tailwind v4.

## Global Constraints

- **Money is integer cents** in DB + all logic. Dollars only at the input/display edge.
- **Dates are ISO `YYYY-MM-DD` text.** Australian FY = 1 Jul – 30 Jun.
- **Single vehicle:** UI reads/writes one vehicle row (first row; insert if none). Schema keeps FKs and supports many.
- **All trips year-round:** `trip.periodId` stays nullable and unused this slice. Business% = running total over the selected FY.
- **DB-backed routes must be dynamic:** add `export const dynamic = "force-dynamic";` to any page/layout that calls `getDb()`, so `next build` does not invoke `getCloudflareContext()` during prerender.
- **Import alias:** `@/` → `src/`.
- **Next 16 breaking changes:** before writing route/action/form code, read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` and `.../02-guides/server-actions.md`. Server Actions receive a `FormData`; forms use `<form action={fn}>`; `revalidatePath`/`redirect` come from `next/cache` and `next/navigation`.
- **Package manager:** `corepack pnpm ...` (pnpm not on PATH). `pnpm dev` is blocked by the sandbox inotify limit — verify with `corepack pnpm test`, `corepack pnpm exec tsc --noEmit`, and `corepack pnpm build`.
- **Open-source hygiene:** never commit `wrangler.toml`, `.dev.vars`, `.env*`, real IDs, or personal data.

## File Structure

- `src/lib/logbook/compute.ts` — pure derivations: `tripKm`, `tripsToLegs`, `filterTripsByFy`, `fyBusinessPct`. (+ `compute.test.ts`)
- `src/lib/logbook/parse.ts` — pure form/money parsers/validators: `dollarsToCents`, `centsToDollars`, `parseVehicleForm`, `parseTripForm`. (+ `parse.test.ts`)
- `src/lib/logbook/types.ts` — shared UI/data types: `TripRow`, `VehicleRow`, `ParseResult`, `ActionResult`.
- `src/db/client.ts` — `getDb()` Drizzle+D1 client.
- `cloudflare-env.d.ts` — ambient `CloudflareEnv` binding types.
- `next.config.ts` — add `initOpenNextCloudflareForDev()` (modify).
- `src/lib/data/vehicle.ts` — `getVehicle`, `upsertVehicle`.
- `src/lib/data/trip.ts` — `listTrips`, `createTrip`, `updateTrip`, `deleteTrip`.
- `src/lib/actions.ts` — `"use server"` actions wrapping data + parsers.
- `src/app/page.tsx` — dashboard (modify placeholder).
- `src/app/vehicle/page.tsx` — vehicle setup/edit.
- `src/app/trips/page.tsx` — trip log + FY switcher.
- `src/components/VehicleForm.tsx`, `TripForm.tsx`, `TripRow.tsx`, `FySwitcher.tsx`, `FieldError.tsx`.

---

### Task 1: Pure logbook logic (compute + parse)

**Files:**
- Create: `src/lib/logbook/types.ts`
- Create: `src/lib/logbook/compute.ts`, `src/lib/logbook/compute.test.ts`
- Create: `src/lib/logbook/parse.ts`, `src/lib/logbook/parse.test.ts`

**Interfaces:**
- Consumes: `businessPctRounded`, `financialYear` from `@/lib/tax`; `TripLeg` from `@/lib/tax/types`.
- Produces:
  - `type TripRow = { id: number; vehicleId: number; periodId: number | null; date: string; odoStart: number; odoEnd: number; purpose: string | null; isBusiness: boolean }`
  - `type VehicleRow = { id: number; make: string; model: string; rego: string | null; odoOpen: number | null; odoClose: number | null; purchaseDate: string | null; purchaseCostCents: number | null }`
  - `type ParseResult<T> = { ok: true; value: T } | { ok: false; fieldErrors: Record<string, string> }`
  - `type ActionResult = { ok: true } | { ok: false; error?: string; fieldErrors?: Record<string, string> }`
  - `tripKm(t: { odoStart: number; odoEnd: number }): number`
  - `tripsToLegs(trips: Pick<TripRow, "odoStart" | "odoEnd" | "isBusiness">[]): TripLeg[]`
  - `filterTripsByFy<T extends { date: string }>(trips: T[], fyLabel: string): T[]`
  - `fyBusinessPct(trips: Pick<TripRow, "date" | "odoStart" | "odoEnd" | "isBusiness">[], fyLabel: string): number`
  - `dollarsToCents(input: string): number` — throws `RangeError` on non-numeric/negative
  - `centsToDollars(cents: number): string` — e.g. `1250 → "12.50"`
  - `parseVehicleForm(fd: FormData): ParseResult<{ make: string; model: string; rego: string | null; odoOpen: number | null; purchaseDate: string | null; purchaseCostCents: number | null }>`
  - `parseTripForm(fd: FormData): ParseResult<{ date: string; odoStart: number; odoEnd: number; purpose: string | null; isBusiness: boolean }>`

- [ ] **Step 1: Write `src/lib/logbook/types.ts`**

```ts
import type { TripLeg } from "@/lib/tax/types";

export type TripRow = {
  id: number;
  vehicleId: number;
  periodId: number | null;
  date: string;
  odoStart: number;
  odoEnd: number;
  purpose: string | null;
  isBusiness: boolean;
};

export type VehicleRow = {
  id: number;
  make: string;
  model: string;
  rego: string | null;
  odoOpen: number | null;
  odoClose: number | null;
  purchaseDate: string | null;
  purchaseCostCents: number | null;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: Record<string, string> };

export type ActionResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export type { TripLeg };
```

- [ ] **Step 2: Write the failing test for compute**

`src/lib/logbook/compute.test.ts`:
```ts
import { expect, test } from "vitest";
import { tripKm, tripsToLegs, filterTripsByFy, fyBusinessPct } from "@/lib/logbook/compute";

test("tripKm is odoEnd - odoStart", () => {
  expect(tripKm({ odoStart: 50000, odoEnd: 50040 })).toBe(40);
});

test("tripsToLegs maps to {km,isBusiness}", () => {
  expect(
    tripsToLegs([
      { odoStart: 0, odoEnd: 40, isBusiness: true },
      { odoStart: 40, odoEnd: 60, isBusiness: false },
    ]),
  ).toEqual([
    { km: 40, isBusiness: true },
    { km: 20, isBusiness: false },
  ]);
});

test("filterTripsByFy keeps only trips in the FY", () => {
  const trips = [
    { date: "2024-07-02" }, // FY 2024-25
    { date: "2024-06-30" }, // FY 2023-24
    { date: "2025-06-30" }, // FY 2024-25
  ];
  expect(filterTripsByFy(trips, "2024-25")).toEqual([
    { date: "2024-07-02" },
    { date: "2025-06-30" },
  ]);
});

test("fyBusinessPct = rounded business% over FY trips", () => {
  const trips = [
    { date: "2024-07-02", odoStart: 0, odoEnd: 40, isBusiness: true },
    { date: "2024-07-03", odoStart: 40, odoEnd: 60, isBusiness: false },
    { date: "2023-07-03", odoStart: 0, odoEnd: 999, isBusiness: false }, // other FY, excluded
  ];
  expect(fyBusinessPct(trips, "2024-25")).toBe(67); // 40/60
});

test("fyBusinessPct with no FY trips is 0 (no divide-by-zero)", () => {
  expect(fyBusinessPct([], "2024-25")).toBe(0);
});
```

- [ ] **Step 3: Run compute test to verify it fails**

Run: `corepack pnpm test src/lib/logbook/compute.test.ts`
Expected: FAIL — cannot find module `compute`.

- [ ] **Step 4: Write `src/lib/logbook/compute.ts`**

```ts
import { businessPctRounded, financialYear } from "@/lib/tax";
import type { TripLeg, TripRow } from "@/lib/logbook/types";

export function tripKm(t: { odoStart: number; odoEnd: number }): number {
  return t.odoEnd - t.odoStart;
}

export function tripsToLegs(
  trips: Pick<TripRow, "odoStart" | "odoEnd" | "isBusiness">[],
): TripLeg[] {
  return trips.map((t) => ({ km: tripKm(t), isBusiness: t.isBusiness }));
}

export function filterTripsByFy<T extends { date: string }>(
  trips: T[],
  fyLabel: string,
): T[] {
  return trips.filter((t) => financialYear(t.date).label === fyLabel);
}

export function fyBusinessPct(
  trips: Pick<TripRow, "date" | "odoStart" | "odoEnd" | "isBusiness">[],
  fyLabel: string,
): number {
  return businessPctRounded(tripsToLegs(filterTripsByFy(trips, fyLabel)));
}
```

- [ ] **Step 5: Run compute test to verify it passes**

Run: `corepack pnpm test src/lib/logbook/compute.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing test for parse**

`src/lib/logbook/parse.test.ts`:
```ts
import { expect, test } from "vitest";
import { dollarsToCents, centsToDollars, parseVehicleForm, parseTripForm } from "@/lib/logbook/parse";

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.append(k, v);
  return f;
}

test("dollarsToCents rounds to nearest cent", () => {
  expect(dollarsToCents("12.50")).toBe(1250);
  expect(dollarsToCents("12")).toBe(1200);
  expect(dollarsToCents("12.505")).toBe(1251);
});

test("dollarsToCents rejects negative / non-numeric", () => {
  expect(() => dollarsToCents("-1")).toThrow(RangeError);
  expect(() => dollarsToCents("abc")).toThrow(RangeError);
});

test("centsToDollars formats", () => {
  expect(centsToDollars(1250)).toBe("12.50");
  expect(centsToDollars(0)).toBe("0.00");
});

test("parseVehicleForm ok with required fields", () => {
  const r = parseVehicleForm(fd({ make: "Toyota", model: "Corolla", rego: "ABC123", odoOpen: "50000" }));
  expect(r).toEqual({
    ok: true,
    value: { make: "Toyota", model: "Corolla", rego: "ABC123", odoOpen: 50000, purchaseDate: null, purchaseCostCents: null },
  });
});

test("parseVehicleForm errors when make/model missing", () => {
  const r = parseVehicleForm(fd({ make: "", model: "" }));
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.fieldErrors.make).toBeDefined();
    expect(r.fieldErrors.model).toBeDefined();
  }
});

test("parseTripForm ok computes nothing but validates odo order", () => {
  const r = parseTripForm(fd({ date: "2024-07-02", odoStart: "50000", odoEnd: "50040", purpose: "Client", isBusiness: "on" }));
  expect(r).toEqual({
    ok: true,
    value: { date: "2024-07-02", odoStart: 50000, odoEnd: 50040, purpose: "Client", isBusiness: true },
  });
});

test("parseTripForm errors when odoEnd <= odoStart", () => {
  const r = parseTripForm(fd({ date: "2024-07-02", odoStart: "50040", odoEnd: "50040", isBusiness: "" }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.fieldErrors.odoEnd).toBeDefined();
});

test("parseTripForm errors when date missing", () => {
  const r = parseTripForm(fd({ date: "", odoStart: "1", odoEnd: "2" }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.fieldErrors.date).toBeDefined();
});
```

- [ ] **Step 7: Run parse test to verify it fails**

Run: `corepack pnpm test src/lib/logbook/parse.test.ts`
Expected: FAIL — cannot find module `parse`.

- [ ] **Step 8: Write `src/lib/logbook/parse.ts`**

```ts
import type { ParseResult } from "@/lib/logbook/types";

export function dollarsToCents(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`Invalid dollar amount: ${input}`);
  return Math.round(n * 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}

function optInt(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

export function parseVehicleForm(
  fd: FormData,
): ParseResult<{
  make: string;
  model: string;
  rego: string | null;
  odoOpen: number | null;
  purchaseDate: string | null;
  purchaseCostCents: number | null;
}> {
  const errors: Record<string, string> = {};
  const make = str(fd, "make");
  const model = str(fd, "model");
  const rego = str(fd, "rego") || null;
  if (!make) errors.make = "Make is required.";
  if (!model) errors.model = "Model is required.";

  const odoOpenRaw = str(fd, "odoOpen");
  const odoOpen = optInt(odoOpenRaw);
  if (Number.isNaN(odoOpen) || (odoOpen !== null && odoOpen < 0)) errors.odoOpen = "Odometer must be a whole number ≥ 0.";

  const purchaseDate = str(fd, "purchaseDate") || null;
  const costRaw = str(fd, "purchaseCost");
  let purchaseCostCents: number | null = null;
  if (costRaw !== "") {
    try {
      purchaseCostCents = dollarsToCents(costRaw);
    } catch {
      errors.purchaseCost = "Enter a valid dollar amount.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { make, model, rego, odoOpen: odoOpen ?? null, purchaseDate, purchaseCostCents },
  };
}

export function parseTripForm(
  fd: FormData,
): ParseResult<{ date: string; odoStart: number; odoEnd: number; purpose: string | null; isBusiness: boolean }> {
  const errors: Record<string, string> = {};
  const date = str(fd, "date");
  if (!date) errors.date = "Date is required.";

  const odoStart = optInt(str(fd, "odoStart"));
  const odoEnd = optInt(str(fd, "odoEnd"));
  if (odoStart === null || Number.isNaN(odoStart) || odoStart < 0) errors.odoStart = "Start odometer must be a whole number ≥ 0.";
  if (odoEnd === null || Number.isNaN(odoEnd) || odoEnd < 0) errors.odoEnd = "End odometer must be a whole number ≥ 0.";
  if (!errors.odoStart && !errors.odoEnd && (odoEnd as number) <= (odoStart as number)) {
    errors.odoEnd = "End odometer must be greater than start.";
  }

  const purpose = str(fd, "purpose") || null;
  const isBusiness = str(fd, "isBusiness") === "on";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { date, odoStart: odoStart as number, odoEnd: odoEnd as number, purpose, isBusiness } };
}
```

- [ ] **Step 9: Run parse test to verify it passes**

Run: `corepack pnpm test src/lib/logbook/parse.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 10: Run full suite + typecheck**

Run: `corepack pnpm test && corepack pnpm exec tsc --noEmit`
Expected: all suites green, no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/logbook/
git commit -m "feat(logbook): pure trip/FY compute + form parsers with tests"
```

---

### Task 2: DB access plumbing (env types, dev binding, client, data layer)

**Files:**
- Create: `cloudflare-env.d.ts`
- Modify: `next.config.ts`
- Create: `src/db/client.ts`
- Create: `src/lib/data/vehicle.ts`
- Create: `src/lib/data/trip.ts`

**Interfaces:**
- Consumes: schema tables from `@/db/schema`; `TripRow`, `VehicleRow` from `@/lib/logbook/types`.
- Produces:
  - `getDb(): Promise<DrizzleD1Database<typeof schema>>`
  - `getVehicle(): Promise<VehicleRow | null>`
  - `upsertVehicle(input: { make: string; model: string; rego: string | null; odoOpen: number | null; purchaseDate: string | null; purchaseCostCents: number | null }): Promise<void>`
  - `listTrips(): Promise<TripRow[]>` — all trips, newest date first
  - `createTrip(input: { date: string; odoStart: number; odoEnd: number; purpose: string | null; isBusiness: boolean }): Promise<void>`
  - `updateTrip(id: number, input: { date: string; odoStart: number; odoEnd: number; purpose: string | null; isBusiness: boolean }): Promise<void>`
  - `deleteTrip(id: number): Promise<void>`

> No unit tests: these are the I/O boundary. Verification is `tsc --noEmit` (types) + `corepack pnpm build`.

- [ ] **Step 1: Write `cloudflare-env.d.ts`**

```ts
/// <reference types="@cloudflare/workers-types" />

// Ambient binding types for getCloudflareContext().env.
// Add R2 (RECEIPTS) and AI bindings in their own slices when first used.
interface CloudflareEnv {
  DB: D1Database;
}
```

- [ ] **Step 2: Add dev binding to `next.config.ts`**

Replace the file contents with:
```ts
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Wires the local D1/R2 bindings into `next dev` via the OpenNext adapter.
initOpenNextCloudflareForDev();
```

- [ ] **Step 3: Write `src/db/client.ts`**

```ts
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";

export async function getDb(): Promise<DrizzleD1Database<typeof schema>> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}
```

- [ ] **Step 4: Write `src/lib/data/vehicle.ts`**

```ts
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vehicle } from "@/db/schema";
import type { VehicleRow } from "@/lib/logbook/types";

export async function getVehicle(): Promise<VehicleRow | null> {
  const db = await getDb();
  const rows = await db.select().from(vehicle).limit(1);
  return rows[0] ?? null;
}

export async function upsertVehicle(input: {
  make: string;
  model: string;
  rego: string | null;
  odoOpen: number | null;
  purchaseDate: string | null;
  purchaseCostCents: number | null;
}): Promise<void> {
  const db = await getDb();
  const existing = await getVehicle();
  if (existing) {
    await db.update(vehicle).set(input).where(eq(vehicle.id, existing.id));
  } else {
    await db.insert(vehicle).values(input);
  }
}
```

- [ ] **Step 5: Write `src/lib/data/trip.ts`**

```ts
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { trip, vehicle } from "@/db/schema";
import type { TripRow } from "@/lib/logbook/types";

type TripInput = {
  date: string;
  odoStart: number;
  odoEnd: number;
  purpose: string | null;
  isBusiness: boolean;
};

async function currentVehicleId(): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select({ id: vehicle.id }).from(vehicle).limit(1);
  return rows[0]?.id ?? null;
}

export async function listTrips(): Promise<TripRow[]> {
  const db = await getDb();
  return db.select().from(trip).orderBy(desc(trip.date));
}

export async function createTrip(input: TripInput): Promise<void> {
  const vehicleId = await currentVehicleId();
  if (vehicleId === null) throw new Error("No vehicle set up yet.");
  const db = await getDb();
  await db.insert(trip).values({ ...input, vehicleId });
}

export async function updateTrip(id: number, input: TripInput): Promise<void> {
  const db = await getDb();
  await db.update(trip).set(input).where(eq(trip.id, id));
}

export async function deleteTrip(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(trip).where(eq(trip.id, id));
}
```

- [ ] **Step 6: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: no errors. (If `DrizzleD1Database` generic mismatches `VehicleRow`/`TripRow`, confirm the schema column names match the row types in `types.ts`.)

- [ ] **Step 7: Commit**

```bash
git add cloudflare-env.d.ts next.config.ts src/db/client.ts src/lib/data/
git commit -m "feat(db): D1 Drizzle client + vehicle/trip data layer"
```

---

### Task 3: Server actions + vehicle UI + dashboard

**Files:**
- Create: `src/lib/actions.ts`
- Create: `src/components/FieldError.tsx`
- Create: `src/components/VehicleForm.tsx`
- Create: `src/app/vehicle/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: data fns (Task 2), parsers (Task 1), `getVehicle`, `fyBusinessPct`, `financialYear`.
- Produces:
  - `saveVehicleAction(prev: ActionResult, fd: FormData): Promise<ActionResult>`
  - `createTripAction(prev: ActionResult, fd: FormData): Promise<ActionResult>` (used in Task 4)
  - `updateTripAction(id: number, prev: ActionResult, fd: FormData): Promise<ActionResult>` (used in Task 4)
  - `deleteTripAction(fd: FormData): Promise<void>` (used in Task 4)

- [ ] **Step 1: Write `src/lib/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { parseVehicleForm, parseTripForm } from "@/lib/logbook/parse";
import { upsertVehicle } from "@/lib/data/vehicle";
import { createTrip, updateTrip, deleteTrip } from "@/lib/data/trip";
import type { ActionResult } from "@/lib/logbook/types";

export async function saveVehicleAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseVehicleForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  await upsertVehicle(parsed.value);
  revalidatePath("/");
  revalidatePath("/vehicle");
  return { ok: true };
}

export async function createTripAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  await createTrip(parsed.value);
  revalidatePath("/trips");
  revalidatePath("/");
  return { ok: true };
}

export async function updateTripAction(id: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  await updateTrip(id, parsed.value);
  revalidatePath("/trips");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTripAction(fd: FormData): Promise<void> {
  const id = Number(fd.get("id"));
  if (Number.isInteger(id)) {
    await deleteTrip(id);
    revalidatePath("/trips");
    revalidatePath("/");
  }
}
```

- [ ] **Step 2: Write `src/components/FieldError.tsx`**

```tsx
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}
```

- [ ] **Step 3: Write `src/components/VehicleForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { saveVehicleAction } from "@/lib/actions";
import { FieldError } from "@/components/FieldError";
import { centsToDollars } from "@/lib/logbook/parse";
import type { ActionResult, VehicleRow } from "@/lib/logbook/types";

const initial: ActionResult = { ok: true };

export function VehicleForm({ vehicle }: { vehicle: VehicleRow | null }) {
  const [state, action, pending] = useActionState(saveVehicleAction, initial);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form action={action} className="flex flex-col gap-4 max-w-md">
      <label className="flex flex-col gap-1">
        <span>Make</span>
        <input name="make" defaultValue={vehicle?.make ?? ""} className="border rounded px-2 py-1" />
        <FieldError message={errs.make} />
      </label>
      <label className="flex flex-col gap-1">
        <span>Model</span>
        <input name="model" defaultValue={vehicle?.model ?? ""} className="border rounded px-2 py-1" />
        <FieldError message={errs.model} />
      </label>
      <label className="flex flex-col gap-1">
        <span>Rego</span>
        <input name="rego" defaultValue={vehicle?.rego ?? ""} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span>Opening odometer (km)</span>
        <input name="odoOpen" type="number" min="0" defaultValue={vehicle?.odoOpen ?? ""} className="border rounded px-2 py-1" />
        <FieldError message={errs.odoOpen} />
      </label>
      <label className="flex flex-col gap-1">
        <span>Purchase date (optional)</span>
        <input name="purchaseDate" type="date" defaultValue={vehicle?.purchaseDate ?? ""} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span>Purchase cost $ (optional)</span>
        <input
          name="purchaseCost"
          type="text"
          inputMode="decimal"
          defaultValue={vehicle?.purchaseCostCents != null ? centsToDollars(vehicle.purchaseCostCents) : ""}
          className="border rounded px-2 py-1"
        />
        <FieldError message={errs.purchaseCost} />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Saving…" : "Save vehicle"}
      </button>
      {state.ok && !pending ? <p className="text-sm text-green-600">Saved.</p> : null}
    </form>
  );
}
```

- [ ] **Step 4: Write `src/app/vehicle/page.tsx`**

```tsx
import { getVehicle } from "@/lib/data/vehicle";
import { VehicleForm } from "@/components/VehicleForm";

export const dynamic = "force-dynamic";

export default async function VehiclePage() {
  const vehicle = await getVehicle();
  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">{vehicle ? "Edit vehicle" : "Set up your car"}</h1>
      <VehicleForm vehicle={vehicle} />
    </main>
  );
}
```

- [ ] **Step 5: Replace `src/app/page.tsx` with the dashboard**

```tsx
import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { fyBusinessPct } from "@/lib/logbook/compute";
import { financialYear } from "@/lib/tax";

export const dynamic = "force-dynamic";

export default async function Home() {
  const vehicle = await getVehicle();

  if (!vehicle) {
    return (
      <main className="w-full max-w-3xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-semibold mb-4">Ginoo&apos;s Log Book</h1>
        <p className="mb-6 text-zinc-600">No car set up yet.</p>
        <Link href="/vehicle" className="rounded bg-black text-white px-4 py-2">Set up your car</Link>
      </main>
    );
  }

  const trips = await listTrips();
  const fyLabel = financialYear(new Date().toISOString().slice(0, 10)).label;
  const pct = fyBusinessPct(trips, fyLabel);

  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-semibold mb-6">Ginoo&apos;s Log Book</h1>
      <section className="rounded border p-4 mb-6">
        <h2 className="font-medium">{vehicle.make} {vehicle.model} {vehicle.rego ? `· ${vehicle.rego}` : ""}</h2>
        <p className="text-sm text-zinc-600">Opening odometer: {vehicle.odoOpen ?? "—"} km</p>
        <Link href="/vehicle" className="text-sm underline">Edit vehicle</Link>
      </section>
      <section className="rounded border p-4 mb-6">
        <p className="text-sm text-zinc-600">Business use — FY {fyLabel}</p>
        <p className="text-4xl font-semibold">{pct}%</p>
      </section>
      <Link href="/trips" className="rounded bg-black text-white px-4 py-2">Manage trips</Link>
    </main>
  );
}
```

- [ ] **Step 6: Typecheck + build**

Run: `corepack pnpm exec tsc --noEmit && corepack pnpm build`
Expected: no type errors; build succeeds (routes `/` and `/vehicle` compile as dynamic).

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions.ts src/components/FieldError.tsx src/components/VehicleForm.tsx src/app/vehicle/page.tsx src/app/page.tsx
git commit -m "feat(vehicle): vehicle setup form + dashboard with live FY business%"
```

---

### Task 4: Trip log UI (list, add, edit, delete) with FY switcher

**Files:**
- Create: `src/components/FySwitcher.tsx`
- Create: `src/components/TripForm.tsx`
- Create: `src/components/TripRow.tsx`
- Create: `src/app/trips/page.tsx`

**Interfaces:**
- Consumes: `listTrips`, `getVehicle` (Task 2); `createTripAction`, `updateTripAction`, `deleteTripAction` (Task 3); `filterTripsByFy`, `fyBusinessPct`, `tripKm` (Task 1); `financialYear` (`@/lib/tax`).
- Produces: the `/trips` route. No new exported functions consumed by later tasks.

- [ ] **Step 1: Write `src/components/FySwitcher.tsx`**

```tsx
import Link from "next/link";

export function FySwitcher({ fyLabels, active }: { fyLabels: string[]; active: string }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {fyLabels.map((label) => (
        <Link
          key={label}
          href={`/trips?fy=${label}`}
          className={`rounded px-3 py-1 text-sm border ${label === active ? "bg-black text-white" : ""}`}
        >
          FY {label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/TripForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { createTripAction } from "@/lib/actions";
import { FieldError } from "@/components/FieldError";
import type { ActionResult } from "@/lib/logbook/types";

const initial: ActionResult = { ok: true };

export function TripForm() {
  const [state, action, pending] = useActionState(createTripAction, initial);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border rounded p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Date</span>
        <input name="date" type="date" className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Odo start</span>
        <input name="odoStart" type="number" min="0" className="border rounded px-2 py-1 w-28" />
        <FieldError message={errs.odoStart} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Odo end</span>
        <input name="odoEnd" type="number" min="0" className="border rounded px-2 py-1 w-28" />
        <FieldError message={errs.odoEnd} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Purpose</span>
        <input name="purpose" className="border rounded px-2 py-1" />
      </label>
      <label className="flex items-center gap-2">
        <input name="isBusiness" type="checkbox" />
        <span className="text-sm">Business</span>
      </label>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Adding…" : "Add trip"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write `src/components/TripRow.tsx`**

```tsx
import { deleteTripAction } from "@/lib/actions";
import { tripKm } from "@/lib/logbook/compute";
import type { TripRow as TripRowType } from "@/lib/logbook/types";

export function TripRow({ trip }: { trip: TripRowType }) {
  return (
    <tr className="border-b">
      <td className="py-2 pr-4">{trip.date}</td>
      <td className="py-2 pr-4">{tripKm(trip)} km</td>
      <td className="py-2 pr-4">{trip.isBusiness ? "Business" : "Private"}</td>
      <td className="py-2 pr-4">{trip.purpose ?? ""}</td>
      <td className="py-2">
        <form action={deleteTripAction}>
          <input type="hidden" name="id" value={trip.id} />
          <button type="submit" className="text-sm text-red-600 underline">Delete</button>
        </form>
      </td>
    </tr>
  );
}
```

> Row-level *edit* is deferred to keep this task focused; `updateTripAction` exists and will be wired to an edit form in the next slice. Delete + add cover the core loop. (If you prefer inline edit now, add a client `TripEditRow` mirroring `TripForm` bound to `updateTripAction.bind(null, trip.id)` — optional, not required for this task's deliverable.)

- [ ] **Step 4: Write `src/app/trips/page.tsx`**

```tsx
import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { filterTripsByFy, fyBusinessPct } from "@/lib/logbook/compute";
import { financialYear } from "@/lib/tax";
import { FySwitcher } from "@/components/FySwitcher";
import { TripForm } from "@/components/TripForm";
import { TripRow } from "@/components/TripRow";

export const dynamic = "force-dynamic";

export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  const vehicle = await getVehicle();
  if (!vehicle) {
    return (
      <main className="w-full max-w-3xl mx-auto p-8 text-center">
        <p className="mb-4 text-zinc-600">Set up your car first.</p>
        <Link href="/vehicle" className="rounded bg-black text-white px-4 py-2">Set up your car</Link>
      </main>
    );
  }

  const trips = await listTrips();
  const currentFy = financialYear(new Date().toISOString().slice(0, 10)).label;
  const sp = await searchParams;
  const activeFy = typeof sp.fy === "string" ? sp.fy : currentFy;

  const fyLabels = Array.from(new Set([currentFy, ...trips.map((t) => financialYear(t.date).label)])).sort().reverse();
  const fyTrips = filterTripsByFy(trips, activeFy);
  const pct = fyBusinessPct(trips, activeFy);

  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <Link href="/" className="text-sm underline">Dashboard</Link>
      </div>
      <FySwitcher fyLabels={fyLabels} active={activeFy} />
      <p className="my-4 text-sm text-zinc-600">Business use — FY {activeFy}: <span className="font-semibold">{pct}%</span></p>
      <TripForm />
      {fyTrips.length === 0 ? (
        <p className="mt-6 text-zinc-600">No trips in FY {activeFy} yet.</p>
      ) : (
        <table className="mt-6 w-full text-left">
          <thead>
            <tr className="border-b text-sm text-zinc-500">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Distance</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Purpose</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fyTrips.map((t) => <TripRow key={t.id} trip={t} />)}
          </tbody>
        </table>
      )}
    </main>
  );
}
```

> **Next 16 note:** `PageProps<"/trips">` types `searchParams` as a `Promise` — it must be `await`ed (as above). Confirm the exact `PageProps` shape in `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` if the type mismatches.

- [ ] **Step 5: Typecheck + build**

Run: `corepack pnpm exec tsc --noEmit && corepack pnpm build`
Expected: no type errors; `/trips` compiles as dynamic.

- [ ] **Step 6: Commit**

```bash
git add src/components/FySwitcher.tsx src/components/TripForm.tsx src/components/TripRow.tsx src/app/trips/page.tsx
git commit -m "feat(trips): trip log with add/delete, FY switcher, live business%"
```

---

## Verification (whole plan)

- `corepack pnpm test` → all suites green, including `src/lib/logbook/compute.test.ts` (5) and `parse.test.ts` (8).
- `corepack pnpm exec tsc --noEmit` → no type errors.
- `corepack pnpm build` → succeeds; `/`, `/vehicle`, `/trips` are dynamic (no prerender call to `getCloudflareContext`).
- Manual (optional, run by user — `pnpm dev` blocked in sandbox): `corepack pnpm dev`, apply local D1 (`corepack pnpm db:local`), visit `/vehicle` → save car → `/trips` → add a business + a private trip → dashboard shows a non-zero FY business%.
- `git ls-files | grep -E 'wrangler.toml$|\.dev\.vars|\.env$'` → empty (no secrets committed).

## Out of Scope (later slices)

Logbook period grouping/CRUD, inline trip editing UI, expenses capture + OCR + R2, reports (BAS/annual/export), Cloudflare Access auth, PWA polish, release infra.

## Self-Review Notes

- **Spec coverage:** vehicle setup/edit (Task 3), trip add/delete + list per FY (Task 4), live FY business% (Tasks 3–4 via `fyBusinessPct`), data-access + server-action pattern (Tasks 2–3), pure-logic unit tests (Task 1). Period UI intentionally deferred per spec.
- **Money/dates:** dollars↔cents only at edges (`dollarsToCents`/`centsToDollars`); cents in DB/actions; ISO date text throughout. Matches global constraints.
- **Type consistency:** `TripRow`/`VehicleRow`/`ActionResult`/`ParseResult` defined once in `types.ts`; data fns return those exact shapes; actions consume `parse*` results and return `ActionResult`; `fyBusinessPct` signature identical in producer (Task 1) and consumers (Tasks 3–4).
- **Known risk:** `PageProps`/`searchParams` and `DrizzleD1Database` generics are the two spots most likely to need a doc check against the installed Next 16 / drizzle versions — flagged inline at each use.
- **Deferred within-scope item:** inline trip *edit* UI deferred (delete+add cover the core loop); `updateTripAction` is built and ready to wire, noted in Task 4 Step 3.
