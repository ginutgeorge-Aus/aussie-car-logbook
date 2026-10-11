---
paths:
  - "src/app/**/route.ts"
  - "src/app/receipt/**"
  - "src/lib/actions.ts"
  - "src/lib/data/receipts.ts"
  - "src/lib/data/ocr.ts"
  - "src/lib/ocr/**"
---

# Security checklist

Public repo, private data. Secrets/commit hygiene → `.claude/rules/cloudflare.md`; auth model → `.claude/rules/auth.md`.

**Receipts (R2)**
- Upload: `assertReceiptFile()` — raster allowlist (JPEG/PNG/WebP/HEIC) + 10 MB cap, checked **before** `arrayBuffer()`. Never add SVG/HTML/PDF without sandboxed serving.
- Keys are server-generated `receipts/<vehicleId>/<uuid>.<ext>` — never trust a client-supplied key on write.
- Serving (`src/app/receipt/[...key]/route.ts`): keep the `receipts/` prefix check, `X-Content-Type-Options: nosniff`, sandbox CSP, `Cache-Control: private`. Content-Type only from stored metadata.
- Deleting an expense must delete its R2 object (no orphaned personal data).

**OCR (Workers AI)**
- Model output is **untrusted input**: run it through `parseOcrResult()` (clamps, validates, cents) — never write raw model text to D1 or render it as HTML.
- OCR only pre-fills the form; the user submits, and the normal `parse*Form` path validates.

**Forms / actions**
- Every field via a `parse*Form` with bounds (non-negative ints, valid ISO dates, max string length).
- Integer ids: `Number.isInteger(id)` guard before writes.

**Output**
- No `dangerouslySetInnerHTML`. Any future CSV export: prefix cells starting `=`, `+`, `-`, `@` with `'` (formula injection).
- Error messages returned to the client must not include stack traces or binding names.
