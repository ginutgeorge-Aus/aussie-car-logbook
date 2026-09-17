# Deploy with Cloudflare Workers Builds (release branch)

Cloud deploy without a terminal or a committed secret: Cloudflare builds and
publishes the Worker when you update a dedicated **`release`** branch. `main`
stays dev — **pushing to `main` does not deploy.**

This improves on the manual [deploy-ui.md](deploy-ui.md) guide in one way:

- **No `wrangler.toml` committed.** The D1 database id is stored as a Workers
  Builds **secret** (`D1_DATABASE_ID`) and injected into a generated
  `wrangler.toml` at build time by [`scripts/gen-wrangler.mjs`](../scripts/gen-wrangler.mjs).
  The id never enters git — so you can connect the **public upstream repo
  directly**, no private copy required.

> **Respects the tag-based release model.** `release` is a pointer you move to a
> stable **tag** when you want to ship (see [CLAUDE.md](../CLAUDE.md) "Git /
> release model"). Everyday work on `main` never deploys. Workers Builds has no
> tag trigger, so a `release` branch is how you get tag-based deploys on it.

## Prerequisites

Create the three Cloudflare resources first — follow **Steps 1–3** of
[deploy-ui.md](deploy-ui.md#step-1--create-the-d1-database):

1. D1 database `ginoos-log-book` (binding `DB`) — **copy its Database ID.**
2. R2 bucket `ginoos-log-book-receipts` (binding `RECEIPTS`).
3. Apply the migration once (D1 Console → paste `src/db/migrations/*.sql`).

## Step 1 — Create the `release` branch

Point it at the latest stable tag (not `main`):

```bash
git fetch --tags
git branch release <latest-tag>      # e.g. v1.0.0
git push -u origin release
```

## Step 2 — Connect the repo

1. Dashboard → **Workers & Pages** → **Create** → **Import a repository**.
2. Authorize GitHub, pick the repo (public upstream is fine — no id is committed).

## Step 3 — Add the build secret

In build setup (or later under Worker → **Settings → Build → Variables and
Secrets**):

- Add a **Secret** (not a plaintext variable): name `D1_DATABASE_ID`, value =
  the Database ID from the prerequisites.

## Step 4 — Set build settings

- **Production branch:** `release` — **not** `main`.
- **Non-production branch builds:** **OFF** — so pushes to `main` and feature
  branches don't build or deploy.
- **Build command:** `pnpm ci:build`
  - runs `gen-wrangler.mjs` (writes `wrangler.toml` from the example +
    `D1_DATABASE_ID`), then `opennextjs-cloudflare build`.
- **Deploy command:** `pnpm ci:deploy` (`opennextjs-cloudflare deploy`).
- Root directory / output: defaults.

`account_id` is **not** needed in the config — Workers Builds deploys into the
connected account automatically. `RECEIPTS` and `AI` bindings need no ids.

## Step 5 — Save and deploy

**Save and Deploy.** The first cloud build (of `release`) takes a few minutes.

## Step 6 — Lock it down

Gate the app with Cloudflare Access before real data goes in — follow **Step 6**
of [deploy-ui.md](deploy-ui.md#step-6--lock-it-down-with-cloudflare-access-required).

## Shipping a new version

`main` accumulates merged work and **does not deploy**. When you want to release:

```bash
git tag v1.1.0 <commit-on-main>      # tag the stable point
git push --tags
git branch -f release v1.1.0         # move release to the tag
git push -f origin release           # → Workers Builds deploys
```

## Database migrations (before you ship)

Deploy ships **code**, not schema. Drizzle migrations are forward-only and
non-destructive, but they are **not** applied by the build.

**When a release includes a new migration, apply it to remote D1 first**, then
move `release`:
- `corepack pnpm run db:remote` (applies `src/db/migrations/*` to remote), **or**
- paste the new `.sql` into the D1 Console (pure UI).

## How other people run this app

Deployment is **per-person** — each self-hoster uses their **own** Cloudflare
account and data. Your Workers Builds config lives only in your dashboard and
affects only your instance. Others pull a **tag** into their own copy and deploy
however they like (their own Workers Builds, or manual `pnpm run deploy`).

## When something breaks

| Symptom | Likely cause |
|---------|--------------|
| Push to `main` deployed | Production branch is `main`, not `release`, or non-prod builds are ON. |
| Build fails at `gen-wrangler` | `D1_DATABASE_ID` secret not set (Step 3). |
| "binding not found" in logs | Secret value is wrong, or migration not applied. |
| App loads but every page errors | Migration not run on remote D1 — see above. |
| Receipt upload fails | R2 bucket name ≠ `ginoos-log-book-receipts`. |
| OCR does nothing | Workers AI `AI` binding missing (it's in `wrangler.toml.example`). |
