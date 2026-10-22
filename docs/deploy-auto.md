# Deploy with Cloudflare Workers Builds (release branch)

Cloud deploy without a terminal or a committed secret: Cloudflare builds and
publishes the Worker when you update a dedicated **`release`** branch. `main`
stays dev — **pushing to `main` does not deploy.**

This improves on the manual [deploy-ui.md](deploy-ui.md) guide in one way:

- **No `wrangler.toml` committed.** The D1 database id is stored as a Workers
  Builds **secret** (`D1_DATABASE_ID`) and injected into a generated
  `wrangler.toml` at build time by [`scripts/gen-wrangler.mjs`](../scripts/gen-wrangler.mjs).
  The id never enters git — so your copy of the repo can be a **public fork**;
  no private copy required. It must be a fork (or import) **under your own
  GitHub account**: you push the `release` branch and install the Workers Builds
  GitHub App on it, which needs write/admin access you don't have on upstream.

> **Respects the tag-based release model.** `release` is a pointer you move to a
> stable **tag** when you want to ship (see [CLAUDE.md](../CLAUDE.md) "Git /
> release model"). Everyday work on `main` never deploys. Workers Builds has no
> tag trigger, so a `release` branch is how you get tag-based deploys on it.

## Prerequisites

Create the two Cloudflare resources first — follow **Steps 1–2** of
[deploy-ui.md](deploy-ui.md#step-1--create-the-d1-database):

1. D1 database `ginoos-log-book` (binding `DB`) — **copy its Database ID.**
2. R2 bucket `ginoos-log-book-receipts` (binding `RECEIPTS`).

No manual SQL: the deploy command applies database migrations for you (Step 4).

## Step 1 — Create the `release` branch

Point it at the latest stable tag (not `main`):

```bash
git fetch --tags
git branch release <latest-tag>      # e.g. v1.0.0
git push -u origin release
```

## Step 2 — Connect the repo

1. Dashboard → **Workers & Pages** → **Create** → **Import a repository**.
2. Authorize GitHub, pick **your fork** (public is fine — no id is committed).

## Step 3 — Add the build secret

In build setup (or later under Worker → **Settings → Build → Variables and
Secrets**):

- Add a **Secret** (not a plaintext variable): name `D1_DATABASE_ID`, value =
  the Database ID from the prerequisites.

## Step 4 — Set build settings

- **Production branch:** `release` — **not** `main`.
- **Non-production branch builds:** **OFF** — so pushes to `main` and feature
  branches don't build or deploy.
- **Build command:** `pnpm run ci:build`
  - runs `gen-wrangler.mjs` (writes `wrangler.toml` from the example +
    `D1_DATABASE_ID`), then `opennextjs-cloudflare build`.
  - use `run` — bare `pnpm ci:build` risks colliding with pnpm's `ci` builtin.
- **Deploy command:** `pnpm run ci:deploy`
  - applies pending D1 migrations (`wrangler d1 migrations apply DB --remote`),
    then `wrangler deploy`. Schema always lands before the code that reads it.
  - not `opennextjs-cloudflare deploy`: it can open a remote-bindings proxy
    through your `workers.dev` URL, which Cloudflare Access blocks in
    non-interactive CI. With no incremental cache configured, plain
    `wrangler deploy` is equivalent (`OPEN_NEXT_DEPLOY=true` stops wrangler
    handing back to OpenNext).
- Root directory / output: defaults.
- **API token:** the build token Cloudflare creates covers Workers, KV and R2
  but **not D1**. **Settings → Build → API token** only picks a token — it can't
  change permissions. Go to **My Profile → API Tokens**, edit that token and
  add **Account → D1 → Edit**, then select it under **Settings → Build → API
  token**. If you create a new token instead, give it every permission the
  generated build token has (Workers Scripts, KV, R2, etc.) **plus** D1 → Edit,
  or the publish step fails. Without it the migration step fails with an
  auth error. See Cloudflare's
  [Workers Builds API token docs](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token).

`account_id` is **not** needed in the config — Workers Builds deploys into the
connected account automatically. The `RECEIPTS` binding needs no id.

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
git push origin v1.1.0^{commit}:release  # fast-forward release → Workers Builds deploys
```

The push is rejected unless `release` fast-forwards to the tag, so it can't
roll back or overwrite history by accident. Protect `release` with a branch
ruleset (GitHub → **Settings → Rules**): **block force pushes**, **restrict
deletions**, and limit who can push — whoever can push to `release` can deploy.

## Database migrations

Applied automatically by `ci:deploy`, before the new code goes live. Wrangler
records each applied migration in D1 (`d1_migrations` table) and only runs new
ones, so every deploy is safe to repeat. Drizzle migrations here are
forward-only and non-destructive.

Before a **major** upgrade, take a restore point: D1 Time Travel keeps 7 days
of point-in-time history on the Free plan, 30 days on Workers Paid
(`wrangler d1 time-travel info ginoos-log-book`).

> **Don't paste migration SQL into the D1 Console.** It creates the tables
> without recording them in `d1_migrations`, so the next deploy tries to create
> them again and fails. If you already did, see the troubleshooting row below.

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
| Deploy fails at `migrations apply` with an auth error | Build token lacks **D1 Edit** (Step 4). |
| Deploy fails with `table ... already exists` | Tables were created by pasting SQL. In the D1 Console run `CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);` then `INSERT INTO d1_migrations(name) VALUES ('<file>.sql');` for each file you pasted, and redeploy. |
| "binding not found" in logs | `D1_DATABASE_ID` secret value is wrong. |
| App loads but every page errors | Migrations didn't run — check the deploy log for the `migrations apply` step. |
| Receipt upload fails | R2 bucket name ≠ `ginoos-log-book-receipts`. |
