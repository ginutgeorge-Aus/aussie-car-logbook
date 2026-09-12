---
paths:
  - "src/lib/actions/**"
---

# Server Actions

Pattern:
```typescript
"use server"
export async function createFamily(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await auth()
  if (!canEdit(session?.user?.role)) return { error: "Unauthorized" }
  const parsed = Schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }  // Zod v4: .issues
  await prisma.family.create({ data: parsed.data })
  revalidatePath("/families")
  redirect("/families")
}
```

- Client forms: `useActionState(action, undefined)` from `react`
- Update with ID: `updateFamily.bind(null, family.id)` at page level
- Delete: `useTransition` + direct call (no `useActionState`)
- **Inline action in Server Component** (wrapping bound action whose signature doesn't match `form action`):
  ```typescript
  const boundDelete = deleteEvent.bind(null, event.id)
  async function deleteAction(): Promise<void> { "use server"; await boundDelete() }
  ```
- **`ActionResult`**: `{ error } | undefined` (redirect on success) or `{ error } | { success } | undefined` (stay on page)
- **Role gates in action AND page** — both required
- **`revalidatePath` for accounting**: transaction mutations must call `revalidatePath("/accounting")` AND the specific sub-path. `toggleReconciled` and `bulkReconcile` must also call `revalidatePath("/accounting/reconciliation")` — omitting it leaves the equation panel stale after toggling.
- **Checkbox Zod**: `z.string().optional().transform((v) => v === "on")` — not `z.boolean()`
- **`"use server"` exports**: all must be `async` — sync export = build error
- **IDOR guard**: `findUnique` parent ownership check before any child mutation
- **Unique constraint + redirect**: wrap only DB call in try-catch — `redirect()` throws internally and gets swallowed if inside catch
- **Self-action guard**: `parseInt(session!.user!.id!, 10) === id` — no DB lookup needed

See also `.claude/rules/security.md` (server-action security checklist) and `.claude/rules/encryption.md` (encrypt-on-write).
