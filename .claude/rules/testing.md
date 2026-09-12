---
paths:
  - "__tests__/**"
  - "src/**/__tests__/**"
---

# Jest Notes

- Tests live in **two** places: the root `/__tests__/` tree (subdirs mirror domain: `actions/`, `api/`, `app/`, `components/`, `lib/`) **and** colocated `__tests__/` dirs nested under `src/app/**` / `src/lib/**` (e.g. `src/lib/actions/__tests__/`, `src/app/(dashboard)/…/__tests__/`). Both run in CI — when a module has a test in both trees, update the right one (and beware a same-named test existing in both, which has bitten CI before). New tests: prefer colocating next to the module under test.
- Global env: `jest-environment-jsdom`
- API route + server action tests: add `/** @jest-environment node */` (jsdom lacks `Request`)
- **Server Component page tests**: also use `/** @jest-environment node */`. Call the async page function directly — `await Page({ searchParams: Promise.resolve({}) })` — don't `render()`. Mock `redirect` to throw: `jest.fn(() => { throw new Error("REDIRECT") })`, then assert `rejects.toThrow("REDIRECT")`. Mock client components as `() => null`. Prisma Decimal mock: `{ toString: () => "10000" }` — `Number()` coerces via `toString()` when `valueOf()` returns non-primitive.
- Mock NextAuth: `jest.mock("@/auth", () => ({ auth: jest.fn() }))`; `auth.test.ts` also mocks `next-auth`, `next-auth/providers/credentials`, `@/auth.config`
- Mock Prisma: mock ALL methods called — missing method → "is not a function"
- Enums: import from `@/lib/generated/prisma/enums`
- Zod v4: `.issues` not `.errors`
- **IDOR-guarded actions**: mock `findUnique` to return valid record or `update` never fires
- **Self-action guard**: mock session with `id`: `{ user: { role: "ADMIN", id: "1" } }`
