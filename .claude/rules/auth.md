---
paths:
  - "src/auth.ts"
  - "src/auth.config.ts"
  - "src/middleware.ts"
  - "src/lib/actions/user.ts"
---

# Auth Internals

- Server Components/Actions: `auth()` from `@/auth`. Client Components: `useSession()` from `next-auth/react`.
- **Edge split**: `auth.config.ts` (Edge-safe, used by `middleware.ts`) vs `auth.ts` (full Node.js, Prisma + bcryptjs) — middleware can't import `auth.ts`.
- **`session.user.id`** is string — use `parseInt(session!.user!.id!, 10)`. Never look up current user by email.
- **Password lockout**: 5 wrong attempts → 15 min lock. `authorizeCredentials` throws `AccountLocked` (`code = "AccountLocked"`). Admin unlock via `unlockUser` in `src/lib/actions/user.ts`.
- **OTP lockout**: 5 wrong codes → 15 min lock. `OtpSent` thrown after password passes. `OtpCooldown` on resend if OTP < 30s old. `DISABLE_OTP=true` in `.env.local` for dev only — never production.
- **Trusted device**: "Remember this device" checkbox sets a `trusted_device` httpOnly cookie (opaque token; DB stores the `hashDeviceToken` HMAC in `TrustedDevice`, 14-day `expiresAt`). The `authorizeCredentials` password branch reads the cookie and skips OTP on a valid, non-expired, userId-scoped match (returns `remember: true`). The cookie is WRITTEN by the `trustDevice` server action after a successful OTP (NextAuth `authorize` can't set response cookies). Devices are revocable at `/account` (`revokeTrustedDevice`, deleteMany scoped by userId); trust is cleared by `resetPassword` and admin forced-password-change. **Trust intentionally SURVIVES an explicit `logout`** — that is the point of "remember this device 14 days" (a normal logout/login on the same browser must skip OTP, not re-prompt). `logout` still stamps `sessionsValidFrom` to kill outstanding tokens.
- **Session windows**: `session.maxAge` is a 7-day cookie TTL ceiling. `jwtCallback` enforces the real lifetime via the `remember` claim — non-remembered: 4h hard cap (#857) + 60min DB-configurable idle (#424, `SESSION_IDLE_TIMEOUT_MINUTES`); remembered: 7-day sliding idle.
- Lockout fields are DB-backed (`failedLoginAttempts`/`lockedUntil`/`failedOtpAttempts`/`otpLockedUntil`) — replica-safe.

Role table + helpers (`canEdit`, `canViewAccounting`, etc.) live in the main `CLAUDE.md`.
