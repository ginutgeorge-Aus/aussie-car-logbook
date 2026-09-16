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
- A **GitHub account** with your **own copy (fork)** of this repo.
  - **Keep your fork private** if you commit `wrangler.toml` (Step 4) — it will
    contain your D1 database ID. That ID isn't a password, but there's no
    reason to publish it.

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

1. Dashboard → **Workers & Pages** → **Create** → **Import a repository**.
2. Authorize GitHub, pick your `ginoos-log-book` copy.
3. Set the build settings:
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
> `corepack pnpm deploy`. (Use the project-local wrangler — **not**
> `pnpm dlx wrangler`, which aborts on pnpm 12.) See
> [README.md](../README.md#deploy-to-cloudflare). Everything above (resources,
> migrations) still stands.

---

## Step 6 — Lock it down with Cloudflare Access (required)

Right now that `workers.dev` URL is **public** — anyone with the link can see
and edit your data. Before putting real tax data in, gate it.

Access self-hosted apps need a **hostname on a domain in your Cloudflare
account** (a `workers.dev` subdomain can't be gated on its own). If you don't
have a domain, add one (Cloudflare sells them at cost, or move an existing one
in — the DNS is free).

1. Point a custom hostname at the Worker: Worker → **Settings** →
   **Domains & Routes** → **Add** → **Custom domain** (e.g.
   `logbook.yourdomain.com`).
2. Dashboard → **Zero Trust** → **Access** → **Applications** → **Add an
   application** → **Self-hosted**.
3. **Application domain:** the custom hostname from step 1.
4. Add a **policy**: Action **Allow**, rule **Emails** → your email address.
5. Save. Now only your logged-in email reaches the app; everyone else hits
   Cloudflare's login screen.

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
