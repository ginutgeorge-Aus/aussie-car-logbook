# Expenses & Receipts (Slice 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture car expenses with optional receipt photos, track GST per receipt, and show a live current-FY tax summary.

**Architecture:** Follows the slice-2 pattern chain — pure parser (unit-tested) → Drizzle data layer → server actions (`ActionResult`) → server page + client form/row. Adds an R2 wrapper for receipt images and a Next route handler that streams them back. Category is stored as the existing `ExpenseCategory` code so `gstCredit`/`annualDeduction` consume rows directly.

**Tech Stack:** Next.js 16 (App Router), Cloudflare D1 + R2 via `@opennextjs/cloudflare`, Drizzle ORM, Vitest, Tailwind v4.

## Global Constraints

- Package manager: **pnpm via corepack** — all commands are `corepack pnpm ...` (pnpm not on PATH).
- Money is **integer cents** in DB + tax/logic; dollars only at the UI edge (`dollarsToCents`/`centsToDollars`).
- Dates are ISO `YYYY-MM-DD` text. AU FY = 1 Jul–30 Jun.
- Category is stored as an `ExpenseCategory` **code** (from `src/lib/tax/types.ts`), never a display label.
- GST authoritative server-side: `gstFromInclusive(cents)`; clamp `0 ≤ gst ≤ amountInclCents`.
- Repo is public: no secrets/IDs/personal data/receipt images committed.
- `pnpm dev` is blocked by the sandbox inotify limit → the gate for non-unit-testable tasks is `corepack pnpm exec tsc --noEmit` + `corepack pnpm build`.
- **No new migration** — the `expense` table already has all needed columns. Do not touch `ocrRaw` (slice 3b).

---

### Task 1: Category constant + expense form parser (pure, unit-tested)

**Files:**
- Create: `src/lib/expenses/categories.ts`
- Create: `src/lib/expenses/parse.ts`
- Test: `src/lib/expenses/parse.test.ts`

**Interfaces:**
- Consumes: `dollarsToCents` from `src/lib/logbook/parse.ts`; `gstFromInclusive` from `src/lib/tax`; `ExpenseCategory` from `src/lib/tax/types.ts`; `ParseResult` from `src/lib/logbook/types.ts`.
- Produces:
  - `EXPENSE_CATEGORIES: ReadonlyArray<{ code: ExpenseCategory; label: string }>`
  - `isExpenseCategory(v: string): v is ExpenseCategory`
  - `ExpenseInput = { date: string; category: ExpenseCategory; amountInclCents: number; gstCents: number; vendor: string | null; notes: string | null }`
  - `parseExpenseForm(fd: FormData): ParseResult<ExpenseInput>`

- [ ] **Step 1: Write the category constant**

`src/lib/expenses/categories.ts`:

```ts
import type { ExpenseCategory } from "@/lib/tax/types";

// Display order + labels for the expense form dropdown.
// `code` is the value stored in DB (an ExpenseCategory). "depreciation" is
// computed, not user-entered, so it is intentionally omitted here.
export const EXPENSE_CATEGORIES = [
  { code: "fuel", label: "Fuel" },
  { code: "rego", label: "Registration" },
  { code: "insurance", label: "Insurance" },
  { code: "service", label: "Servicing" },
  { code: "repairs", label: "Repairs" },
  { code: "tyres", label: "Tyres" },
  { code: "interest", label: "Interest" },
  { code: "lease", label: "Lease" },
  { code: "other", label: "Other" },
] as const satisfies ReadonlyArray<{ code: ExpenseCategory; label: string }>;

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return EXPENSE_CATEGORIES.some((c) => c.code === v);
}
```

- [ ] **Step 2: Write the failing parser test**

`src/lib/expenses/parse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseExpenseForm } from "@/lib/expenses/parse";

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const base = { date: "2026-08-01", category: "fuel", amountIncl: "110.00" };

describe("parseExpenseForm", () => {
  it("parses a valid expense and defaults GST to amount/11", () => {
    const r = parseExpenseForm(fd(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      date: "2026-08-01",
      category: "fuel",
      amountInclCents: 11000,
      gstCents: 1000, // round(11000/11)
      vendor: null,
      notes: null,
    });
  });

  it("uses an explicit GST when provided and clamps it to the amount", () => {
    expect((parseExpenseForm(fd({ ...base, gst: "5.00" })) as { value: { gstCents: number } }).value.gstCents).toBe(500);
    expect((parseExpenseForm(fd({ ...base, gst: "999.00" })) as { value: { gstCents: number } }).value.gstCents).toBe(11000);
  });

  it("zeroes GST when gstFree is checked, ignoring any typed GST", () => {
    const r = parseExpenseForm(fd({ ...base, gst: "9.00", gstFree: "on" }));
    expect((r as { value: { gstCents: number } }).value.gstCents).toBe(0);
  });

  it("trims vendor/notes and nulls them when blank", () => {
    const r = parseExpenseForm(fd({ ...base, vendor: "  BP  ", notes: "" }));
    expect((r as { value: { vendor: string | null; notes: string | null } }).value).toMatchObject({ vendor: "BP", notes: null });
  });

  it("rejects a missing date", () => {
    const r = parseExpenseForm(fd({ ...base, date: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.date).toBeTruthy();
  });

  it("rejects an unknown category", () => {
    const r = parseExpenseForm(fd({ ...base, category: "boat" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.category).toBeTruthy();
  });

  it("rejects a non-positive amount", () => {
    const r = parseExpenseForm(fd({ ...base, amountIncl: "0" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.amountIncl).toBeTruthy();
  });

  it("rejects a negative GST", () => {
    const r = parseExpenseForm(fd({ ...base, gst: "-1" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.gst).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `corepack pnpm test src/lib/expenses/parse.test.ts`
Expected: FAIL — cannot resolve `@/lib/expenses/parse`.

- [ ] **Step 4: Write the parser**

`src/lib/expenses/parse.ts`:

```ts
import { dollarsToCents } from "@/lib/logbook/parse";
import { gstFromInclusive } from "@/lib/tax";
import { isExpenseCategory } from "@/lib/expenses/categories";
import type { ExpenseCategory } from "@/lib/tax/types";
import type { ParseResult } from "@/lib/logbook/types";

export type ExpenseInput = {
  date: string;
  category: ExpenseCategory;
  amountInclCents: number;
  gstCents: number;
  vendor: string | null;
  notes: string | null;
};

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}

export function parseExpenseForm(fd: FormData): ParseResult<ExpenseInput> {
  const errors: Record<string, string> = {};

  const date = str(fd, "date");
  if (!date) errors.date = "Date is required.";

  const category = str(fd, "category");
  if (!isExpenseCategory(category)) errors.category = "Choose a category.";

  let amountInclCents = 0;
  const amountRaw = str(fd, "amountIncl");
  try {
    amountInclCents = dollarsToCents(amountRaw);
    if (amountInclCents <= 0) errors.amountIncl = "Amount must be greater than 0.";
  } catch {
    errors.amountIncl = "Enter a valid dollar amount.";
  }

  const gstFree = str(fd, "gstFree") === "on";
  let gstCents = 0;
  const gstRaw = str(fd, "gst");
  if (!gstFree) {
    if (gstRaw === "") {
      gstCents = gstFromInclusive(amountInclCents);
    } else {
      try {
        gstCents = dollarsToCents(gstRaw);
      } catch {
        errors.gst = "Enter a valid GST amount.";
      }
    }
    if (!errors.gst && !errors.amountIncl) {
      if (gstCents < 0) errors.gst = "GST cannot be negative.";
      else if (gstCents > amountInclCents) gstCents = amountInclCents; // clamp
    }
  }

  const vendor = str(fd, "vendor") || null;
  const notes = str(fd, "notes") || null;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { date, category: category as ExpenseCategory, amountInclCents, gstCents, vendor, notes },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `corepack pnpm test src/lib/expenses/parse.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/expenses/categories.ts src/lib/expenses/parse.ts src/lib/expenses/parse.test.ts
git commit -m "feat(expenses): category constant + expense form parser"
```

---

### Task 2: R2 receipt wrapper

**Files:**
- Create: `src/lib/data/receipts.ts`
- Modify: `cloudflare-env.d.ts`

**Interfaces:**
- Consumes: `getCloudflareContext` from `@opennextjs/cloudflare`.
- Produces:
  - `putReceipt(vehicleId: number, file: File): Promise<string>` (returns the R2 key)
  - `getReceipt(key: string): Promise<R2ObjectBody | null>`
  - `deleteReceipt(key: string): Promise<void>`

> Not unit-testable (needs a live R2 binding). Gate = `tsc --noEmit` + `build`.

- [ ] **Step 1: Add the RECEIPTS binding type**

Modify `cloudflare-env.d.ts` — add `RECEIPTS` to the interface:

```ts
/// <reference types="@cloudflare/workers-types" />

// Ambient binding types for getCloudflareContext().env.
// Add the AI binding in slice 3b when OCR lands.
interface CloudflareEnv {
  DB: D1Database;
  RECEIPTS: R2Bucket;
}
```

- [ ] **Step 2: Write the R2 wrapper**

`src/lib/data/receipts.ts`:

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function bucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.RECEIPTS;
}

function extFromType(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  return "bin";
}

export async function putReceipt(vehicleId: number, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Receipt must be an image.");
  if (file.size > MAX_BYTES) throw new Error("Receipt image is too large (max 10 MB).");
  const key = `receipts/${vehicleId}/${crypto.randomUUID()}.${extFromType(file.type)}`;
  const b = await bucket();
  await b.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return key;
}

export async function getReceipt(key: string): Promise<R2ObjectBody | null> {
  const b = await bucket();
  return b.get(key);
}

export async function deleteReceipt(key: string): Promise<void> {
  if (!key) return;
  const b = await bucket();
  await b.delete(key);
}
```

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/receipts.ts cloudflare-env.d.ts
git commit -m "feat(expenses): R2 receipt wrapper + RECEIPTS binding type"
```

---

### Task 3: Expense data layer

**Files:**
- Create: `src/lib/data/expense.ts`

**Interfaces:**
- Consumes: `getDb` from `src/db/client.ts`; `expense`, `vehicle` from `src/db/schema.ts`; `ExpenseInput` from `src/lib/expenses/parse.ts`; `deleteReceipt` from `src/lib/data/receipts.ts`.
- Produces:
  - `ExpenseRow` type (full row shape)
  - `listExpenses(): Promise<ExpenseRow[]>`
  - `createExpense(input: ExpenseInput, receiptKey: string | null): Promise<void>`
  - `updateExpense(id: number, input: ExpenseInput, receiptKey?: string | null): Promise<void>`
  - `deleteExpense(id: number): Promise<void>`

> Not unit-testable (needs live D1). Gate = `tsc --noEmit` + `build`.

- [ ] **Step 1: Write the data layer**

`src/lib/data/expense.ts`:

```ts
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { expense, vehicle } from "@/db/schema";
import { deleteReceipt } from "@/lib/data/receipts";
import type { ExpenseInput } from "@/lib/expenses/parse";

export type ExpenseRow = typeof expense.$inferSelect;

async function currentVehicleId(): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select({ id: vehicle.id }).from(vehicle).limit(1);
  return rows[0]?.id ?? null;
}

export async function listExpenses(): Promise<ExpenseRow[]> {
  const db = await getDb();
  return db.select().from(expense).orderBy(desc(expense.date));
}

export async function createExpense(input: ExpenseInput, receiptKey: string | null): Promise<void> {
  const vehicleId = await currentVehicleId();
  if (vehicleId === null) throw new Error("No vehicle set up yet.");
  const db = await getDb();
  await db.insert(expense).values({ ...input, vehicleId, receiptKey });
}

export async function updateExpense(
  id: number,
  input: ExpenseInput,
  receiptKey?: string | null,
): Promise<void> {
  const db = await getDb();
  // Only overwrite receiptKey when a value is passed (undefined = keep existing).
  const values = receiptKey === undefined ? input : { ...input, receiptKey };
  await db.update(expense).set(values).where(eq(expense.id, id));
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ receiptKey: expense.receiptKey }).from(expense).where(eq(expense.id, id)).limit(1);
  await db.delete(expense).where(eq(expense.id, id));
  const key = rows[0]?.receiptKey;
  if (key) await deleteReceipt(key);
}
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/expense.ts
git commit -m "feat(expenses): expense data layer (list/create/update/delete)"
```

---

### Task 4: Receipt streaming route

**Files:**
- Create: `src/app/receipt/[...key]/route.ts`

**Interfaces:**
- Consumes: `getReceipt` from `src/lib/data/receipts.ts`.
- Produces: `GET` handler serving R2 image bytes at `/receipt/<key>`.

> Not unit-testable (needs live R2). Gate = `tsc --noEmit` + `build`.

- [ ] **Step 1: Write the route handler**

`src/app/receipt/[...key]/route.ts`:

```ts
import { getReceipt } from "@/lib/data/receipts";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/receipt/[...key]">) {
  const { key } = await ctx.params;
  const object = await getReceipt(key.join("/"));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
```

- [ ] **Step 2: Typecheck + build**

Run: `corepack pnpm exec tsc --noEmit && corepack pnpm build`
Expected: no errors; `/receipt/[...key]` appears as a dynamic route.

> If the `RouteContext` generic name differs in this Next version, check `node_modules/next/dist/build/templates/app-route.ts` or a sibling route's type; fall back to `{ params }: { params: Promise<{ key: string[] }> }`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/receipt/[...key]/route.ts"
git commit -m "feat(expenses): R2 receipt streaming route"
```

---

### Task 5: Expense server actions

**Files:**
- Modify: `src/lib/actions.ts`

**Interfaces:**
- Consumes: `parseExpenseForm` (Task 1); `putReceipt` (Task 2); `createExpense`, `updateExpense`, `deleteExpense` (Task 3); `ActionResult` from `src/lib/logbook/types.ts`.
- Produces:
  - `createExpenseAction(_prev: ActionResult, fd: FormData): Promise<ActionResult>`
  - `updateExpenseAction(id: number, _prev: ActionResult, fd: FormData): Promise<ActionResult>`
  - `deleteExpenseAction(fd: FormData): Promise<void>`

- [ ] **Step 1: Add imports at the top of `src/lib/actions.ts`**

```ts
import { parseExpenseForm } from "@/lib/expenses/parse";
import { putReceipt } from "@/lib/data/receipts";
import { createExpense, updateExpense, deleteExpense } from "@/lib/data/expense";
import { getVehicle } from "@/lib/data/vehicle";
```

- [ ] **Step 2: Append the three actions to `src/lib/actions.ts`**

```ts
function fileFrom(fd: FormData): File | null {
  const f = fd.get("receipt");
  return f instanceof File && f.size > 0 ? f : null;
}

export async function createExpenseAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseExpenseForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    const file = fileFrom(fd);
    let receiptKey: string | null = null;
    if (file) {
      const vehicle = await getVehicle();
      if (!vehicle) return { ok: false, error: "No vehicle set up yet." };
      receiptKey = await putReceipt(vehicle.id, file);
    }
    await createExpense(parsed.value, receiptKey);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/expenses");
  revalidatePath("/");
  return { ok: true };
}

export async function updateExpenseAction(id: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseExpenseForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    const file = fileFrom(fd);
    let receiptKey: string | undefined = undefined; // undefined = keep existing
    if (file) {
      const vehicle = await getVehicle();
      if (!vehicle) return { ok: false, error: "No vehicle set up yet." };
      receiptKey = await putReceipt(vehicle.id, file);
    }
    await updateExpense(id, parsed.value, receiptKey);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/expenses");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteExpenseAction(fd: FormData): Promise<void> {
  const id = Number(fd.get("id"));
  if (Number.isInteger(id)) {
    await deleteExpense(id);
    revalidatePath("/expenses");
    revalidatePath("/");
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(expenses): create/update/delete expense server actions"
```

---

### Task 6: Expenses page + form + row

**Files:**
- Create: `src/components/ExpenseForm.tsx`
- Create: `src/components/ExpenseRow.tsx`
- Create: `src/app/expenses/page.tsx`

**Interfaces:**
- Consumes: `EXPENSE_CATEGORIES` (Task 1); `createExpenseAction`, `updateExpenseAction`, `deleteExpenseAction` (Task 5); `listExpenses`, `ExpenseRow` (Task 3); `getVehicle`; `centsToDollars` from `src/lib/logbook/parse.ts`; `todayIso` from `src/lib/today.ts`; `FieldError`.
- Produces: the `/expenses` route.

> UI depends on live bindings at runtime; gate = `tsc --noEmit` + `build`.

- [ ] **Step 1: Write the add form**

`src/components/ExpenseForm.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { createExpenseAction } from "@/lib/actions";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import { FieldError } from "@/components/FieldError";
import { todayIso } from "@/lib/today";
import type { ActionResult } from "@/lib/logbook/types";

const initial: ActionResult = { ok: true };

export function ExpenseForm() {
  const [state, action, pending] = useActionState(createExpenseAction, initial);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const [amount, setAmount] = useState("");
  const [gstFree, setGstFree] = useState(false);
  const autoGst = gstFree ? "0.00" : (Number(amount) > 0 ? (Number(amount) / 11).toFixed(2) : "");

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border rounded p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Date</span>
        <input name="date" type="date" defaultValue={todayIso()} className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Category</span>
        <select name="category" className="border rounded px-2 py-1">
          {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <FieldError message={errs.category} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Amount (incl GST)</span>
        <input name="amountIncl" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="border rounded px-2 py-1 w-32" />
        <FieldError message={errs.amountIncl} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">GST</span>
        <input name="gst" type="number" step="0.01" min="0" defaultValue="" placeholder={autoGst} disabled={gstFree} className="border rounded px-2 py-1 w-28" />
        <FieldError message={errs.gst} />
      </label>
      <label className="flex items-center gap-2">
        <input name="gstFree" type="checkbox" checked={gstFree} onChange={(e) => setGstFree(e.target.checked)} />
        <span className="text-sm">GST-free</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Vendor</span>
        <input name="vendor" className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Receipt</span>
        <input name="receipt" type="file" accept="image/*" capture="environment" className="text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Notes</span>
        <input name="notes" className="border rounded px-2 py-1" />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Adding…" : "Add expense"}
      </button>
      {!state.ok && state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
```

> The `placeholder={autoGst}` shows the live amount/11 hint; leaving GST blank makes the server default it (Task 1). This keeps the field editable without fighting controlled/uncontrolled state.

- [ ] **Step 2: Write the row (display + inline edit + delete)**

`src/components/ExpenseRow.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { deleteExpenseAction, updateExpenseAction } from "@/lib/actions";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import { centsToDollars } from "@/lib/logbook/parse";
import { FieldError } from "@/components/FieldError";
import type { ActionResult } from "@/lib/logbook/types";
import type { ExpenseRow as ExpenseRowType } from "@/lib/data/expense";

const initial: ActionResult = { ok: true };

function label(code: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.code === code)?.label ?? code;
}

export function ExpenseRow({ expense }: { expense: ExpenseRowType }) {
  const [editing, setEditing] = useState(false);
  const updateForId = updateExpenseAction.bind(null, expense.id);
  const [state, action, pending] = useActionState(updateForId, initial);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fid = `edit-exp-${expense.id}`;

  if (!editing) {
    return (
      <tr className="border-b">
        <td className="py-2 pr-4">{expense.date}</td>
        <td className="py-2 pr-4">{label(expense.category)}</td>
        <td className="py-2 pr-4">${centsToDollars(expense.amountInclCents)}</td>
        <td className="py-2 pr-4">${centsToDollars(expense.gstCents)}</td>
        <td className="py-2 pr-4">{expense.vendor ?? ""}</td>
        <td className="py-2 pr-4">
          {expense.receiptKey ? (
            <a href={`/receipt/${expense.receiptKey}`} target="_blank" rel="noreferrer" className="text-sm underline">View</a>
          ) : ""}
        </td>
        <td className="py-2 flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-sm underline">Edit</button>
          <form action={deleteExpenseAction}>
            <input type="hidden" name="id" value={expense.id} />
            <button type="submit" className="text-sm text-red-600 underline">Delete</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-4">
        <input name="date" type="date" form={fid} defaultValue={expense.date} className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </td>
      <td className="py-2 pr-4">
        <select name="category" form={fid} defaultValue={expense.category} className="border rounded px-2 py-1">
          {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <FieldError message={errs.category} />
      </td>
      <td className="py-2 pr-4">
        <input name="amountIncl" type="number" step="0.01" min="0" form={fid} defaultValue={centsToDollars(expense.amountInclCents)} className="border rounded px-1 py-1 w-24" />
        <FieldError message={errs.amountIncl} />
      </td>
      <td className="py-2 pr-4">
        <input name="gst" type="number" step="0.01" min="0" form={fid} defaultValue={centsToDollars(expense.gstCents)} className="border rounded px-1 py-1 w-20" />
        <FieldError message={errs.gst} />
      </td>
      <td className="py-2 pr-4">
        <input name="vendor" form={fid} defaultValue={expense.vendor ?? ""} className="border rounded px-2 py-1 w-28" />
      </td>
      <td className="py-2 pr-4">
        <input name="receipt" type="file" accept="image/*" form={fid} className="text-xs w-28" />
      </td>
      <td className="py-2">
        <form id={fid} action={action} className="flex gap-3">
          <input type="hidden" name="notes" value={expense.notes ?? ""} />
          <button type="submit" disabled={pending} className="text-sm underline disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm underline">Cancel</button>
        </form>
      </td>
    </tr>
  );
}
```

> Inline edit has no GST-free checkbox — to make an item GST-free, set GST to `0`. Uploading a new file replaces the receipt; leaving it empty keeps the current one (Task 3/5 semantics).

- [ ] **Step 3: Write the page**

`src/app/expenses/page.tsx`:

```tsx
import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listExpenses } from "@/lib/data/expense";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ExpenseRow } from "@/components/ExpenseRow";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const vehicle = await getVehicle();
  if (!vehicle) {
    return (
      <main className="w-full max-w-4xl mx-auto p-8 text-center">
        <p className="mb-4 text-zinc-600">Set up your car first.</p>
        <Link href="/vehicle" className="rounded bg-black text-white px-4 py-2">Set up your car</Link>
      </main>
    );
  }

  const expenses = await listExpenses();

  return (
    <main className="w-full max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <Link href="/" className="text-sm underline">Dashboard</Link>
      </div>
      <ExpenseForm />
      {expenses.length === 0 ? (
        <p className="mt-6 text-zinc-600">No expenses yet.</p>
      ) : (
        <table className="mt-6 w-full text-left">
          <thead>
            <tr className="border-b text-sm text-zinc-500">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">GST</th>
              <th className="py-2 pr-4">Vendor</th>
              <th className="py-2 pr-4">Receipt</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => <ExpenseRow key={e.id} expense={e} />)}
          </tbody>
        </table>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + build**

Run: `corepack pnpm exec tsc --noEmit && corepack pnpm build`
Expected: no errors; `/expenses` builds as a dynamic route.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseForm.tsx src/components/ExpenseRow.tsx src/app/expenses/page.tsx
git commit -m "feat(expenses): expenses page with add form + inline-edit rows"
```

---

### Task 7: Dashboard FY summary + settings read + nav links

**Files:**
- Create: `src/lib/data/settings.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getDb`; `settings` from `src/db/schema.ts`; `listExpenses`, `ExpenseRow` (Task 3); `listTrips`; `businessPct` from `src/lib/tax`; `gstCredit`, `annualDeduction` from `src/lib/tax`; `filterTripsByFy`, `tripsToLegs` from `src/lib/logbook/compute.ts`; `centsToDollars`; `financialYear`, `todayIso`.
- Produces: `getSettings(): Promise<{ gstRegistered: boolean; fyStartMonth: number }>`.

> Not unit-testable (needs live D1). Gate = `tsc --noEmit` + `build`.

- [ ] **Step 1: Write the settings read**

`src/lib/data/settings.ts`:

```ts
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";

export async function getSettings(): Promise<{ gstRegistered: boolean; fyStartMonth: number }> {
  const db = await getDb();
  const rows = await db.select().from(settings).limit(1);
  const row = rows[0];
  // Default to GST-registered (the locked project decision) when unset.
  return { gstRegistered: row?.gstRegistered ?? true, fyStartMonth: row?.fyStartMonth ?? 7 };
}
```

- [ ] **Step 2: Rewrite the dashboard to add the FY summary + nav**

Replace the body of `src/app/page.tsx` with:

```tsx
import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listExpenses } from "@/lib/data/expense";
import { getSettings } from "@/lib/data/settings";
import { fyBusinessPct, filterTripsByFy, tripsToLegs } from "@/lib/logbook/compute";
import { businessPct, gstCredit, annualDeduction, financialYear } from "@/lib/tax";
import { centsToDollars } from "@/lib/logbook/parse";
import { todayIso } from "@/lib/today";
import type { ExpenseCategory } from "@/lib/tax/types";

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

  const [trips, expenses, settings] = await Promise.all([listTrips(), listExpenses(), getSettings()]);
  const fyLabel = financialYear(todayIso()).label;
  const pct = fyBusinessPct(trips, fyLabel);

  const ratio = businessPct(tripsToLegs(filterTripsByFy(trips, fyLabel)));
  const fyExpenses = filterTripsByFy(expenses, fyLabel).map((e) => ({
    amountInclCents: e.amountInclCents,
    gstCents: e.gstCents,
    dateISO: e.date,
    category: e.category as ExpenseCategory,
  }));
  const fyTotalCents = fyExpenses.reduce((s, e) => s + e.amountInclCents, 0);
  const gstCreditCents = gstCredit(fyExpenses, ratio);
  const deductionCents = annualDeduction(fyExpenses, ratio, settings.gstRegistered);

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
      <section className="rounded border p-4 mb-6">
        <p className="text-sm text-zinc-600 mb-2">Estimates — FY {fyLabel}</p>
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs text-zinc-500">Total expenses</p>
            <p className="text-2xl font-semibold">${centsToDollars(fyTotalCents)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">GST credit (BAS)</p>
            <p className="text-2xl font-semibold">${centsToDollars(gstCreditCents)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Income-tax deduction</p>
            <p className="text-2xl font-semibold">${centsToDollars(deductionCents)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Estimate only — full reports come later.</p>
      </section>
      <div className="flex gap-3">
        <Link href="/trips" className="rounded bg-black text-white px-4 py-2">Manage trips</Link>
        <Link href="/expenses" className="rounded bg-black text-white px-4 py-2">Manage expenses</Link>
      </div>
    </main>
  );
}
```

> Note: `filterTripsByFy` is generic over `{ date: string }`, so it filters expenses too (despite the trip-centric name). `businessPct` returns the 0–1 ratio the tax fns expect; `fyBusinessPct` returns the rounded % for display.
- [ ] **Step 3: Typecheck + build**

Run: `corepack pnpm exec tsc --noEmit && corepack pnpm build`
Expected: no errors.

- [ ] **Step 4: Run the full test suite (guard against regressions)**

Run: `corepack pnpm test`
Expected: all prior tests + the 8 new parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/settings.ts src/app/page.tsx
git commit -m "feat(expenses): dashboard FY expense/GST/deduction summary + expenses nav"
```

---

## Done criteria

- `corepack pnpm test` green (parser tests added).
- `corepack pnpm exec tsc --noEmit` + `corepack pnpm build` clean; routes `/expenses` and `/receipt/[...key]` present.
- `/expenses` supports add, inline edit, delete; receipts upload to R2 and view via `/receipt/<key>`; delete cleans the R2 object.
- Dashboard shows current-FY total expenses, GST credit, and deduction estimates.
- No secrets/IDs committed; no new migration; `ocrRaw` untouched.

## Deferred (not this slice)

- OCR pre-fill via Workers AI + `ocrRaw` (slice 3b) — add the `AI` binding to `cloudflare-env.d.ts` then.
- FY filter / `FySwitcher` on the expenses page.
- Full BAS + annual reports + export (Reports slice).
- Real R2/D1 behaviour verified on a Cloudflare deploy (local gate is tsc + build only).
