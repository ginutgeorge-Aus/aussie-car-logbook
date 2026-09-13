# Contributing

Thanks for your interest in Ginoo's Log Book — an open-source Australian car
logbook PWA for tax. This is a small, single-maintainer project; please keep
changes focused and read this first.

## Before you start

- **Open an issue** for anything beyond a trivial fix, so we agree on the
  approach before code is written.
- **Tax math is the correctness core.** Anything under `src/lib/tax/` is pure,
  unit-tested, and must be changed **test-first**. See `CLAUDE.md` → *Domain rules*.
- Read `CLAUDE.md` for architecture, domain rules, and the security hard-rules.

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
| `corepack pnpm exec tsc --noEmit` | Typecheck only |

## Making a change

1. Branch off `main`: `feat|fix|chore/<slug>` (direct pushes to `main` are blocked).
2. Keep money as **integer cents** and dates as **ISO `YYYY-MM-DD`** everywhere
   except the UI edge. See *Domain rules* in `CLAUDE.md`.
3. Add or update tests. For tax logic, write the failing test first.
4. Run `corepack pnpm test` and `corepack pnpm build` locally.
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
