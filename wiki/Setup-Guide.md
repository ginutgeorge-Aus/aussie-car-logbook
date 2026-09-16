# Setup Guide

This is the **one-time** setup to get your own private copy running. Plan
about 30 minutes. You'll copy and paste a handful of commands — you don't
need to understand them.

> 💡 Do this once, on a computer. After it's done you use the app on your
> **phone** and never come back here (unless you want to update it later).

Before you start, have the things in **[What You Need](What-You-Need)** ready.

---

## Step 1 — Make a Cloudflare account

Go to **[cloudflare.com](https://cloudflare.com)** and sign up (free). Confirm
your email. That's all — you don't need to add a website or a credit card.

## Step 2 — Get the setup tools on your computer

You need two free tools installed: **Node.js** and **pnpm**.

- Install Node.js (LTS version) from **[nodejs.org](https://nodejs.org)**.
- Then turn on pnpm by opening a terminal and running:

  ```bash
  corepack enable
  ```

> A "terminal" is the Command Prompt / PowerShell on Windows, or Terminal on
> Mac. Search your computer for it.

## Step 3 — Download the app

Download the latest **stable release** (not the code on the main page) from:

**[Releases page](https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases)**

Download the source `.zip` of the newest release, unzip it, and open a
terminal **inside** that folder. Then install the app's parts:

```bash
pnpm install
```

## Step 4 — Connect to your Cloudflare account

```bash
corepack pnpm exec wrangler login
```

A browser window opens — sign in to Cloudflare and click **Allow** (do it
promptly — it stops waiting after a minute or two).

> ⚠️ Use `corepack pnpm exec wrangler …`, **not** `pnpm dlx wrangler …`. On
> newer pnpm the `dlx` form stops with an `ERR_PNPM_IGNORED_BUILDS` error and
> never runs. `exec` uses the copy that came with the app in Step 3.

## Step 5 — Create your storage (once)

These commands create your private database and your receipt-photo storage:

```bash
corepack pnpm exec wrangler d1 create ginoos-log-book
corepack pnpm exec wrangler r2 bucket create ginoos-log-book-receipts
```

The first command prints a **`database_id`** — copy it, you need it next.

## Step 6 — Paste in your database ID

```bash
cp wrangler.toml.example wrangler.toml
```

Open the new `wrangler.toml` file in any text editor and paste your
`database_id` from Step 5 where it says to. Save the file.

## Step 7 — Build and publish your app

```bash
pnpm db:remote
pnpm deploy
```

When it finishes, it prints your app's web address (something like
`https://ginoos-log-book.<your-name>.workers.dev`). **This is your app.**

---

## Step 8 — Lock it down (do NOT skip this) 🔒

Right now your app's address is public — anyone with the link could see your
financial data. You must add a lock so **only you** can open it.

This lock is a free Cloudflare feature called **Access**:

1. In your Cloudflare dashboard, go to **Zero Trust → Access → Applications**.
2. Click **Add an application** → **Self-hosted**.
3. Give it any name, and enter your app's web address (from Step 7).
4. Add a **policy** that allows **only your own email** (or your Google
   account). Choose "Emails" and enter just your address.
5. Save.

Now, when you open your app, Cloudflare asks you to sign in first. Only your
email gets in. Everyone else is blocked.

> Full security notes are in the project's **SECURITY.md** file. If you're
> unsure whether the lock is on, open your app's address in a private/
> incognito window — you should be *stopped* at a sign-in screen.

---

## Step 9 — Put it on your phone

1. On your phone, open your app's web address (sign in when asked).
2. In the browser menu, tap **Add to Home Screen**.
3. It now behaves like a normal app icon.

**Done!** Head to **[Using the App](Using-the-App)** to add your car and
start logging.

---

## Updating later (optional)

When a new stable release comes out, download it, and from its folder run
`pnpm db:remote` then `pnpm deploy` again. **Your data stays put** — updates
never wipe your trips or receipts. See [FAQ](FAQ) for backups.
