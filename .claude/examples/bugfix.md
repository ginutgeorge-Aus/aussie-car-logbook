# Bug Fix Workflow

Standard skill order for any bug or test failure in Ginoo's Log Book.

## Steps

### 1. Systematic debugging
```
/systematic-debugging
```
Diagnose root cause before touching code. Surface assumptions. Check logs, tests, and stack traces.

### 2. Write a reproducing test
Before fixing, write a test that fails with the current bug. This is your success criterion.

### 3. Fix — minimal, surgical
Touch only the broken code. Do not refactor adjacent code. Match existing style.

### 4. Verify fix
```bash
npm test -- --no-coverage --testPathPatterns="<affected-suite>"
npm run build
npm run lint
```

### 5. Commit
```
/caveman-commit
```

## Common issues

| Symptom | Likely cause |
|---|---|
| `is not a function` in tests | Prisma mock missing a method |
| `redirect()` swallowed silently | Wrapped inside try-catch — move `redirect()` outside catch |
| Unique constraint error on re-import | Check `memberNo` vs `name` — detect by `msg.includes("memberNo")` |
| OTP cooldown unexpected | `DISABLE_OTP=true` only works in `.env.local` |
| `SelectItem value=""` throws | Use native `<select>` for optional/clearable dropdowns |
| Prisma `undefined` on optional FK | Use `null` to clear, `undefined` = no-op |
| Date displays wrong | `lang="en-AU"` required on `<html>` for DD/MM/YYYY in Chrome |
