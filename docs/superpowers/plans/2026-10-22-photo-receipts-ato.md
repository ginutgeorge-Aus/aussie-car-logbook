# Photo-only receipts + ATO tax-invoice compliance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI receipt scanning with photo-only capture, and record seller ABN + a tax-invoice
flag so BAS holds back GST credits on purchases over $82.50 that lack a tax invoice.

**Architecture:** Pure rules (`isValidAbn`, `gstCreditEligible`) live in `src/lib/tax/` and are
unit-tested. The form parser validates/normalises the new fields server-side. `buildFyReport` splits
each quarter's expenses into eligible vs held-back. OCR code, the Workers AI binding and its docs are
removed; the photo still goes to R2.

**Tech Stack:** Next.js 16 App Router on Cloudflare Workers (OpenNext), D1 + Drizzle, R2, Vitest, pnpm via corepack.

Spec: `docs/superpowers/specs/2026-10-22-photo-receipts-ato-design.md`

## Global Constraints

- Money is integer cents everywhere; dollars only at the UI edge.
- Tax-invoice threshold: `TAX_INVOICE_THRESHOLD_CENTS = 8250` ($82.50 incl. GST). `≤ 8250` needs no invoice.
- Buyer-identity hint threshold: amount `≥ $1,000`.
- ABN: 11 digits, stored without spaces; ATO checksum = subtract 1 from first digit, weights `10,1,3,5,7,9,11,13,15,17,19`, weighted sum mod 89 = 0.
- Photo compress target: `TARGET_BYTES = 200 * 1024`, `START_QUALITY = 0.8`.
- Migrations forward-only and non-destructive: `ocr_raw` column stays (in DB and Drizzle schema).
- Migration backfills `tax_invoice = 1` on all existing expense rows.
- Commands: `corepack pnpm test`, `corepack pnpm build`. Never commit `wrangler.toml`, `.dev.vars`, `CLAUDE.md`, `.claude/`.
- Branch: `feat/photo-receipts-ato` (already created). Commit messages Conventional Commits, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Change |
|------|--------|
| `src/lib/tax/abn.ts` (+ `abn.test.ts`) | Create — `normaliseAbn`, `isValidAbn` |
| `src/lib/tax/gst.ts` (+ `gst.test.ts`) | Add `TAX_INVOICE_THRESHOLD_CENTS`, `gstCreditEligible` |
| `src/lib/tax/index.ts` | Export `abn` |
| `src/db/schema.ts` | Add `abn`, `taxInvoice`; mark `ocrRaw` legacy |
| `src/db/migrations/0001_*.sql` | Generated + backfill `UPDATE` |
| `src/lib/expenses/parse.ts` (+ test) | Parse `abn`, `taxInvoice` |
| `src/lib/reports/build.ts` (+ test) | Per-quarter `heldBackGstCents`, `needsTaxInvoice`; `totalHeldBackGstCents` |
| `src/components/ExpenseForm.tsx` | Photo-only capture, ABN + tax-invoice fields |
| `src/components/ExpenseRow.tsx` | Edit form fields; row anchors `expense-<id>` |
| `src/app/reports/page.tsx` | Held-back block per quarter |
| `src/lib/image/compress.ts` | 200 KB / 0.8; comment without OCR |
| `src/lib/actions.ts` | Remove `scanReceiptAction` + OCR imports |
| Delete | `src/lib/ocr/`, `src/lib/data/ocr.ts`, `docs/ocr.md` |
| `cloudflare-env.d.ts`, `wrangler.toml.example`, `.env.example`, `docs/deploy-auto.md`, `docs/deploy-ui.md` | Drop AI binding / OCR mentions |

---

### Task 1: ABN validator

**Files:**
- Create: `src/lib/tax/abn.ts`
- Create: `src/lib/tax/abn.test.ts`
- Modify: `src/lib/tax/index.ts`

**Interfaces:**
- Produces: `normaliseAbn(raw: string): string` (strips all whitespace), `isValidAbn(raw: string): boolean` (normalises first; true only for 11 digits passing checksum). Exported from `@/lib/tax`.

- [ ] **Step 1: Write the failing test** — `src/lib/tax/abn.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isValidAbn, normaliseAbn } from "@/lib/tax/abn";

describe("ABN", () => {
  it("normalises spaces away", () => {
    expect(normaliseAbn(" 51 824 753 556 ")).toBe("51824753556");
  });
  it("accepts a valid ABN (ATO's own: 51 824 753 556), with or without spaces", () => {
    expect(isValidAbn("51824753556")).toBe(true);
    expect(isValidAbn("51 824 753 556")).toBe(true);
  });
  it("rejects a wrong checksum", () => {
    expect(isValidAbn("51824753557")).toBe(false);
  });
  it("rejects wrong length or non-digits", () => {
    expect(isValidAbn("5182475355")).toBe(false);
    expect(isValidAbn("518247535561")).toBe(false);
    expect(isValidAbn("5182475355a")).toBe(false);
    expect(isValidAbn("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm test src/lib/tax/abn.test.ts`
Expected: FAIL — cannot resolve `@/lib/tax/abn`.

- [ ] **Step 3: Implement** — `src/lib/tax/abn.ts`

```ts
/** ATO ABN checksum weights, one per digit. */
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/** Strips all whitespace (ABNs are usually printed as "51 824 753 556"). */
export function normaliseAbn(raw: string): string {
  return raw.replace(/\s+/g, "");
}

/**
 * ATO ABN check: 11 digits; subtract 1 from the first digit, weight each digit,
 * and the sum must be divisible by 89.
 */
export function isValidAbn(raw: string): boolean {
  const abn = normaliseAbn(raw);
  if (!/^\d{11}$/.test(abn)) return false;
  const digits = abn.split("").map(Number);
  digits[0] -= 1;
  const sum = digits.reduce((s, d, i) => s + d * ABN_WEIGHTS[i], 0);
  return sum % 89 === 0;
}
```

Append to `src/lib/tax/index.ts`:

```ts
export * from "@/lib/tax/abn";
```

- [ ] **Step 4: Run to verify it passes**

Run: `corepack pnpm test src/lib/tax/abn.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tax/abn.ts src/lib/tax/abn.test.ts src/lib/tax/index.ts
git commit -m "feat(tax): add ATO ABN checksum validator"
```

---

### Task 2: GST credit eligibility rule

**Files:**
- Modify: `src/lib/tax/gst.ts`
- Test: `src/lib/tax/gst.test.ts`

**Interfaces:**
- Produces: `TAX_INVOICE_THRESHOLD_CENTS = 8250`;
  `gstCreditEligible(e: { amountInclCents: number; gstCents: number; taxInvoice: boolean }): boolean`.
  `gstCredit` is unchanged (callers filter first).

- [ ] **Step 1: Write the failing test** — append to `src/lib/tax/gst.test.ts`

```ts
import { gstCreditEligible, TAX_INVOICE_THRESHOLD_CENTS } from "@/lib/tax/gst";

test("tax-invoice threshold is $82.50 incl GST", () => {
  expect(TAX_INVOICE_THRESHOLD_CENTS).toBe(8250);
});
test("GST credit eligibility follows the ATO tax-invoice rule", () => {
  // At the threshold: any receipt is enough.
  expect(gstCreditEligible({ amountInclCents: 8250, gstCents: 750, taxInvoice: false })).toBe(true);
  // Over it: needs a tax invoice.
  expect(gstCreditEligible({ amountInclCents: 8251, gstCents: 750, taxInvoice: false })).toBe(false);
  expect(gstCreditEligible({ amountInclCents: 8251, gstCents: 750, taxInvoice: true })).toBe(true);
  // GST-free: nothing to claim, never held back.
  expect(gstCreditEligible({ amountInclCents: 20000, gstCents: 0, taxInvoice: false })).toBe(true);
});
```

(Merge the new import into the existing `import { gstFromInclusive, gstCredit } from "@/lib/tax/gst";` line.)

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm test src/lib/tax/gst.test.ts`
Expected: FAIL — `gstCreditEligible` is not exported.

- [ ] **Step 3: Implement** — append to `src/lib/tax/gst.ts`

```ts
/** ATO: a tax invoice is required to claim a GST credit on purchases over $82.50 incl. GST. */
export const TAX_INVOICE_THRESHOLD_CENTS = 8250;

/**
 * Whether an expense's GST may be claimed on the BAS now: GST-free (nothing to
 * claim), at or under the tax-invoice threshold, or a tax invoice is held.
 */
export function gstCreditEligible(e: { amountInclCents: number; gstCents: number; taxInvoice: boolean }): boolean {
  return e.gstCents === 0 || e.amountInclCents <= TAX_INVOICE_THRESHOLD_CENTS || e.taxInvoice;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `corepack pnpm test src/lib/tax/gst.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tax/gst.ts src/lib/tax/gst.test.ts
git commit -m "feat(tax): add tax-invoice GST credit eligibility"
```

---

### Task 3: Schema + migration

**Files:**
- Modify: `src/db/schema.ts:34-45`
- Create (generated): `src/db/migrations/0001_expense_abn_tax_invoice.sql`, `meta/0001_snapshot.json`, `meta/_journal.json`

**Interfaces:**
- Produces: `ExpenseRow` (`typeof expense.$inferSelect`) gains `abn: string | null`, `taxInvoice: boolean`.

- [ ] **Step 1: Edit schema** — `expense` table in `src/db/schema.ts` becomes:

```ts
export const expense = sqliteTable("expense", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  date: text("date").notNull(),
  category: text("category").notNull(),
  amountInclCents: integer("amount_incl_cents").notNull(),
  gstCents: integer("gst_cents").notNull().default(0),
  vendor: text("vendor"),
  abn: text("abn"), // seller ABN, 11 digits, no spaces
  taxInvoice: integer("tax_invoice", { mode: "boolean" }).notNull().default(false),
  receiptKey: text("receipt_key"), // R2 object key
  notes: text("notes"),
  ocrRaw: text("ocr_raw"), // legacy (OCR removed); kept so migrations stay non-destructive
});
```

- [ ] **Step 2: Generate migration**

Run: `corepack pnpm drizzle-kit generate --name expense_abn_tax_invoice`
Expected: new `src/db/migrations/0001_expense_abn_tax_invoice.sql` containing only:

```sql
ALTER TABLE `expense` ADD `abn` text;--> statement-breakpoint
ALTER TABLE `expense` ADD `tax_invoice` integer DEFAULT false NOT NULL;
```

If it contains anything else (e.g. `DROP`), stop and fix the schema.

- [ ] **Step 3: Append backfill** to the end of that SQL file:

```sql
--> statement-breakpoint
-- Existing expenses keep their GST credit after upgrade (pre-flag behaviour).
UPDATE `expense` SET `tax_invoice` = 1;
```

- [ ] **Step 4: Verify on local D1**

Run: `corepack pnpm db:local && corepack pnpm exec wrangler d1 execute DB --local --command "PRAGMA table_info(expense)"`
Expected: `abn` and `tax_invoice` columns listed. (Requires a local gitignored `wrangler.toml`; if absent, skip and note it.)

- [ ] **Step 5: Fix fixtures + typecheck**

In `src/lib/reports/build.test.ts`, the `expense()` fixture default becomes:

```ts
const expense = (over: Partial<ExpenseRow>): ExpenseRow => ({
  id: 1, vehicleId: 1, date: "2024-08-01", category: "fuel",
  amountInclCents: 11000, gstCents: 1000, vendor: null, abn: null, taxInvoice: true, receiptKey: null,
  notes: null, ocrRaw: null, ...over,
});
```

Run: `corepack pnpm test`
Expected: PASS (all existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/migrations src/lib/reports/build.test.ts
git commit -m "feat(db): add expense ABN and tax-invoice flag"
```

---

### Task 4: Form parser — ABN + tax invoice

**Files:**
- Modify: `src/lib/expenses/parse.ts`
- Test: `src/lib/expenses/parse.test.ts`

**Interfaces:**
- Consumes: `isValidAbn`, `normaliseAbn` from `@/lib/tax` (Task 1).
- Produces: `ExpenseInput` (in `parse.ts`) gains `abn: string | null; taxInvoice: boolean`. Form field names: `abn` (text), `taxInvoice` (checkbox, `"on"` when ticked). Field error key: `abn`.

- [ ] **Step 1: Write failing tests** — in `src/lib/expenses/parse.test.ts`, update the first test's expected value to include `abn: null, taxInvoice: false`, then add:

```ts
  it("normalises a valid ABN and reads the tax-invoice checkbox", () => {
    const r = parseExpenseForm(fd({ ...base, abn: "51 824 753 556", taxInvoice: "on" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.abn).toBe("51824753556");
    expect(r.value.taxInvoice).toBe(true);
  });

  it("rejects an invalid ABN", () => {
    const r = parseExpenseForm(fd({ ...base, abn: "51 824 753 557" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.abn).toBe("Enter a valid 11-digit ABN.");
  });

  it("treats a blank ABN as none", () => {
    const r = parseExpenseForm(fd({ ...base, abn: "   " }));
    expect(r.ok && r.value.abn).toBe(null);
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `corepack pnpm test src/lib/expenses/parse.test.ts`
Expected: FAIL (missing `abn`/`taxInvoice` in value).

- [ ] **Step 3: Implement** — in `src/lib/expenses/parse.ts`:

Change imports: `import { gstFromInclusive, isValidAbn, normaliseAbn } from "@/lib/tax";`

`ExpenseInput` type:

```ts
export type ExpenseInput = {
  date: string;
  category: ExpenseCategory;
  amountInclCents: number;
  gstCents: number;
  vendor: string | null;
  abn: string | null;
  taxInvoice: boolean;
  notes: string | null;
};
```

After `const vendor = ...`:

```ts
  const abnRaw = normaliseAbn(str(fd, "abn"));
  if (abnRaw && !isValidAbn(abnRaw)) errors.abn = "Enter a valid 11-digit ABN.";
  const abn = abnRaw || null;
  const taxInvoice = str(fd, "taxInvoice") === "on";
```

Return value: `{ date, category: category as ExpenseCategory, amountInclCents, gstCents, vendor, abn, taxInvoice, notes }`.

Update the doc comment above `parseExpenseForm` to add: "an optional seller ABN (checksum-validated) and a tax-invoice flag."

- [ ] **Step 4: Run to verify pass**

Run: `corepack pnpm test src/lib/expenses/parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/expenses/parse.ts src/lib/expenses/parse.test.ts
git commit -m "feat(expenses): parse seller ABN and tax-invoice flag"
```

---

### Task 5: Report — hold back GST without tax invoice

**Files:**
- Modify: `src/lib/reports/build.ts`
- Test: `src/lib/reports/build.test.ts`

**Interfaces:**
- Consumes: `gstCreditEligible` (Task 2), `ExpenseRow.taxInvoice` (Task 3).
- Produces: `FyReport.bas.quarters[i]` gains `heldBackGstCents: number` and
  `needsTaxInvoice: NeedsTaxInvoiceItem[]` where
  `export type NeedsTaxInvoiceItem = { id: number; date: string; vendor: string | null; amountInclCents: number }`;
  `FyReport.bas.totalHeldBackGstCents: number`.

- [ ] **Step 1: Write failing tests** — add inside `describe("buildFyReport", ...)`:

```ts
  it("holds back GST on expenses over $82.50 without a tax invoice", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })]; // 100% business
    const expenses = [
      expense({ id: 1, date: "2024-08-01", amountInclCents: 11000, gstCents: 1000, taxInvoice: false, vendor: "BP" }),
      expense({ id: 2, date: "2024-08-02", amountInclCents: 8250, gstCents: 750, taxInvoice: false }),
      expense({ id: 3, date: "2024-08-03", amountInclCents: 22000, gstCents: 2000, taxInvoice: true }),
    ];
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
    const q1 = r.bas.quarters[0];

    expect(q1.gstCreditCents).toBe(2750); // 750 (≤ $82.50) + 2000 (invoice held)
    expect(q1.heldBackGstCents).toBe(1000);
    expect(q1.needsTaxInvoice).toEqual([{ id: 1, date: "2024-08-01", vendor: "BP", amountInclCents: 11000 }]);
    expect(r.bas.totalHeldBackGstCents).toBe(1000);
  });

  it("holds nothing back when not GST-registered", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const expenses = [expense({ amountInclCents: 11000, gstCents: 1000, taxInvoice: false })];
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: false }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

    expect(r.bas.quarters[0].heldBackGstCents).toBe(0);
    expect(r.bas.quarters[0].needsTaxInvoice).toEqual([]);
    expect(r.bas.totalHeldBackGstCents).toBe(0);
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `corepack pnpm test src/lib/reports/build.test.ts`
Expected: FAIL (`heldBackGstCents` undefined; credit 3750 not 2750).

- [ ] **Step 3: Implement** — in `src/lib/reports/build.ts`:

Add `gstCreditEligible,` to the `@/lib/tax` import list.

Above `FyReport`:

```ts
/** An expense whose GST credit is held back until a tax invoice is recorded. */
export type NeedsTaxInvoiceItem = { id: number; date: string; vendor: string | null; amountInclCents: number };
```

In `FyReport.bas`:

```ts
    quarters: Array<{
      quarter: 1 | 2 | 3 | 4;
      label: string;
      gstCreditCents: number;
      /** Business share of GST not claimable yet: over $82.50 with no tax invoice (ATO rule). */
      heldBackGstCents: number;
      needsTaxInvoice: NeedsTaxInvoiceItem[];
    }>;
    totalGstCreditCents: number;
    totalHeldBackGstCents: number;
```

Replace the `const quarters = ...` block and the total line with:

```ts
  const quarters = fyQuarters(fyLabel).map((q) => {
    const inQ = fyExpenses.filter((e) => e.date >= q.startISO && e.date <= q.endISO);
    const purchaseInQ = purchase.dateISO !== null && purchase.dateISO >= q.startISO && purchase.dateISO <= q.endISO;
    // No GST credits at all unless GST-registered.
    if (!settings.gstRegistered) {
      return { quarter: q.quarter, label: q.label, gstCreditCents: 0, heldBackGstCents: 0, needsTaxInvoice: [] };
    }
    const claimable = inQ.filter((e) => gstCreditEligible(e));
    const held = inQ.filter((e) => !gstCreditEligible(e));
    return {
      quarter: q.quarter,
      label: q.label,
      gstCreditCents: gstCredit(claimable.map(toExpenseInput), ratio) + (purchaseInQ ? purchase.creditCents : 0),
      heldBackGstCents: gstCredit(held.map(toExpenseInput), ratio),
      needsTaxInvoice: held.map((e) => ({ id: e.id, date: e.date, vendor: e.vendor, amountInclCents: e.amountInclCents })),
    };
  });
  const totalGstCreditCents = quarters.reduce((s, q) => s + q.gstCreditCents, 0);
  const totalHeldBackGstCents = quarters.reduce((s, q) => s + q.heldBackGstCents, 0);
```

Add `totalHeldBackGstCents` to the returned `bas` object next to `totalGstCreditCents`.

- [ ] **Step 4: Run to verify pass**

Run: `corepack pnpm test`
Expected: PASS (whole suite).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/build.ts src/lib/reports/build.test.ts
git commit -m "feat(reports): hold back BAS GST without tax invoice"
```

---

### Task 6: Remove OCR; photo-only capture at 200 KB

**Files:**
- Delete: `src/lib/ocr/` (all files incl. tests), `src/lib/data/ocr.ts`, `docs/ocr.md`
- Modify: `src/lib/actions.ts`, `src/components/ExpenseForm.tsx`, `src/lib/image/compress.ts`,
  `cloudflare-env.d.ts`, `wrangler.toml.example`, `.env.example`, `docs/deploy-auto.md`, `docs/deploy-ui.md`

**Interfaces:**
- Consumes: nothing new. ABN fields are added to the form in Task 7.
- Produces: `ExpenseForm` without OCR; `compressReceipt(file: File): Promise<File>` unchanged signature.

- [ ] **Step 1: Delete OCR code + docs**

```bash
git rm -r src/lib/ocr src/lib/data/ocr.ts docs/ocr.md
```

- [ ] **Step 2: `src/lib/actions.ts`** — delete these imports:

```ts
import { runReceiptOcr } from "@/lib/data/ocr";
import { OcrLicenceError } from "@/lib/ocr/model";
import { parseOcrResult } from "@/lib/ocr/parse";
import type { OcrActionResult } from "@/lib/ocr/types";
```

and delete the whole `scanReceiptAction` function (from `export async function scanReceiptAction(` to its closing `}`). If `assertReceiptFile` is then unused in this file, drop it from the `@/lib/data/receipts` import.

- [ ] **Step 3: `src/lib/image/compress.ts`** — set constants and header comment:

```ts
// Client-only receipt compressor. Downscales + re-encodes to JPEG so the copy
// stored in R2 stays small (target < 200 KB) while staying a "true and clear"
// reproduction (ATO record-keeping rule). Also normalizes HEIC/PNG to JPEG via
// the canvas, so any camera output becomes cheap to store.
```

```ts
const TARGET_BYTES = 200 * 1024; // 200 KB
const START_QUALITY = 0.8;
```

Update the `// Returns a JPEG File under ~150 KB.` comment to `~200 KB`.

- [ ] **Step 4: `src/components/ExpenseForm.tsx`** — replace the scan flow with photo attach. Changes:

Imports: `import { createExpenseAction } from "@/lib/actions";` (drop `scanReceiptAction`).

Doc comment: `/** "Add an expense" card: receipt photo, fields, and add confirmation. */`

Replace the `// Scan state.` block with:

```ts
  // Receipt photo state.
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [preparing, startPrepare] = useTransition();
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
```

Rename the "Controlled OCR-target fields." comment to `// Controlled fields.`

In `resetForm`: replace `setScanMsg(null);` with `setPhotoMsg(null);`.

Replace `onFileChange` and `scanFile` with:

```ts
  /** Compresses the picked photo and swaps it into the form's file input. */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    setPhotoMsg(null);
    if (!original) {
      setHasFile(false);
      return;
    }
    startPrepare(async () => {
      let file: File;
      try {
        file = await compressReceipt(original);
      } catch {
        if (original.type === "image/heic") {
          // Chrome/Firefox can't decode HEIC; the server still accepts it, so keep the original.
          setHasFile(true);
          return;
        }
        // Clear the real input too, or submit would still upload the bad file.
        if (fileRef.current) fileRef.current.value = "";
        setHasFile(false);
        setPhotoMsg("Couldn't read that image — pick another receipt.");
        return;
      }
      // Store the small JPEG in R2, not the multi-MB camera original.
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileRef.current) fileRef.current.files = dt.files;
      setHasFile(true);
    });
  }
```

Replace the photo button block JSX with:

```tsx
        <div className="flex flex-col gap-2">
          <input ref={fileRef} name="receipt" type="file" accept="image/*" onChange={onFileChange} className="sr-only" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={preparing} className={`${btnSecondary} w-full md:w-auto md:self-start min-h-12`}>
            <CameraIcon size={20} />
            {preparing ? "Preparing photo…" : hasFile ? "Replace receipt photo" : "Add receipt photo"}
          </button>
          {hasFile && !preparing ? <p role="status" className="text-sm text-success">Receipt photo attached.</p> : null}
          {photoMsg ? <p role="status" className="text-sm text-muted">{photoMsg}</p> : null}
        </div>
```

Submit button: `disabled={pending || preparing}`.

- [ ] **Step 5: Config + docs**

- `cloudflare-env.d.ts`: delete the line `  AI: Ai;`.
- `wrangler.toml.example`: delete the `[ai]` and `binding = "AI"` lines (and the blank line before them).
- `.env.example`: delete the 3 lines starting `# Required only when the [ai] binding...` through `CLOUDFLARE_API_TOKEN=`.
- `docs/deploy-auto.md`: delete the table row `| OCR does nothing | Workers AI \`AI\` binding missing ... |`.
- `docs/deploy-ui.md`: delete the `| Workers AI | \`AI\` | Receipt OCR |` row and the `| OCR does nothing | ... |` row.

- [ ] **Step 6: Sweep for leftovers**

Run: `grep -rniE "ocr|scanReceipt|workers ai|\bAI\b binding|CLOUDFLARE_API_TOKEN" src docs README.md wrangler.toml.example .env.example cloudflare-env.d.ts | grep -v docs/superpowers`
Expected: only the `ocrRaw` legacy schema line (and its fixture). Fix any other hit.

- [ ] **Step 7: Verify**

Run: `corepack pnpm test && corepack pnpm build`
Expected: tests PASS, build succeeds. If the local gitignored `wrangler.toml` still has `[ai]`, remove it there too (not committed) — otherwise build demands a Cloudflare API token.

- [ ] **Step 8: Commit**

```bash
git add -A src docs cloudflare-env.d.ts wrangler.toml.example .env.example
git commit -m "feat(expenses)!: drop AI receipt OCR, photo only

BREAKING CHANGE: Workers AI binding no longer used; remove [ai] from
your wrangler.toml. Receipt photos compress to <200 KB."
```

---

### Task 7: ABN + tax-invoice UI and report warning

**Files:**
- Modify: `src/components/ExpenseForm.tsx`, `src/components/ExpenseRow.tsx`, `src/app/reports/page.tsx`

**Interfaces:**
- Consumes: `isValidAbn` (`@/lib/tax/abn`), form fields `abn` / `taxInvoice` (Task 4), `FyReport.bas.quarters[i].heldBackGstCents` / `needsTaxInvoice` (Task 5).
- Produces: expense rows carry `id="expense-<id>"` for report links.

- [ ] **Step 1: `ExpenseForm.tsx` fields**

Import: `import { isValidAbn } from "@/lib/tax/abn";`

State (with the other controlled fields):

```ts
  const [abn, setAbn] = useState("");
  const [taxInvoice, setTaxInvoice] = useState(false);
```

In `resetForm`: `setAbn(""); setTaxInvoice(false);`

After the Vendor `<label>`, add:

```tsx
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Seller ABN</span>
            <input
              name="abn"
              inputMode="numeric"
              value={abn}
              onChange={(e) => {
                setAbn(e.target.value);
                // A printed ABN usually means a tax invoice; the user can untick.
                if (isValidAbn(e.target.value)) setTaxInvoice(true);
              }}
              placeholder="11 digits"
              className={`${inputCls} font-mono`}
            />
            <FieldError message={errs.abn} />
          </label>
```

After the GST-free checkbox `<label>`, add:

```tsx
          <label className="col-span-2 flex min-h-11 w-fit cursor-pointer items-center gap-3 md:self-end">
            <input name="taxInvoice" type="checkbox" checked={taxInvoice} onChange={(e) => setTaxInvoice(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            <span className="text-[15px]">Receipt is a tax invoice (shows seller ABN + GST)</span>
          </label>
          {Number(amount) >= 1000 ? (
            <p className="col-span-2 md:col-span-4 text-sm text-muted">Tax invoice must also show your name or ABN.</p>
          ) : null}
```

- [ ] **Step 2: `ExpenseRow.tsx` edit form** — after the Vendor `<label>` in `ExpenseEditForm`:

```tsx
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Seller ABN</span>
          <input name="abn" inputMode="numeric" defaultValue={expense.abn ?? ""} className={`${inputCls} font-mono`} />
          <FieldError message={errs.abn} />
        </label>
```

Before the "Replace receipt" `<label>`:

```tsx
        <label className="col-span-2 md:col-span-1 flex min-h-11 cursor-pointer items-center gap-3">
          <input name="taxInvoice" type="checkbox" defaultChecked={expense.taxInvoice} className="size-5 accent-[var(--accent)]" />
          <span className="text-[15px]">Tax invoice held</span>
        </label>
```

(Required: without it, every edit would save `taxInvoice = false`.)

Anchors: the card `<li className="border-b border-rule">` becomes `<li id={`expense-${expense.id}`} className="border-b border-rule scroll-mt-24">`; the desktop non-editing `<tr>` becomes `<tr id={`expense-${expense.id}`} className="scroll-mt-24">`.

- [ ] **Step 3: `src/app/reports/page.tsx`** — import `humanDate` alongside `formatMoney`:
`import { formatMoney, humanDate } from "@/lib/format";`

Inside the BAS `<section>`, after the purchase-credit `<p>` block, add:

```tsx
          {report.bas.quarters
            .filter((q) => q.needsTaxInvoice.length > 0)
            .map((q) => (
              <div key={q.quarter} role="note" className="mx-5 mb-2 rounded-lg border border-line px-3 py-2 text-sm">
                <p className="font-medium">
                  {q.label}: {formatMoney(q.heldBackGstCents)} GST held back — {q.needsTaxInvoice.length} expense
                  {q.needsTaxInvoice.length === 1 ? "" : "s"} over $82.50 need a tax invoice (ATO rule).
                </p>
                <ul className="mt-1 text-muted">
                  {q.needsTaxInvoice.map((e) => (
                    <li key={e.id}>
                      <a href={`/expenses#expense-${e.id}`} className="underline">
                        {humanDate(e.date, { withYear: true })} · {e.vendor ?? "Unknown vendor"} · {formatMoney(e.amountInclCents)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
```

- [ ] **Step 4: Verify**

Run: `corepack pnpm test && corepack pnpm build`
Expected: PASS + build OK.

Manual (optional, needs local `wrangler.toml`): `corepack pnpm db:local && corepack pnpm db:seed && corepack pnpm dev` → add a $120 expense without tax invoice → `/reports` shows held-back note; tick "Tax invoice held" via edit → note disappears, credit rises. Typing `51 824 753 556` auto-ticks the checkbox; `51 824 753 557` → "Enter a valid 11-digit ABN."

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseForm.tsx src/components/ExpenseRow.tsx src/app/reports/page.tsx
git commit -m "feat(ui): ABN, tax-invoice flag, BAS held-back note"
```

---

## After all tasks

- Local-only (not committed): update `CLAUDE.md` — drop the Workers AI bullet and the `docs/ocr.md` map row; roadmap "Expenses/OCR" → "Expenses".
- Push branch, open PR, add to board (`gh project item-add`), review via `/code-review medium`.
