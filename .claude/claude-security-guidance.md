# Ginoo's Log Book security guidance

## Field encryption

The following fields are always AES-256-GCM encrypted before writing to the DB via `src/lib/crypto.ts`:
- `Family`: address, suburb, homePhone, notes
- `Person`: dateOfBirth, mobile, workPhone, homePhone, pastoralNotes, emergencyContactName, emergencyContactPhone
- `Transaction`: description
- `ReceiptSend`: sentTo

**Rule:** Any write to these fields MUST call `encrypt()` first. Any read MUST call `decrypt()` immediately after the DB fetch. Never log or expose these raw values.

## Role gates

Four roles: ADMIN, PASTOR, AUDITOR, VIEWER. Guards live in `src/lib/role-guard.ts`.

- `canEdit` → ADMIN | PASTOR. Required on every mutation (Server Action and API route).
- `canViewAccounting` → ADMIN | PASTOR | AUDITOR. Required on all accounting read paths.
- `canAccessAccounting` → ADMIN | PASTOR only. Required on all accounting mutations.
- `canSeePastoralNotes` → ADMIN | PASTOR only. Gate ALL reads/renders of pastoralNotes — client-side hiding is insufficient; strip from action payload when role fails.
- AUDITOR must never trigger mutations — any Server Action reachable by AUDITOR must be read-only.

**Rule:** Every Server Action and API route must check role before any DB access. Role check in both the page/component AND the action.

## IDOR prevention

- Before updating or deleting any record, call `findUnique` to confirm existence and ownership: `if (!rec || rec.parentId !== expectedParent) return { error: "Not found" }`.
- For `RegistrationItem`, verify parent `Registration` belongs to the correct `Event`.
- For `PettyCashReceipt`/`PettyCashExpense`, verify parent `PettyCashSession` belongs to the expected session and is OPEN before mutation.
- `AppSetting` upsert: validate key against an explicit allowlist — arbitrary key writes are IDOR risk.
- Never accept a `userId` from client input for ownership checks; derive from `session.user.id`.

## Server actions — `session.user.id`

`session.user.id` is a string. Always `parseInt(session!.user!.id!, 10)` before comparing to DB int IDs. Never look up the current user by email.

## Self-action guard

`parseInt(session!.user!.id!, 10) === targetId` — no DB lookup needed. Must block: users deleting or demoting themselves.

## ANZ bank import trust boundary

- The ANZ import endpoint receives a PDF from a staff user. Treat it as untrusted binary — check `file.size > 50 * 1024 * 1024` before `arrayBuffer()` (OOM DoS).
- `bankRef` is the dedup key — format `ANZ_{acct}_{date}_{amount}_{desc20}_{balanceCents}`. Never skip the dedup check on confirm.
- `x-forwarded-for` IP for rate limiting: use the rightmost entry only (trusted Azure ingress).

## Event registration (public endpoint)

- `POST /api/events/[slug]/register` is unauthenticated. Rate limit: 10 req/min/IP (in-memory).
- Never trust any FK from the public payload — validate against the DB after parsing.
- `RegistrationItem.unitPrice` must always be snapshotted from DB at registration time — never from client input.

## CSV export formula injection

All CSV exports must prefix cells starting with `=`, `+`, `-`, `@` with a single quote `'` to prevent spreadsheet formula injection.

## Password / OTP lockout

- 5 wrong password attempts → 15 min lockout (throws `AccountLocked`).
- 5 wrong OTP codes → 15 min lockout (throws `OtpLocked`).
- `DISABLE_OTP=true` is dev-only; never allow in production path.

## Audit log

- Every sensitive action must call `logAudit(userId, "VERB_NOUN", resourceType, resourceId?, metadata?, ip?)`.
- `logAudit` swallows its own errors — do NOT wrap it in try-catch that silences the primary action.
- Never log PII (email, mobile, pastoral notes) in `metadata`.

## Unique constraint + redirect

- Wrap ONLY the DB call in try-catch — `redirect()` throws internally and gets swallowed if inside catch.

## Zod validation

- All Zod string fields must have `.max()` bounds to prevent oversized payloads.
- Zod v4 uses `.issues` not `.errors`.

## General

- No raw SQL — all DB access via `prisma` from `@/lib/prisma`.
- `prisma.X.findMany` for lists feeding UI: always use `select` not `include` to avoid leaking PII columns.
- Route param integers: guard `isNaN(id) || id <= 0 || id > 2147483647` before use.
