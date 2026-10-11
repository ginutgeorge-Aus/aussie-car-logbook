# Ginoo's Log Book security guidance

Threat model: **public repo, private data.** Each user self-hosts one deployment holding their own tax records and receipt photos. Detailed checklists live in `.claude/rules/security.md` (code) and `.claude/rules/cloudflare.md` (secrets/bindings); this file is the summary.

## Auth boundary

- Cloudflare Access gates the entire hostname. No in-app auth, roles, or sessions — never add a route or action that bypasses Access (see `.claude/rules/auth.md`).
- Inside the gate everything is "the owner", so focus on **injection, XSS, and data leakage**, not authorisation.

## Never commit

- Secrets, Cloudflare `account_id` / `database_id`, API tokens.
- Real personal data: names, regos, ABNs, addresses, odometer logs, receipt images.
- Local config: `.dev.vars`, `wrangler.toml`, `.env*`, `.wrangler/`, `.open-next/`. Commit only `*.example` with placeholders. gitleaks blocks leaks in CI.

## Receipts (R2)

- Upload allowlist: JPEG/PNG/WebP/HEIC, ≤10 MB, checked before reading the body. No SVG (stored XSS).
- Keys are server-generated (`receipts/<vehicleId>/<uuid>.<ext>`); the serving route only reads the `receipts/` prefix and responds with `nosniff` + sandbox CSP.
- Deleting an expense deletes its receipt object.

## Untrusted inputs

- **FormData** → always through a pure `parse*Form` (bounds, ISO dates, integer cents).
- **OCR model output** → always through `parseOcrResult()`; it only pre-fills the form, the user confirms.
- No raw SQL (`sql.raw`, `env.DB.prepare`) — Drizzle builders only (semgrep `glb-no-raw-sql`).
- No `dangerouslySetInnerHTML`. Future CSV exports: prefix `=`, `+`, `-`, `@` cells with `'`.

## Data integrity

- Migrations forward-only and non-destructive — users' existing D1 data must survive every upgrade.
- Destructive remote ops (`wrangler d1 execute --remote` with DROP/DELETE, `wrangler d1 delete`, R2 deletes) are blocked by `.claude/hooks/guard-bash.js` — confirm with the user.
