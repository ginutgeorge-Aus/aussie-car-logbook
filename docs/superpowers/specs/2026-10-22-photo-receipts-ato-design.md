# Photo-only receipts + ATO tax-invoice compliance — design

Date: 2026-10-22 · Status: approved

## Goal

Drop AI receipt scanning (Workers AI OCR). The user photographs the receipt; the app stores the
photo (R2) and the user enters the fields. Add the data the ATO needs to justify GST credits on BAS.

## ATO rules this design follows

| Rule | Source |
|------|--------|
| Digital images of paper receipts are accepted if they are a **true and clear reproduction**; paper can then be discarded. EFTPOS slips fade — image them. | [Digital record keeping](https://www.ato.gov.au/business/record-keeping-for-business/setting-up-and-managing-records/business-record-keeping-systems/digital-record-keeping/) |
| Entering details in software is not enough — a copy of the actual record must be kept. | same |
| Keep records **5 years** (from lodgment/due date). Logbook valid 5 years. | [Motor vehicle and car expenses](https://www.ato.gov.au/api/public/content/0-27f25397-ff76-467b-9b9a-90c639267d0e) |
| A **tax invoice** is required to claim a GST credit on a purchase **> $82.50 incl. GST**. Must show seller identity, **seller ABN**, date, description, GST amount (or "total includes GST"), extent taxable. | [Tax invoices](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices) |
| Purchases **≥ $1,000 incl. GST**: invoice must also show the buyer's identity or ABN. | same |
| ≤ $82.50: any receipt/docket is enough evidence for the credit. | same |
| Logbook method: fuel/oil may be estimated from odometer readings; other car expenses need receipts. | [Logbook method](https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/logbook-method) |

## 1. Remove OCR

- Delete `src/lib/ocr/*` (incl. tests), `src/lib/data/ocr.ts`, `scanReceiptAction` and its imports in
  `src/lib/actions.ts`, `docs/ocr.md`.
- Remove the `[ai]` binding from `wrangler.toml.example`, the `CLOUDFLARE_API_TOKEN` note in
  `.env.example`, any `AI` entry in `CloudflareEnv` types (re-run `cf-typegen`), and the `docs/ocr.md`
  row in `CLAUDE.md`.
- `ExpenseForm`: the "Scan receipt" button becomes **"Add receipt photo"** — pick/take photo → compress →
  thumbnail preview + "Replace photo". No pre-fill, no scan state.
- `ocr_raw` DB column: **kept** (forward-only, non-destructive migrations); removed from the Drizzle
  schema and no longer written.

## 2. Photo

- `src/lib/image/compress.ts`: `TARGET_BYTES = 200 * 1024`, `START_QUALITY = 0.8`. Other constants
  and the step-down loop unchanged.
- Upload to R2 on save as today; `expense.receiptKey` keeps the object key. HEIC fallback unchanged
  (original kept when the browser can't decode it).

## 3. Schema (new Drizzle migration)

- `abn text` — nullable. Stored as 11 digits, no spaces.
- `tax_invoice integer` (boolean mode) — NOT NULL, default `0`.
- **Backfill:** migration sets `tax_invoice = 1` on all existing rows so prior expenses keep their
  credit after upgrade.

## 4. Form

- New **ABN** field (optional). Input accepts spaces; normalised to digits; validated with the ATO
  ABN checksum (subtract 1 from first digit, weights `10,1,3,5,7,9,11,13,15,17,19`, sum mod 89 = 0).
  Invalid → field error, no save.
- New checkbox **"Receipt is a tax invoice (shows seller ABN + GST)"**. Auto-ticks when a valid ABN is
  entered; user can untick.
- Hint when amount ≥ $1,000: "Tax invoice must also show your name or ABN."
- Server action validates ABN again (never trust client).

## 5. Tax engine (pure, test-first — `src/lib/tax/`)

- New `gstCreditEligible({ amountInclCents, gstCents, taxInvoice })`:
  `gstCents === 0 || amountInclCents <= 8250 || taxInvoice`.
- `TAX_INVOICE_THRESHOLD_CENTS = 8250` as a named constant.
- `gstCredit` sums only eligible expenses. Ineligible expenses' business-share GST is reported as
  **held back**.
- ABN checksum lives in `src/lib/tax/abn.ts` (pure).
- Income-tax deduction unchanged (GST-exclusive): the credit entitlement still exists, it's just
  not claimable on BAS until the invoice is held.

## 6. Report (`buildFyReport`)

- Each BAS quarter gains `heldBackGstCents` and `needsTaxInvoice: Array<{ id, date, vendor, amountInclCents }>`.
- Report UI shows per quarter: "Held back: $X GST — N expense(s) need a tax invoice" with the list
  linking to each expense for editing.
- Ticking the flag later moves the credit into that expense's own quarter (quarter is by expense date).

## 7. Testing

- `gstCreditEligible`: boundaries 8250 (eligible), 8251 without invoice (held), 8251 with invoice,
  GST-free.
- `abn.ts`: valid ABN, wrong checksum, wrong length, spaces normalised.
- `buildFyReport`: held-back totals and list per quarter; credit excludes held items.
- Remove OCR tests. `corepack pnpm test` + `build` green.

## Out of scope

- Storing images in D1 · checking buyer ABN on invoices ≥ $1,000 (hint only) · fuel estimation
  from odometer · retention/deletion policy UI.
