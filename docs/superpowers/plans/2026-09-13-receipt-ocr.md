# Receipt OCR (Slice 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Scan receipt" button to the expense form that runs Workers AI vision on the picked image and pre-fills date/amount/GST/vendor/category for the user to review before saving.

**Architecture:** A pure, unit-tested parser (`src/lib/ocr/parse.ts`) normalizes raw AI JSON into safe typed values — this is the correctness surface. A thin I/O wrapper (`src/lib/data/ocr.ts`) calls `env.AI.run`. A server action (`scanReceiptAction`) glues them and reuses the existing receipt-file guards. The client form calls the action explicitly and fills controlled fields. Scanning never writes to R2 and never auto-saves.

**Tech Stack:** Next.js 16 (App Router, server actions), Cloudflare Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`) via `@opennextjs/cloudflare`, Drizzle/D1 (unchanged), Vitest.

## Global Constraints

- Money is **integer cents** in all lib/tax/parse functions; dollars only at the UI edge.
- Dates are ISO `YYYY-MM-DD` text. Australian date order is **day-first** (`DD/MM/YYYY`).
- Pure tax/parse functions live under `src/lib/**` with **no I/O**; colocated `*.test.ts`.
- Package manager: **pnpm via corepack** (`corepack pnpm ...`). Test gate: `corepack pnpm test`. Typecheck: `corepack pnpm exec tsc --noEmit`.
- Repo is public: **never commit** secrets, IDs, personal data, or receipt images. Only `*.example` config with placeholders.
- `ExpenseCategory` = `"fuel" | "rego" | "insurance" | "service" | "repairs" | "tyres" | "interest" | "lease" | "depreciation" | "other"`. `depreciation` is computed, never an OCR output.
- OCR only **pre-fills**; the human verifies every field. No AI value is persisted without the user submitting the form.
- Work happens on branch `feat/receipt-ocr` (already created).

---

### Task 1: OCR types + prompt builder

**Files:**
- Create: `src/lib/ocr/types.ts`
- Create: `src/lib/ocr/prompt.ts`
- Test: `src/lib/ocr/prompt.test.ts`

**Interfaces:**
- Consumes: `ExpenseCategory` from `@/lib/tax/types`; `EXPENSE_CATEGORIES` from `@/lib/expenses/categories`.
- Produces:
  - `OcrResult = { dateISO: string | null; amountInclCents: number | null; gstCents: number | null; vendor: string | null; category: ExpenseCategory | null }`
  - `OcrActionResult = { ok: true; value: OcrResult } | { ok: false; error: string }`
  - `buildReceiptPrompt(): string`

- [ ] **Step 1: Write the types file**

`src/lib/ocr/types.ts`:
```ts
import type { ExpenseCategory } from "@/lib/tax/types";

export type OcrResult = {
  dateISO: string | null;
  amountInclCents: number | null;
  gstCents: number | null;
  vendor: string | null;
  category: ExpenseCategory | null;
};

export type OcrActionResult =
  | { ok: true; value: OcrResult }
  | { ok: false; error: string };
```

- [ ] **Step 2: Write the failing prompt test**

`src/lib/ocr/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildReceiptPrompt } from "@/lib/ocr/prompt";

describe("buildReceiptPrompt", () => {
  it("asks for JSON and lists the category codes", () => {
    const p = buildReceiptPrompt();
    expect(p).toMatch(/JSON/i);
    expect(p).toContain("fuel");
    expect(p).toContain("insurance");
    // computed-only category must not be offered to the model
    expect(p).not.toContain("depreciation");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `corepack pnpm test src/lib/ocr/prompt.test.ts`
Expected: FAIL — cannot resolve `@/lib/ocr/prompt`.

- [ ] **Step 4: Write the prompt builder**

`src/lib/ocr/prompt.ts`:
```ts
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";

// EXPENSE_CATEGORIES already excludes "depreciation" (computed, not entered).
export function buildReceiptPrompt(): string {
  const codes = EXPENSE_CATEGORIES.map((c) => c.code).join(", ");
  return [
    "You are reading an Australian vehicle-expense receipt.",
    "Return ONLY a single JSON object, no prose, with exactly these keys:",
    `{"date": string, "total": string, "gst": string, "vendor": string, "category": string}`,
    "- date: the purchase date exactly as printed (e.g. 14/03/2026).",
    "- total: the total amount paid including GST, digits only (e.g. 82.50).",
    "- gst: the GST/tax amount if printed, otherwise an empty string.",
    "- vendor: the business name.",
    `- category: the best match from [${codes}], or an empty string if unsure.`,
    "Use an empty string for any field you cannot read. Do not guess.",
  ].join("\n");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `corepack pnpm test src/lib/ocr/prompt.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → no errors.
```bash
git add src/lib/ocr/types.ts src/lib/ocr/prompt.ts src/lib/ocr/prompt.test.ts
git commit -m "feat(ocr): OCR result types + receipt prompt builder"
```

---

### Task 2: `parseOcrResult` — the normalization core (TDD)

**Files:**
- Create: `src/lib/ocr/parse.ts`
- Test: `src/lib/ocr/parse.test.ts`

**Interfaces:**
- Consumes: `OcrResult` from `@/lib/ocr/types`; `isExpenseCategory` from `@/lib/expenses/categories`.
- Produces: `parseOcrResult(raw: unknown): OcrResult` — never throws. Reads keys `date`, `total`, `gst`, `vendor`, `category` from the model's JSON (a string that may be fenced/prose-wrapped, or an already-parsed object).

- [ ] **Step 1: Write the failing tests**

`src/lib/ocr/parse.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseOcrResult } from "@/lib/ocr/parse";

const ALL_NULL = {
  dateISO: null, amountInclCents: null, gstCents: null, vendor: null, category: null,
};

describe("parseOcrResult", () => {
  it("parses a clean object", () => {
    const r = parseOcrResult({
      date: "14/03/2026", total: "82.50", gst: "7.50", vendor: "Shell", category: "fuel",
    });
    expect(r).toEqual({
      dateISO: "2026-03-14", amountInclCents: 8250, gstCents: 750, vendor: "Shell", category: "fuel",
    });
  });

  it("parses JSON wrapped in a code fence + prose", () => {
    const raw = 'Here you go:\n```json\n{"date":"2026-03-14","total":"$1,234.50","gst":"","vendor":"Repco","category":"Repairs"}\n```';
    const r = parseOcrResult(raw);
    expect(r.dateISO).toBe("2026-03-14");
    expect(r.amountInclCents).toBe(123450);
    expect(r.gstCents).toBeNull();
    expect(r.vendor).toBe("Repco");
    expect(r.category).toBe("repairs"); // normalized lowercase
  });

  it("reads Australian day-first dates and 2-digit years", () => {
    expect(parseOcrResult({ date: "3/7/26" }).dateISO).toBe("2026-07-03");
    expect(parseOcrResult({ date: "14-03-2026" }).dateISO).toBe("2026-03-14");
    expect(parseOcrResult({ date: "14 Mar 2026" }).dateISO).toBe("2026-03-14");
  });

  it("rejects unparseable / impossible dates without guessing", () => {
    expect(parseOcrResult({ date: "last tuesday" }).dateISO).toBeNull();
    expect(parseOcrResult({ date: "45/13/2026" }).dateISO).toBeNull();
    expect(parseOcrResult({ date: "" }).dateISO).toBeNull();
  });

  it("cleans currency to cents; rejects junk", () => {
    expect(parseOcrResult({ total: "$1,234.50" }).amountInclCents).toBe(123450);
    expect(parseOcrResult({ total: "1234.5" }).amountInclCents).toBe(123450);
    expect(parseOcrResult({ total: 82.5 }).amountInclCents).toBe(8250);
    expect(parseOcrResult({ total: "n/a" }).amountInclCents).toBeNull();
    expect(parseOcrResult({ total: "-5.00" }).amountInclCents).toBeNull();
  });

  it("clamps GST over total and drops negatives; null GST stays null", () => {
    expect(parseOcrResult({ total: "10.00", gst: "50.00" }).gstCents).toBe(1000);
    expect(parseOcrResult({ gst: "-1.00" }).gstCents).toBeNull();
    expect(parseOcrResult({ total: "10.00" }).gstCents).toBeNull();
  });

  it("normalizes / rejects categories; never returns depreciation", () => {
    expect(parseOcrResult({ category: "FUEL" }).category).toBe("fuel");
    expect(parseOcrResult({ category: "groceries" }).category).toBeNull();
    expect(parseOcrResult({ category: "depreciation" }).category).toBeNull();
  });

  it("cleans vendor; drops empty / 'null' / overlong", () => {
    expect(parseOcrResult({ vendor: "  BP  " }).vendor).toBe("BP");
    expect(parseOcrResult({ vendor: "null" }).vendor).toBeNull();
    expect(parseOcrResult({ vendor: "x".repeat(200) }).vendor).toBeNull();
  });

  it("returns all-null for junk input, never throws", () => {
    expect(parseOcrResult("not json at all")).toEqual(ALL_NULL);
    expect(parseOcrResult("")).toEqual(ALL_NULL);
    expect(parseOcrResult(null)).toEqual(ALL_NULL);
    expect(parseOcrResult([1, 2, 3])).toEqual(ALL_NULL);
    expect(parseOcrResult({ unrelated: "key" })).toEqual(ALL_NULL);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm test src/lib/ocr/parse.test.ts`
Expected: FAIL — cannot resolve `@/lib/ocr/parse`.

- [ ] **Step 3: Write the implementation**

`src/lib/ocr/parse.ts`:
```ts
import { isExpenseCategory } from "@/lib/expenses/categories";
import type { OcrResult } from "@/lib/ocr/types";

const ALL_NULL: OcrResult = {
  dateISO: null, amountInclCents: null, gstCents: null, vendor: null, category: null,
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function asObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") return null;
  const m = raw.match(/\{[\s\S]*\}/); // first {...} block, tolerates fences/prose
  if (!m) return null;
  try {
    const parsed: unknown = JSON.parse(m[0]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function toIso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function parseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // ISO
  if (m) return toIso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); // DD/MM/YYYY (AU day-first)
  if (m) return toIso(fullYear(+m[3]), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})$/); // DD Mon YYYY
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return toIso(fullYear(+m[3]), mo, +m[1]);
  }
  return null;
}

function parseCents(v: unknown): number | null {
  if (typeof v === "number") {
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  }
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function parseVendor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === "null" || s.length > 120) return null;
  return s;
}

function parseCategory(v: unknown): OcrResult["category"] {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "depreciation") return null; // computed, never OCR'd
  return isExpenseCategory(s) ? s : null;
}

export function parseOcrResult(raw: unknown): OcrResult {
  const o = asObject(raw);
  if (!o) return { ...ALL_NULL };
  const amountInclCents = parseCents(o.total);
  let gstCents = parseCents(o.gst);
  if (gstCents !== null && amountInclCents !== null && gstCents > amountInclCents) {
    gstCents = amountInclCents; // clamp GST to total
  }
  return {
    dateISO: parseDate(o.date),
    amountInclCents,
    gstCents,
    vendor: parseVendor(o.vendor),
    category: parseCategory(o.category),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm test src/lib/ocr/parse.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Full suite + typecheck**

Run: `corepack pnpm test` → all green (existing 35 + new).
Run: `corepack pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ocr/parse.ts src/lib/ocr/parse.test.ts
git commit -m "feat(ocr): parseOcrResult normalizer (AU dates, cents, GST clamp, category)"
```

---

### Task 3: AI binding + OCR I/O wrapper + shared receipt-file guard + docs

**Files:**
- Modify: `cloudflare-env.d.ts` (add the `AI` binding)
- Modify: `src/lib/data/receipts.ts` (extract `assertReceiptFile`, reuse in `putReceipt`)
- Create: `src/lib/data/ocr.ts` (`runReceiptOcr`)
- Modify: `.env.example` (document `CLOUDFLARE_API_TOKEN`)
- Create: `docs/ocr.md` (local-dev setup + Meta-license note)

**Interfaces:**
- Consumes: `getCloudflareContext` from `@opennextjs/cloudflare`; `buildReceiptPrompt` from `@/lib/ocr/prompt`.
- Produces:
  - `assertReceiptFile(file: File): void` (exported from `src/lib/data/receipts.ts`) — throws `Error` with a user-facing message if the type is not in the allowlist or the file is over 10 MB.
  - `runReceiptOcr(file: File): Promise<unknown>` — returns the model's raw text response (or the raw response object) for `parseOcrResult`.

- [ ] **Step 1: Add the AI binding to env types**

In `cloudflare-env.d.ts`, replace the placeholder comment + interface body so it reads:
```ts
/// <reference types="@cloudflare/workers-types" />

// Ambient binding types for getCloudflareContext().env.
interface CloudflareEnv {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  AI: Ai;
}
```

- [ ] **Step 2: Extract the shared receipt-file guard**

In `src/lib/data/receipts.ts`, add an exported guard and call it from `putReceipt` (keep `ALLOWED_TYPES`/`MAX_BYTES` as-is). Replace the top of `putReceipt`:

Add:
```ts
export function assertReceiptFile(file: File): void {
  if (!ALLOWED_TYPES[file.type]) {
    throw new Error("Receipt must be a JPEG, PNG, WebP, or HEIC image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Receipt image is too large (max 10 MB).");
  }
}
```
Change `putReceipt` so its first lines are:
```ts
export async function putReceipt(vehicleId: number, file: File): Promise<string> {
  assertReceiptFile(file);
  const ext = ALLOWED_TYPES[file.type];
  // ...unchanged from here (key, bucket, put, return key)
```

- [ ] **Step 3: Write the OCR I/O wrapper**

`src/lib/data/ocr.ts`:
```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildReceiptPrompt } from "@/lib/ocr/prompt";

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

// Sends the receipt image to Workers AI vision and returns the model's raw
// text response for parseOcrResult to normalize. Throws on binding/model
// error — the caller (scanReceiptAction) catches and degrades to manual entry.
export async function runReceiptOcr(file: File): Promise<unknown> {
  const { env } = await getCloudflareContext({ async: true });
  const bytes = [...new Uint8Array(await file.arrayBuffer())];
  const res = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: "You extract structured data from receipt images." },
      { role: "user", content: buildReceiptPrompt() },
    ],
    image: bytes,
  });
  return (res as { response?: unknown }).response ?? res;
}
```
Note: if `tsc` rejects the `{ messages, image }` input against the `Ai` binding's model union, cast the inputs object with `as never` — the runtime accepts messages + image for this vision model. Do not use `any`.

- [ ] **Step 4: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: no errors. (Existing `putReceipt` callers unchanged; `runReceiptOcr` compiles.)

- [ ] **Step 5: Document local setup**

Append to `.env.example`:
```
# Required only when the [ai] binding is enabled locally (OCR). A Cloudflare
# API token with Workers AI access; @opennextjs/cloudflare needs it at build.
CLOUDFLARE_API_TOKEN=
```

Create `docs/ocr.md`:
```markdown
# Receipt OCR (Workers AI)

The "Scan receipt" button on the expense form sends the image to a Cloudflare
Workers AI vision model (`@cf/meta/llama-3.2-11b-vision-instruct`) and pre-fills
the form. The user reviews every field before saving — OCR is never authoritative
and never auto-saves.

## Enabling locally

1. `[ai]` binding is already in `wrangler.toml.example` (`binding = "AI"`). Copy it
   into your gitignored `wrangler.toml`.
2. The AI binding makes `@opennextjs/cloudflare` require a Cloudflare API token at
   build/dev time. Put `CLOUDFLARE_API_TOKEN=<token with Workers AI access>` in your
   gitignored `.dev.vars` (see `.env.example`). Without the `[ai]` binding, the rest
   of the app builds and runs normally; only OCR is unavailable.
3. First use of the Llama vision model on a Cloudflare account requires a one-time
   agreement to Meta's license/AUP (Cloudflare dashboard → Workers AI, or via API).

## Behaviour / limits

- Scanning does **not** upload to R2. The image is uploaded only when the expense is
  saved (unchanged from slice 3a).
- HEIC images can be uploaded and saved but **cannot be scanned** (the vision model
  expects JPEG/PNG/WebP); the button reports this and manual entry still works.
- Any AI/parse failure degrades silently to manual entry.
```

- [ ] **Step 6: Commit**

```bash
git add cloudflare-env.d.ts src/lib/data/receipts.ts src/lib/data/ocr.ts .env.example docs/ocr.md
git commit -m "feat(ocr): AI binding + runReceiptOcr wrapper + shared receipt guard + docs"
```

---

### Task 4: `scanReceiptAction` server action

**Files:**
- Modify: `src/lib/actions.ts` (add imports + the new action; existing actions untouched)

**Interfaces:**
- Consumes: `fileFrom` (existing private helper in `actions.ts`, reads the `"receipt"` field, returns `File | null`); `assertReceiptFile` from `@/lib/data/receipts`; `runReceiptOcr` from `@/lib/data/ocr`; `parseOcrResult` from `@/lib/ocr/parse`; `OcrActionResult` from `@/lib/ocr/types`.
- Produces: `scanReceiptAction(_prev: OcrActionResult, fd: FormData): Promise<OcrActionResult>`.

- [ ] **Step 1: Add imports**

At the top of `src/lib/actions.ts`, add:
```ts
import { assertReceiptFile } from "@/lib/data/receipts";
import { runReceiptOcr } from "@/lib/data/ocr";
import { parseOcrResult } from "@/lib/ocr/parse";
import type { OcrActionResult } from "@/lib/ocr/types";
```
(Existing `import { putReceipt } from "@/lib/data/receipts"` can merge into the `assertReceiptFile` import from the same module, or stay as a second named import — either compiles.)

- [ ] **Step 2: Add the action** (append to `src/lib/actions.ts`)

```ts
export async function scanReceiptAction(
  _prev: OcrActionResult,
  fd: FormData,
): Promise<OcrActionResult> {
  const file = fileFrom(fd);
  if (!file) return { ok: false, error: "Pick a receipt first." };
  try {
    assertReceiptFile(file);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (file.type === "image/heic") {
    return { ok: false, error: "Scan isn't available for HEIC images — enter details manually." };
  }
  try {
    const raw = await runReceiptOcr(file);
    return { ok: true, value: parseOcrResult(raw) };
  } catch {
    return { ok: false, error: "Couldn't read the receipt. Enter details manually." };
  }
}
```

- [ ] **Step 3: Typecheck + build (server action wiring)**

Run: `corepack pnpm exec tsc --noEmit` → no errors.
Run: `corepack pnpm build` → succeeds (confirms the `"use server"` module still compiles under Cloudflare/OpenNext). If the build fails only for lack of `CLOUDFLARE_API_TOKEN` locally (AI binding), note it and rely on CI; the code change itself must typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(ocr): scanReceiptAction — vision OCR, reuses receipt guards, HEIC + error degrade"
```

---

### Task 5: "Scan receipt" button in `ExpenseForm`

**Files:**
- Modify: `src/components/ExpenseForm.tsx`

**Interfaces:**
- Consumes: `scanReceiptAction` from `@/lib/actions`; `OcrActionResult`/`OcrResult` shape via the action's return.
- Produces: no new exports — UI behaviour only.

**Behaviour:** The OCR-target fields (date, amount, gst, vendor, category) become controlled React state. A "Scan receipt" button, enabled once a file is chosen, calls `scanReceiptAction` with just the file, fills non-null returned fields (leaving nulls untouched), and shows a review reminder or an error line. The form's own `action={action}` (createExpenseAction) and submit flow are unchanged.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/components/ExpenseForm.tsx` with:
```tsx
"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { createExpenseAction, scanReceiptAction } from "@/lib/actions";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import { FieldError } from "@/components/FieldError";
import { todayIso } from "@/lib/today";
import type { ActionResult } from "@/lib/logbook/types";

const initial: ActionResult = { ok: true };

export function ExpenseForm() {
  const [state, action, pending] = useActionState(createExpenseAction, initial);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  // Controlled OCR-target fields.
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].code);
  const [amount, setAmount] = useState("");
  const [gst, setGst] = useState("");
  const [vendor, setVendor] = useState("");
  const [gstFree, setGstFree] = useState(false);

  const autoGst = gstFree ? "0.00" : (Number(amount) > 0 ? (Number(amount) / 11).toFixed(2) : "");

  // Scan state.
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [scanning, startScan] = useTransition();
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  function onScan() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("receipt", f);
    setScanMsg(null);
    startScan(async () => {
      const res = await scanReceiptAction({ ok: false, error: "" }, fd);
      if (res.ok) {
        const v = res.value;
        if (v.dateISO) setDate(v.dateISO);
        if (v.amountInclCents != null) setAmount((v.amountInclCents / 100).toFixed(2));
        if (v.gstCents != null) {
          setGstFree(false);
          setGst((v.gstCents / 100).toFixed(2));
        }
        if (v.vendor) setVendor(v.vendor);
        if (v.category) setCategory(v.category);
        setScanMsg("AI-filled — check every field before saving.");
      } else {
        setScanMsg(res.error);
      }
    });
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border rounded p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Date</span>
        <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Category</span>
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded px-2 py-1">
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
        <input name="gst" type="number" step="0.01" min="0" value={gst} onChange={(e) => setGst(e.target.value)} placeholder={autoGst} disabled={gstFree} className="border rounded px-2 py-1 w-28" />
        <FieldError message={errs.gst} />
      </label>
      <label className="flex items-center gap-2">
        <input name="gstFree" type="checkbox" checked={gstFree} onChange={(e) => setGstFree(e.target.checked)} />
        <span className="text-sm">GST-free</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Vendor</span>
        <input name="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Receipt</span>
        <input ref={fileRef} name="receipt" type="file" accept="image/*" capture="environment" onChange={(e) => setHasFile(!!e.target.files?.length)} className="text-sm" />
      </label>
      <button type="button" onClick={onScan} disabled={!hasFile || scanning} className="rounded border px-3 py-2 disabled:opacity-50">
        {scanning ? "Scanning…" : "Scan receipt"}
      </button>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Adding…" : "Add expense"}
      </button>
      {scanMsg ? <p className="w-full text-sm text-gray-600">{scanMsg}</p> : null}
      {!state.ok && state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `corepack pnpm build`
Expected: succeeds; `/expenses` still builds. (If it fails only on the missing local `CLOUDFLARE_API_TOKEN` for the AI binding, note it and rely on CI — the committed repo has `wrangler.toml` gitignored.)

- [ ] **Step 4: Full test suite (nothing regressed)**

Run: `corepack pnpm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseForm.tsx
git commit -m "feat(ocr): Scan receipt button prefills expense form (controlled fields)"
```

---

## Final review (main-thread synthesis)

After Task 5: one PR-level critical pass (per the economy rule — no reviewer subagent for a diff this size). Confirm:
- `parseOcrResult` never throws and never emits `depreciation`.
- Scanning writes nothing to R2; R2 upload remains only in `createExpenseAction`.
- No secret/ID committed; only `.example` + `docs/ocr.md` placeholders.
- `corepack pnpm test` + `corepack pnpm exec tsc --noEmit` green; build green (or fails only on local AI-token, covered by CI).
- Open a PR (`feat/receipt-ocr` → `main`); read all bot/human review threads and disposition each before merge.

## Self-review notes (author)

- **Spec coverage:** Scan button (T5), scanReceiptAction (T4), pure parser + tests (T2), prompt/types (T1), AI binding + wrapper + config/docs (T3), HEIC + error degrade (T4), no-R2-on-scan (T4/T5), testing matrix (T2). All spec sections mapped.
- **Type consistency:** `OcrResult`/`OcrActionResult` defined T1, consumed T2/T4/T5; `parseOcrResult(raw: unknown): OcrResult`, `runReceiptOcr(file: File)`, `assertReceiptFile(file: File): void`, `scanReceiptAction(_prev, fd)` — names/signatures identical across tasks.
- **No placeholders:** every code step shows full code; every run step shows the command + expected result.
