# About: version, last updated, changelog, report issue — design

**Goal:** a self-hoster can see which version their deployed copy runs, when it
was last built/deployed, read what changed, and file an issue upstream.

## Build-time values

`next.config.ts` sets `env`:

- `APP_VERSION` — `version` from `package.json`.
- `BUILD_TIME` — ISO timestamp taken when `next build` runs. On Workers Builds
  that is the deploy time of the user's copy ("last updated").

Both are inlined at build; no DB, no runtime fetch, no secret.

## `src/lib/about.ts` (pure, unit-tested)

- `REPO_URL` — `https://github.com/ginutgeorge-Aus/aussie-car-logbook` (upstream).
- `changelogUrl()` → `${REPO_URL}/releases`.
- `issueUrl(version)` → `${REPO_URL}/issues/new?template=bug_report.yml&version=v<version>`
  (pre-fills the bug form's `version` field; value URL-encoded).
- `formatUpdated(iso)` → `en-AU` date in `Australia/Sydney`, e.g. `24 Oct 2026`;
  invalid/missing input → `"unknown"`.

## UI

- **Settings → About** card (`id="about"`) below the settings form: Version,
  Updated, links "Changelog" and "Report an issue" (`target="_blank"`,
  `rel="noopener noreferrer"`).
- **Footer** in the root layout, every page: muted `v0.4.0 · About` linking to
  `/settings#about`; sits above the phone tab bar.

## Out of scope

In-app CHANGELOG rendering; "update available" check against GitHub.

## Done

`corepack pnpm test` green incl. `about.test.ts`; `corepack pnpm build` green;
local dev screenshot shows About card + footer.
