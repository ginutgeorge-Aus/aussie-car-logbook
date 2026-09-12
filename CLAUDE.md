# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

**Ginoo's Log Book** — open-source PWA: an Australian car logbook for tax. Captures vehicle + fuel expenses with receipt photos, tracks a 12-week logbook to derive business-use %, and produces quarterly BAS (GST credit) and annual income-tax deduction reports. Public on GitHub; each user self-hosts their own copy on Cloudflare.

## Commands

Package manager is **pnpm, invoked via corepack** (`pnpm` is not always on PATH):

| Command | Purpose |
|---------|---------|
| `corepack pnpm dev` | Run app locally (:3000) |
| `corepack pnpm build` | Production build (also the CI + typecheck gate) |
| `corepack pnpm test` | Vitest — the tax-engine correctness gate |
| `corepack pnpm test <path>` | Run one test file (e.g. `... test src/lib/tax/dates.test.ts`) |
| `corepack pnpm test -t "<name>"` | Run tests matching a name |
| `corepack pnpm exec tsc --noEmit` | Typecheck only |
| `corepack pnpm drizzle-kit generate` | Generate a D1 migration from schema |
| `corepack pnpm db:local` / `db:seed` | Apply migrations + fake seed to local D1 |

## Architecture

Next.js 16 (App Router) → **Cloudflare Pages** via `@opennextjs/cloudflare`. Bindings:
- **D1** (SQLite) — data, via **Drizzle ORM** (not Prisma). Schema: `src/db/schema.ts`.
- **R2** — receipt images (object key stored on the expense row).
- **Workers AI** — receipt OCR (vision → pre-fill the expense form).
- **Cloudflare Access** — auth gate (free, Google/email-OTP). Single user per deployment; no in-app auth code.

Tax math lives in `src/lib/tax/` as **pure, unit-tested functions** — no I/O, no DB. This is the correctness core; change it test-first.

## Domain rules (get these right)

- **Money is integer cents everywhere** in DB + tax functions. Dollars only at the UI edge.
- **Dates are ISO `YYYY-MM-DD` text.** Australian FY = 1 Jul–30 Jun. BAS quarters: Q1 Jul-Sep, Q2 Oct-Dec, Q3 Jan-Mar, Q4 Apr-Jun.
- **Tax method: ATO logbook only.** `businessPct = businessKm / totalKm`.
- **GST-registered:** GST = 1/11 of GST-inclusive amount (rounded). Income-tax deduction uses GST-**exclusive** amounts (GST is recovered via BAS); the app tracks GST per receipt and reports BAS credit = `businessPct × ΣGST`.
- **Car depreciation cost limit** is a per-FY constant (`src/lib/tax/depreciation.ts`) — update yearly from the ATO, never hard-code into logic.

## Security / open-source hygiene (hard rule)

Repo is public. **Never commit** secrets, `account_id`/`database_id`, personal data, or receipt images. Commit only `*.example` config with placeholders. `.dev.vars`, `wrangler.toml`, `.env*`, `.wrangler/`, `.open-next/` are gitignored. Seed data is fictional.

## Git / release model

- `main` = dev. **Git tags + GitHub Releases** = stable versions; users deploy a tagged release, not `main`.
- Real tax data lives only in the user's own D1/R2 — never in the repo.
- **Drizzle migrations are versioned, forward-only, non-destructive** (data survives upgrades). Add a backup step before a major upgrade.
- Work on a `feat|fix|chore/<slug>` branch (a guard hook blocks direct edits on the default branch).

## Where things live

| Path | What |
|------|------|
| `docs/superpowers/plans/` | Implementation plans (Plan 1 = foundation + tax engine) |
| `src/lib/tax/` | Pure tax functions + colocated `*.test.ts` |
| `src/db/schema.ts`, `src/db/migrations/` | Drizzle schema + generated SQL |
| `.superpowers/sdd/progress.md` | Subagent-driven execution ledger (git-ignored scratch) |
| `.claude/rules/` | Path-scoped rules (being adapted from the Prisma template to Drizzle/D1) |

Slice roadmap: Foundation+TaxEngine → Vehicles/Logbook UI → Expenses/OCR → Reports → Auth → PWA polish → Release infra.
