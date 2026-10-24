# Contributing

Thanks for your interest in Ginoo's Log Book — an open-source Australian car
logbook PWA for tax. This is a small, single-maintainer project; please keep
changes focused and read this first.

## Before you start

- **Open an issue** for anything beyond a trivial fix, so we agree on the
  approach before code is written.
- **Tax math is the correctness core.** Anything under `src/lib/tax/` is pure,
  unit-tested, and must be changed **test-first**. See [docs/domain-rules.md](docs/domain-rules.md).
- Read [docs/domain-rules.md](docs/domain-rules.md) for the domain rules and the security hard-rules.

## Local setup

Package manager is **pnpm via corepack** (`pnpm` may not be on your PATH):

```bash
corepack enable
corepack pnpm install
corepack pnpm dev        # http://localhost:3000
```

| Command | Purpose |
|---------|---------|
| `corepack pnpm test`  | Vitest — the tax-engine correctness gate |
| `corepack pnpm build` | Production build **and** the typecheck gate |
| `corepack pnpm lint`  | ESLint |
| `corepack pnpm knip`  | Unused files / exports / dependencies |
| `corepack pnpm exec tsc --noEmit` | Typecheck only |

## Making a change

1. Branch off `main`: `feat|fix|chore/<slug>` (direct pushes to `main` are blocked).
2. Keep money as **integer cents** and dates as **ISO `YYYY-MM-DD`** everywhere
   except the UI edge. See [docs/domain-rules.md](docs/domain-rules.md).
3. Add or update tests. For tax logic, write the failing test first.
4. Run `corepack pnpm lint`, `corepack pnpm knip`, `corepack pnpm test` and `corepack pnpm build` locally.
5. Open a PR. CI (**Test + Build**), **CodeQL**, and **gitleaks** must pass; the
   PR template checklist must be satisfied. Squash-merge only.

## Security & privacy (hard rules)

The repo is **public**. Never commit secrets, `account_id`/`database_id`,
personal data, or receipt images — only `*.example` config with placeholders.
Push protection and gitleaks will block a leak, but don't rely on them.

Found a vulnerability? Do **not** open a public issue — see [SECURITY.md](SECURITY.md).

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`chore:`, `docs:`, `test:`, `refactor:`. Keep the subject ≤ 50 chars; explain
*why* in the body when it isn't obvious.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please).

- **PR titles drive the changelog.** PRs are squash-merged, so the PR title
  (Conventional Commits, checked by `pr-title.yml`) becomes the commit on `main`.
  `feat:`, `fix:`, `perf:`, `refactor:` and `docs:` appear in `CHANGELOG.md`;
  `chore:`, `ci:`, `test:`, `build:` and `style:` are hidden. Use `feat!:` or a
  `BREAKING CHANGE:` footer for breaking changes.
- **A Release PR stays open.** release-please keeps one PR that bumps
  `package.json` and updates `CHANGELOG.md`.
- **Before merging it**, the maintainer hand-edits a **Before you upgrade**
  section into the Release PR body and `CHANGELOG.md` for anything users must
  know: migrations, data effects, required manual steps, backup advice.
- **Merging the Release PR** creates the `vX.Y.Z` tag and GitHub Release.
  It does **not** deploy. Deploying is a separate step: move the `release`
  branch to the new tag as described in [docs/deploy-auto.md](docs/deploy-auto.md).

### One-time setup (maintainer)

PRs opened with the default `GITHUB_TOKEN` don't trigger CI, so the Release PR
could never pass the required checks. Use a PAT instead:

1. Create a **fine-grained personal access token**: repository access = only
   this repo; permissions **Contents: Read and write** and
   **Pull requests: Read and write**.
2. Save it as the repository secret **`RELEASE_PLEASE_TOKEN`**
   (Settings, Secrets and variables, Actions).

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
