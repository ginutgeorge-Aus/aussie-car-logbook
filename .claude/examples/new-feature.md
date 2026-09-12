# New Feature Workflow

Standard skill order for any new feature in Ginoo's Log Book.

## Steps

### 1. Brainstorm intent
```
/brainstorming
```
Explore: what does the user actually need? What edge cases exist? What existing code can be reused?

### 2. Write a plan
```
/writing-plans
```
Output: `docs/superpowers/plans/YYYY-MM-DD-<slug>.md`
Reference spec if one exists in `docs/superpowers/specs/`.

### 3. Test-driven development
```
/test-driven-development
```
Write failing tests first. Define success criteria before any implementation.

### 4. Execute with subagents
```
/subagent-driven-development
```
Dispatches one implementer per task + spec reviewer + code quality reviewer.

### 5. Verify before committing
```
/verification-before-completion
```
Run: `npm run build && npm run lint && npm test -- --no-coverage`

### 6. Commit
```
/caveman-commit
```
Conventional Commits format. Subject ≤50 chars.

### 7. Finish branch
```
/finishing-a-development-branch
```
Choose: direct merge, PR, or cleanup.

## Notes

- Branch naming: `feat/<slug>` for features, `fix/<slug>` for bugs
- Multi-file changes → branch + PR (never direct push main)
- Schema changes → push to prod DB before tagging release
- Encrypted fields: encrypt after Zod, decrypt after DB fetch
