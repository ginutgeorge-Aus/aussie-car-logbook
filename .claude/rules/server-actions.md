---
paths:
  - "src/lib/actions.ts"
  - "src/lib/*/parse.ts"
  - "src/components/**"
---

# Server Actions

All actions live in `src/lib/actions.ts` (`"use server"`). Pattern:

```typescript
export async function createTripAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd)                // pure parser in src/lib/<domain>/parse.ts
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }
  try {
    await createTrip(parsed.value)                // src/lib/data/** helper
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  revalidatePath("/trips")
  revalidatePath("/")                             // dashboard totals too
  return { ok: true }
}
```

- **Parse first, always.** Every FormData field goes through a `parse*Form` returning `ParseResult` (`{ ok, value } | { ok: false, fieldErrors }`). Parsers are pure and unit-tested — no DB, no `getCloudflareContext`.
- **`ActionResult`** (`src/lib/logbook/types.ts`) — never throw to the client; return `error`/`fieldErrors`.
- **Update with id**: `updateTripAction.bind(null, id)` at page level; delete actions take `fd` and guard `Number.isInteger(id)`.
- **Revalidate** the list path AND `/` (dashboard aggregates) on every mutation; reports read live so no extra path.
- **`"use server"` exports must all be `async`** — a sync export is a build error.
- **Receipt files**: `assertReceiptFile()` before upload/OCR; `putReceipt()` generates the R2 key server-side — never accept a key from the client.
- **No auth checks in actions** — Cloudflare Access gates the whole deployment (see `.claude/rules/auth.md`). Don't add role logic.
- Client forms: `useActionState(action, initial)` from `react`.
