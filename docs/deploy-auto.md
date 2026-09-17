# Auto-deploy with Cloudflare Workers Builds

Continuous deploy: **push to `main` → Cloudflare builds and publishes** the
Worker automatically. No terminal, no committed secrets.

This is the recommended path for the repo owner. It improves on the manual
[deploy-ui.md](deploy-ui.md) guide in two ways:

- **No `wrangler.toml` committed.** The D1 database id is stored as a Workers
  Builds **secret** (`D1_DATABASE_ID`) and injected into a generated
  `wrangler.toml` at build time by [`scripts/gen-wrangler.mjs`](../scripts/gen-wrangler.mjs).
  The id never enters git — so you can connect the **public upstream repo
  directly**, no private copy required.
- **Zero manual deploys.** Every merge to `main` ships.

> **This changes the release model for your live instance.** The repo's default
> convention ([CLAUDE.md](../CLAUDE.md) "Git / release model") is that users
> deploy a **tagged release**, not `main`. Auto-deploy-on-`main` supersedes that
> for your own deployment. Other users can still follow the tag-based path in
> [deploy-ui.md](deploy-ui.md). If you'd rather auto-deploy a stable branch,
> set the production branch to `release` in step 3 below and fast-forward it to
> a tag when you want to ship.

## Prerequisites

Create the three Cloudflare resources first — follow **Steps 1–3** of
[deploy-ui.md](deploy-ui.md#step-1--create-the-d1-database):

1. D1 database `ginoos-log-book` (binding `DB`) — **copy its Database ID.**
2. R2 bucket `ginoos-log-book-receipts` (binding `RECEIPTS`).
3. Apply the migration once (D1 Console → paste `src/db/migrations/*.sql`).

## Step 1 — Connect the repo

1. Dashboard → **Workers & Pages** → **Create** → **Import a repository**.
2. Authorize GitHub, pick the repo (public upstream is fine — no id is committed).

## Step 2 — Add the build secret

In the build setup (or afterwards under the Worker → **Settings → Build →
Variables and Secrets**):

- Add a **Secret** (not a plaintext variable): name `D1_DATABASE_ID`, value =
  the Database ID from the prerequisites.

## Step 3 — Set build settings

- **Production branch:** `main` (or `release` for tag-based — see note above).
- **Build command:** `pnpm ci:build`
  - runs `gen-wrangler.mjs` (writes `wrangler.toml` from the example +
    `D1_DATABASE_ID`), then `opennextjs-cloudflare build`.
- **Deploy command:** `pnpm ci:deploy` (`opennextjs-cloudflare deploy`).
- Root directory / output: defaults.

`account_id` is **not** needed in the config — Workers Builds deploys into the
connected account automatically. `RECEIPTS` and `AI` bindings need no ids.

## Step 4 — Save and deploy

**Save and Deploy.** First cloud build takes a few minutes; subsequent pushes to
`main` deploy automatically. Non-production branches get preview versions.

## Step 5 — Lock it down

Gate the app with Cloudflare Access before real data goes in — follow **Step 6**
of [deploy-ui.md](deploy-ui.md#step-6--lock-it-down-with-cloudflare-access-required).

## Database migrations (still deliberate)

Auto-deploy ships **code**, not schema. Drizzle migrations are forward-only and
non-destructive, but they are **not** applied by the build — code that expects a
new column would error if the column isn't there yet.

**Order when a PR adds a migration:** apply it to remote D1 **before** merging.
- `corepack pnpm run db:remote` (applies `src/db/migrations/*` to remote), **or**
- paste the new `.sql` into the D1 Console (pure UI).

Then merge → auto-deploy runs against the already-migrated database.

## When something breaks

| Symptom | Likely cause |
|---------|--------------|
| Build fails at `gen-wrangler` | `D1_DATABASE_ID` secret not set (Step 2). |
| "binding not found" in logs | Secret value is wrong, or migration not applied. |
| App loads but every page errors | Migration not run on remote D1 — see above. |
| Receipt upload fails | R2 bucket name ≠ `ginoos-log-book-receipts`. |
| OCR does nothing | Workers AI `AI` binding missing (it's in `wrangler.toml.example`). |
