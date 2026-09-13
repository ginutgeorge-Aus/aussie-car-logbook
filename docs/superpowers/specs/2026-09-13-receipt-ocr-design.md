# Slice 3b — Receipt OCR (Workers AI) — Design

**Date:** 2026-09-13
**Depends on:** Slice 3a (Expenses & Receipts) — merged (`eff0f16`, `867b35e`).
**Goal:** Let the user photograph/upload a receipt and have Workers AI vision pre-fill
the expense form (date, amount, GST, vendor, category). The human reviews and edits
every field before saving. OCR is a convenience, never an authority — no AI value is
persisted without user confirmation.

## Scope

In:
- Explicit **"Scan receipt"** button in `ExpenseForm`.
- Server action that runs Workers AI vision on the picked image and returns extracted fields.
- Pure, unit-tested parser that normalizes raw AI output into typed, safe values.
- `AI` binding wired into env types; local-dev + build gotcha documented.

Out (not this slice):
- OCR on the edit/inline-edit row (`ExpenseRow`) — add later if wanted; create form only for 3b.
- Auto-scan on file select — deliberately rejected (cost + surprise). Explicit button only.
- Multi-receipt / batch scan.
- Storing OCR confidence or raw AI text in the DB.

## Flow

```
ExpenseForm (client):
  user picks receipt file → taps [Scan receipt]
    → scanReceiptAction(FormData{ receipt: File })   [server action]
        → validate type + size (reuse receipts.ts guards)
        → file.arrayBuffer() → runReceiptOcr(bytes)   [env.AI.run(...)]
        → parseOcrResult(rawJson) → OcrResult
        → return { ok:true, value: OcrResult } | { ok:false, error }
    → on ok: client sets controlled form fields (date/amount/gst/vendor/category)
    → user reviews + edits → [Add expense]  (createExpenseAction — UNCHANGED)
```

Key property: **the scan does NOT write to R2.** R2 upload still happens only inside
`createExpenseAction` on final save (existing behaviour). This avoids orphaned R2 objects
when a user scans but abandons the form. The same `File` is used for both scan and, on
submit, upload — the file input is not cleared by scanning.

## Components / units

Pure (unit-tested, no I/O — the correctness surface, written test-first):

- `src/lib/ocr/types.ts`
  - `OcrResult = { dateISO: string | null; amountInclCents: number | null;
    gstCents: number | null; vendor: string | null; category: ExpenseCategory | null }`
  - `OcrActionResult = { ok: true; value: OcrResult } | { ok: false; error: string }`
- `src/lib/ocr/prompt.ts` — `buildReceiptPrompt(): string`. Returns the instruction that
  tells the model to return **only** JSON with a fixed shape (keys: `date`, `total`,
  `gst`, `vendor`, `category`; category one of the known codes or `null`; dates as printed).
- `src/lib/ocr/parse.ts` — `parseOcrResult(raw: unknown): OcrResult`. The workhorse:
  - Tolerates the model wrapping JSON in prose / code fences → extract first `{...}` block.
  - `date`: accept `DD/MM/YYYY`, `D/M/YY`, `YYYY-MM-DD`, `DD-MM-YYYY`, `DD Mon YYYY`.
    **Australian order: day-first.** Ambiguous/unparseable → `null`. Never guess the year.
  - `total`/`gst`: strip `$`, commas, spaces → cents via existing `dollarsToCents`.
    Non-numeric → `null`. `gst` > `total` → clamp to `total`. Negative → `null`.
  - `vendor`: trim; empty/`"null"`/overlong (>120 chars) → `null`.
  - `category`: lowercase, map to a valid `ExpenseCategory` via `isExpenseCategory`, else `null`.
    (`depreciation` is computed, never an OCR output — excluded even if returned.)
  - Unknown/extra keys ignored. Malformed or empty input → all-`null` `OcrResult` (never throws).

Impure (thin I/O wrappers):

- `src/lib/data/ocr.ts` — `runReceiptOcr(bytes: Uint8Array): Promise<unknown>`.
  Calls `env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", { image: [...bytes], prompt })`
  via `getCloudflareContext`. Returns the raw model response (a `.response` string or object)
  for `parseOcrResult` to handle. Throws on binding-missing / model error — caller catches.
- `scanReceiptAction(_prev, fd)` in `src/lib/actions.ts` — glue:
  - Pull `receipt` File from FormData; if absent → `{ ok:false, error:"Pick a receipt first." }`.
  - Reuse `receipts.ts` type/size validation (extract a shared `assertReceiptFile(file)` helper
    so `putReceipt` and `scanReceiptAction` share one allowlist — no drift).
  - HEIC (`image/heic`): return `{ ok:false, error:"Scan isn't available for HEIC images — enter details manually." }`.
    Workers AI vision expects jpeg/png/webp; upload+save of HEIC still works.
  - `try { runReceiptOcr → parseOcrResult } catch → { ok:false, error:"Couldn't read the receipt. Enter details manually." }`.

Client:

- `ExpenseForm.tsx` — becomes fully controlled for the OCR-target fields
  (date, amount, gst, vendor, category; today it's a mix of `defaultValue`/`useState`).
  Add a `[Scan receipt]` button next to the file input:
  - disabled until a file is picked; disabled + "Scanning…" while pending.
  - calls `scanReceiptAction` (via a small `useState`/transition, not the form's own action).
  - on `ok`: set each non-null field from `OcrResult`; leave nulls as-is (don't wipe user input).
  - on `!ok`: show a non-blocking inline note; form remains manual.
  - a short helper line: "AI-filled — check every field before saving."

## Binding / config

- `cloudflare-env.d.ts`: add `AI: Ai;` to `CloudflareEnv` (replace the "add in 3b" comment).
- Local dev: the `[ai]` binding in the gitignored `wrangler.toml` forces
  `CLOUDFLARE_API_TOKEN` at build via `initOpenNextCloudflareForDev` (known from
  vehicles-slice T2 note). Document in:
  - `.dev.vars.example` — add `CLOUDFLARE_API_TOKEN=` placeholder + comment.
  - `docs/ocr.md` (new, short) — how to enable the AI binding locally, the token requirement,
    and that CI/committed repo is unaffected (`wrangler.toml` gitignored).
- No new secret is committed. Repo-public hygiene unchanged.

## Error handling / degradation

| Case | Behaviour |
|------|-----------|
| No file picked | Scan button disabled; action guards anyway. |
| HEIC file | Scan blocked with clear message; manual entry + save still work. |
| AI binding missing / model error / timeout | `{ok:false}` → inline note; form fully manual. |
| Model returns junk / non-JSON | `parseOcrResult` yields all-`null`; note "couldn't read fields". |
| Partial extraction | Fill the fields we got; leave the rest for the user. |

OCR never blocks or auto-submits. The existing manual flow is the fallback for every failure.

## Testing

`src/lib/ocr/parse.test.ts` (Vitest — the gate):
- AU date formats → ISO; ambiguous → null; no year-guessing.
- `$1,234.50` / `1234.5` / `"12.00"` → correct cents; junk → null.
- GST > total → clamped; negative → null; GST absent → null (form auto-computes on save).
- category: valid code passes; `"Fuel"`/`"FUEL"` normalize; unknown → null; `depreciation` → null.
- JSON wrapped in ```` ```json ```` fence / prose → still parsed.
- empty string / `null` / array / missing keys → all-null result, no throw.

`prompt.ts` — trivial snapshot/contains test (mentions JSON + the category codes).
No live-AI unit test (`runReceiptOcr` is a live-binding wrapper, verified manually in dev).

## Non-goals / risks

- Vision accuracy varies by receipt quality — acceptable because the human verifies. No SLA.
- Token/cost: one model call per explicit tap. Bounded by the button (no auto-fire).
- HEIC from iOS camera is a real gap; deferred (convert-on-device or server transcode is a
  later slice if it becomes painful).
