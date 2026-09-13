<!-- Keep PRs focused. Link the issue this closes. -->

## What & why

Closes #

<!-- What does this change and why? -->

## Checklist

- [ ] Branch is `feat|fix|chore/<slug>`, off `main`
- [ ] `corepack pnpm test` passes
- [ ] `corepack pnpm build` passes (typecheck gate)
- [ ] Tax logic changes are **test-first** and stay pure (`src/lib/tax/`)
- [ ] Money handled as **integer cents**, dates as ISO `YYYY-MM-DD`
- [ ] No secrets, `account_id`/`database_id`, personal data, or receipt images committed
- [ ] Docs / `CLAUDE.md` updated if behaviour or commands changed
