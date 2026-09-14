# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Users deploy tagged releases, not `main`.

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

[0.1.0]: https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases/tag/v0.1.0
