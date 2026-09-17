# Deploy from the Cloudflare dashboard (no-terminal-ish guide)

This walks you through deploying **Ginoo's Log Book** using the Cloudflare
**dashboard UI** as much as possible, for people who'd rather not live in a
terminal. The CLI path in [README.md](../README.md#deploy-to-cloudflare) is
still the most robust — but this guide gets you there with only **one
unavoidable terminal moment** (or zero, if you paste SQL by hand).

> **Honest heads-up.** Two things have no dashboard button today:
> 1. **Database migrations** — but you can paste the SQL into the D1 console (pure UI, covered below).
> 2. **Bindings for a Git-connected build** — Cloudflare reads them from a `wrangler.toml` in your repo, and this project gitignores that file. You'll commit one to **your own private copy** (Step 4).
>
> Everything else is clicks.

---

## Before you start

- A **Cloudflare account** (free) — <https://dash.cloudflare.com/sign-up>.
- A **private GitHub copy** of this repo. **Do not use "Fork"** — a fork of a
  public repo is always public and can't be made private, and in Step 4 you'll
  commit a `wrangler.toml` containing your D1 database ID. Instead **import**
  the repo into a new **private** repository:
  - GitHub → **New** → **Import a repository** → source URL
    `https://github.com/ginutgeorge-Aus/aussie-car-logbook` → set visibility
    **Private** → **Begin import**.
  - That ID isn't a password, but a private repo keeps it (and your future
    tweaks) off the public internet.

The app needs three Cloudflare resources, wired to these exact **binding
names** (the code looks them up by name — don't rename them):

| Resource | Binding name | Used for |
|----------|--------------|----------|
| D1 database | `DB` | All your data (SQLite) |
| R2 bucket | `RECEIPTS` | Receipt photos |
| Workers AI | `AI` | Receipt OCR |

---

## Step 1 — Create the D1 database

1. Dashboard → **Storage & Databases** → **D1 SQL Database** → **Create**.
2. Name it `ginoos-log-book` → **Create**.
3. Open it → copy the **Database ID** shown on the page. Save it for Step 4.

## Step 2 — Create the R2 bucket

1. Dashboard → **R2 Object Storage** → **Create bucket**.
   - (First time only: R2 asks you to add a payment method even on the free
     tier. Free allowances are generous — 10 GB storage.)
2. Name it `ginoos-log-book-receipts` → **Create bucket**.

## Step 3 — Run the database migration (pure UI)

No dashboard "apply migrations" button exists, so paste the SQL by hand once:

1. Open your GitHub copy → `src/db/migrations/0000_eminent_jackpot.sql`.
2. Click **Raw**, select all, copy.
3. Dashboard → **D1** → your `ginoos-log-book` database → **Console** tab.
4. Paste the SQL → **Execute**. Tables are now created.

**Optional — fake demo data:** repeat with `src/db/seed.sql` (fictional
records, safe to load and safe to wipe later).

> When a future release ships a **new** migration file (e.g. `0001_*.sql`),
> paste that new file's SQL the same way. Only ever run migrations you
> haven't run before.

## Step 4 — Add `wrangler.toml` to your copy

The Git-connected build reads your resource IDs from this file.

1. In your GitHub copy, open `wrangler.toml.example`.
2. **Copy its whole contents into a new file named `wrangler.toml`** in the
   repo root.
3. Change one line — paste the Database ID from Step 1:

   ```toml
   database_id = "REPLACE_WITH_YOUR_D1_ID"   # ← your ID from Step 1
   ```

4. Commit `wrangler.toml`. (This is your private copy — that's fine. Never do
   this on the public upstream repo.)

The example already declares the `DB`, `RECEIPTS`, and `AI` bindings, so you
don't wire them up by hand — the build picks them up from this file.

## Step 5 — Connect the repo and deploy

> **Deploy a release, not `main`.** This project's rule (see
> [README.md](../README.md#deploy-to-cloudflare)) is to run a **tagged
> release**, not the in-progress `main` branch. Before connecting, make a
> release branch in your private copy: GitHub → **Branches** → **New branch**,
> name it `release`, and base it on the latest **tag** from the
> [Releases page](https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases)
> (or a `git checkout -b release <tag> && git push -u origin release`). You'll
> point the build at `release` in step 3, and re-point it at the next tag when
> you upgrade.

1. Dashboard → **Workers & Pages** → **Create** → **Import a repository**.
2. Authorize GitHub, pick your `ginoos-log-book` private copy.
3. Set the build settings:
   - **Production branch / branch to build:** `release` (the tag-based branch
     above) — **not** `main`.
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
   - (Leave the output/root defaults.)
4. **Save and Deploy.** Cloudflare builds in the cloud and publishes your
   Worker. First build takes a few minutes.

When it finishes you get a public URL like
`https://ginoos-log-book.<your-subdomain>.workers.dev`.

> **The one terminal escape hatch.** If the Git-connected build gives you
> trouble, you can deploy from your laptop instead. From the project folder:
> `corepack pnpm install`, then `corepack pnpm exec wrangler login` once, then
> `corepack pnpm run deploy`. (Use `run deploy`, not bare `pnpm deploy` — the
> latter hits pnpm's built-in `deploy` command and aborts with
> `ERR_PNPM_INVALID_DEPLOY_TARGET`. And use the project-local wrangler — **not**
> `pnpm dlx wrangler`, which aborts on pnpm 12.) Clone into a path with **no
> apostrophe or shell-special characters**, or the local OpenNext build fails
> with `Expected ")" but found "s"`. See
> [README.md](../README.md#deploy-to-cloudflare). Everything above (resources,
> migrations) still stands.

---

## Step 6 — Lock it down with Cloudflare Access (required)

Right now that `workers.dev` URL is **public** — anyone with the link can see
and edit your data. Before putting real tax data in, gate it. You don't need a
custom domain — Access protects the `workers.dev` hostname directly. First-time
only: open **Zero Trust** (<https://one.dash.cloudflare.com>), pick a team name
and the **Free** plan.

**Option A — one-click Worker Access (simplest, no domain needed):**

1. Dashboard → **Workers & Pages** → your `ginoos-log-book` Worker → **Access**
   tab → **Protect this Worker behind Access**.
2. Scope: **All traffic** (covers both production and preview URLs).
3. Add a **policy**: Action **Allow**, rule **Emails** → your email address
   (use **Emails**, not "Email domain", so only you get in).
4. Login method: **One-time PIN** (Cloudflare emails you a code — no IdP setup).
   If it isn't offered, add it once under **Zero Trust → Settings →
   Authentication → Login methods → Add → One-time PIN** — new Zero Trust orgs
   no longer enable it automatically. Add Google later if you prefer.
5. Save. Now only your allowed email reaches the app. Everyone else still sees
   Cloudflare's login screen and a "code emailed" message (by design, so
   outsiders can't discover which addresses exist), but never receives a working
   code.

<details><summary>Alternative — self-hosted Access application (manual)</summary>

Dashboard → **Zero Trust** → **Access** → **Applications** → **Add an
application** → **Self-hosted**. Set the **Application domain** to your
`ginoos-log-book.<your-subdomain>.workers.dev` hostname, then add the same
**Allow / Emails** policy as above. The one-click flow above does this for you.

</details>

**Option B — add a custom domain** (optional, if you own one): Worker →
**Settings** → **Domains & Routes** → **Add** → **Custom domain**. With the
one-click Worker Access above (scope **All traffic**), the new domain is
**already gated** — Access is attached to the Worker, so every hostname it
serves is covered.

> **⚠️ Only if you used the manual self-hosted route.** A self-hosted Access
> application gates **one hostname**. If you add a custom domain, the original
> `workers.dev` URL (and vice versa) **stays live and ungated** unless you also
> cover it — add a **second** Access application for the other hostname, **or**
> turn the `workers.dev` route off with `workers_dev = false` in your
> `wrangler.toml` and redeploy. The one-click "All traffic" option (Option A)
> avoids this entirely.

> **Demo exception.** For a throwaway *public* demo, **skip Step 6** and share
> the `workers.dev` URL directly. Load the fake seed data (Step 3 optional),
> and wipe the D1 database whenever you like. Don't put real data in an
> ungated deployment.

---

## What lives where (so nothing leaks)

- Your real tax data → only in **your** D1 + R2. Never in Git.
- `wrangler.toml` (with your D1 ID) → only in **your private** repo copy.
- Never commit real IDs, `.dev.vars`, or receipt images to the public upstream
  repo. See the security notes in [README.md](../README.md) and
  [SECURITY.md](../SECURITY.md).

## When something breaks

| Symptom | Likely cause |
|---------|--------------|
| Build fails immediately | Build/deploy command typo — recheck Step 5. |
| App loads but every page errors | Migration not run — redo Step 3 (D1 Console). |
| "binding not found" in logs | `wrangler.toml` missing or `database_id` wrong — Step 4. |
| Receipt upload fails | R2 bucket name mismatch — must be `ginoos-log-book-receipts`. |
| OCR does nothing | Workers AI binding `AI` missing — it's in `wrangler.toml.example`. |
