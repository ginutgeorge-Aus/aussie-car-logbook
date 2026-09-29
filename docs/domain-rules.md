# Domain rules

Rules every change must respect. Tax math is unit-tested and changed **test-first**.

## Money, dates & tax

- **Money is integer cents everywhere** in DB + tax functions. Dollars only at the UI edge.
- **Dates are ISO `YYYY-MM-DD` text.** Australian FY = 1 Jul–30 Jun. BAS quarters: Q1 Jul-Sep, Q2 Oct-Dec, Q3 Jan-Mar, Q4 Apr-Jun.
- **Tax method: ATO logbook only.** `businessPct = businessKm / totalKm`.
- **GST-registered:** GST = 1/11 of GST-inclusive amount (rounded). Income-tax deduction uses GST-**exclusive** amounts (GST is recovered via BAS); the app tracks GST per receipt and reports BAS credit = `businessPct × ΣGST`.
- **Car depreciation cost limit** is a per-FY constant (`src/lib/tax/depreciation.ts`) — update yearly from the ATO, never hard-code into logic.

## Security / open-source hygiene (hard rule)

Repo is public. **Never commit** secrets, `account_id`/`database_id`, personal data, or receipt images. Commit only `*.example` config with placeholders. `.dev.vars`, `wrangler.toml`, `.env*`, `.wrangler/`, `.open-next/` are gitignored. Seed data is fictional.
