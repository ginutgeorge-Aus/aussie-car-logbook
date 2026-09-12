---
paths:
  - "e2e/**"
  - "playwright.config.ts"
---

# E2E Testing (Playwright)

Specs in `e2e/*.spec.ts`; config `playwright.config.ts`. Real browser against a real built app + real DB — complements Jest unit tests, doesn't replace them.

- **Separate DB, force-reset**: `e2e/global-setup.ts` runs `prisma db push --force-reset` then seeds, **once** before the suite. Point `DATABASE_URL` at a dedicated `stmark_e2e` DB — never your dev DB. Copy `.env.e2e.example` → `.env.e2e` and source it.
- **Use a real Postgres for local full-suite runs, not the `prisma dev` daemon.** The daemon recycles idle pooled connections server-side faster than the app's default `pg.Pool` idle timeout (`src/lib/prisma.ts`), so the app can hand out a dead connection mid-suite. Symptom: a *different, random* spec fails each run, the server log shows `Connection terminated unexpectedly` (`pg-pool/index.js`), and login specs see a valid password rejected because the `findUnique` query died on the pool — not bad creds or lockout. CI (self-hosted, vanilla `postgres:16` on :5432) doesn't exhibit this. Point the `stmark_e2e` DB at `npm run db:start` (Docker) or any always-on Postgres when reproducing a "flaky" full-suite failure locally — rule this out before chasing the failing spec (#1875).
- **Prod guard**: `global-setup.ts` refuses to run unless the URL looks like a local/test DB — guards against nuking prod. Keep the guard's allowlist current when host patterns change.
- **`webServer` runs `npm run start`** (not `dev`) → must `npm run build` first. Locally `reuseExistingServer` is on; CI builds fresh. Server env injected by config: `DISABLE_OTP=true`, `E2E_MOCK_EMAIL=true` (no real Gmail send), plus `DATABASE_URL`/`ENCRYPTION_KEY`/`AUTH_SECRET` from your shell.
- **Serial**: `workers: 1`, `fullyParallel: false` — specs share one DB, order matters. CI retries 2×, trace on first retry.
- Helpers in `e2e/helpers/`. CI runs the suite as a separate job after build (see `.github/workflows/ci.yml`).
- **Two recurring locator traps (strict-mode `resolved to N elements`), both cosmetic — the app is usually behaving correctly:**
  - **`getByRole("alert")` also matches Next's route announcer.** Next injects a permanent empty `<div role="alert" id="__next-route-announcer__">`, so a bare `getByRole("alert")` for a page-level error resolves to 2 elements. Narrow it: `getByRole("alert").filter({ hasText: "…" })`. (Alerts scoped inside a container — e.g. `getByRole("alertdialog").getByRole("alert")` — are unaffected; the announcer is top-level.)
  - **Seed emails are substrings of each other.** `getByRole("row", { name: /admin@stmark\.com/ })` also matches `officeadmin@stmark.com`. Anchor the distinguishing token with `\b` (`/\badmin@stmark\.com/`) or use the exact accessible name.
  - **App Router double-render transiently duplicates a row/control.** A client transition can briefly render two copies of the same node (a form row, heading, or toggle), so a locator that scoped by structure (`form.filter({ has: … }).filter({ hasText: … })`) or a bare `getByLabel`/`getByRole` resolves to 2. Scope to the unique accessible name and pin the live copy: `getByRole(…, { name }).filter({ visible: true }).first()` (#2258, #1341, #1340).
