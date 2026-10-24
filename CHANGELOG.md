# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Users deploy tagged releases, not `main`.

## [0.4.0] — 2026-10-24

ATO logbook compliance release. Every rule is cited in `docs/ato-rules.md`.

### ⚠️ Before you upgrade
- **Back up first.** Note a D1 Time Travel bookmark before deploying
  (`wrangler d1 time-travel info ginoos-log-book`); to roll back, run
  `wrangler d1 time-travel restore ginoos-log-book --bookmark=<bookmark>`.
  Migrations `0002`–`0007` only add columns and tables; no data is removed.
- **Existing logbook periods become invalid until you enter their start and
  end odometer readings** (#49). Until then the income-tax car deduction is
  **$0** and the report says why. BAS GST credits use the business % from
  that year's trips instead of the logbook %, so they can change.
- **Existing vehicles lose the assumed 1/11 GST credit on the car purchase
  until you enter the GST from the tax invoice** (#46). Enter `0` for a
  private sale.

### Added
- Logbook period odometer readings set total km (#49).
- Odometer readings at the start (1 Jul) and end (30 Jun) of each income
  year, with a report notice when one is missing (#51).
- Business trips need a reason; trips can have an end date (#50).
- Logbooks that cross 30 June: nominate the income year, and edit it later (#45, #68).
- Recorded car-purchase GST instead of an assumed 1/11 (#46).
- Per-vehicle effective life override for depreciation (#66).
- Engine capacity on the vehicle (#76).
- Printable ATO logbook summary at `/trips/logbook/[id]` (#53).

### Changed
- No valid logbook → no income-tax car deduction (#52).
- Held-back GST stays out of the income-tax deduction; documented (#67).
- One car-purchase eligibility rule shared by depreciation and GST (#69).

### Fixed
- Expense edit form: ABN auto-tick and the $1,000 hint (#60).
- Field errors are linked to their inputs for screen readers (#57).

## [0.3.0] — 2026-10-22

### Added
- Photo-only receipts, and ATO tax-invoice GST hold-back: seller ABN and a
  tax-invoice flag gate BAS GST credits over $82.50 (#59).

## [0.2.0] — 2026-10-22

### Added
- Settings screen for GST registration and ABN (#32).
- "Odometer" UI redesign: app shell, dark/light tokens, mobile cards (#33).

### Fixed
- Business % now comes from a valid logbook period (#36).
- GST-exclusive depreciation and ATO car cost limits (#37).
- Rounding, GST validation and BAS gating (#38).
- PWA install behind Cloudflare Access, manifest id, template assets removed (#35).

### Changed
- Node.js 22+ is required (#56).
- Dependency updates (Next, React, Cloudflare, TypeScript 6).

## [0.1.3] — 2026-10-21

### Fixed
- Deploy: use `wrangler deploy` in CI, not `opennext` (#48).

## [0.1.2] — 2026-10-21

### Added
- Non-technical user manual in the wiki, with auto-sync (#15).
- Dashboard deploy guide; Workers Builds deploy with migrations on deploy (#17, #20).

### Fixed
- Forms keep input on error, reset on save, and confirm delete (#29).
- Receipts: one-tap scan, compression, OCR fixes (#19).

### Changed
- Docs: AI-coded attribution and early-stage caveats (#16); deploy gotchas (#18).
- CI: workflow write tokens scoped to job level (#34); link check excludes
  Cloudflare and localhost URLs (#42).

## [0.1.1] — 2026-09-15

Deploy-flow fixes — v0.1.0 could not be deployed by following the README from a
clean clone. No app/runtime behaviour changed.

### Fixed
- **D1 migrations not found on deploy** — `wrangler.toml.example` lacked
  `migrations_dir`, so `pnpm db:remote` looked in the default `./migrations`
  and failed with "No migrations present". Now points at `src/db/migrations`.
- **Production build demanded `CLOUDFLARE_API_TOKEN`** — `next.config.ts` ran
  `initOpenNextCloudflareForDev()` unconditionally, so `next build` (run
  non-interactively by `pnpm deploy`) opened a remote connection for the `[ai]`
  binding and aborted. It now runs only under `next dev`.
- **README deploy steps** — added the initial `wrangler login` step and an
  explicit "set `database_id`" note.

## [0.1.0] — 2026-09-14

First public base release. An Australian car logbook PWA using the ATO logbook
method, self-hosted on Cloudflare.

### Added
- **Tax engine** (`src/lib/tax/`) — pure, unit-tested functions for logbook
  business-use %, GST (1/11), income-tax deduction, and the per-FY car
  depreciation cost limit. Money is integer cents; dates are ISO `YYYY-MM-DD`.
- **Vehicles** — add/edit vehicles.
- **Logbook / trips** — record trips per financial year; business-use % is
  derived from business vs total km.
- **Expenses + receipts** — capture fuel and vehicle expenses with receipt
  images stored in R2, and **Workers AI OCR** to pre-fill the expense form.
- **Reports** — quarterly BAS (GST credit) and annual income-tax deduction with
  depreciation, aggregated by `buildFyReport` (`src/lib/reports/`); printable.
- **PWA** — web app manifest, maskable icons, and an offline-shell service
  worker; installable to the home screen.
- **Deploy** — OpenNext → Cloudflare Workers config (`open-next.config.ts`,
  `wrangler.toml.example`) with D1, R2, and Workers AI bindings; `pnpm deploy`
  / `preview` scripts and a documented setup flow.
- **Auth** — delegated to Cloudflare Access (no in-app auth); setup documented.

[0.4.0]: https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases/tag/v0.4.0
[0.3.0]: https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases/tag/v0.3.0
[0.2.0]: https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases/tag/v0.2.0
[0.1.3]: https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases/tag/v0.1.3
[0.1.2]: https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases/tag/v0.1.2
[0.1.1]: https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases/tag/v0.1.1
[0.1.0]: https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases/tag/v0.1.0
