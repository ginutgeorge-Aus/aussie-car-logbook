# Ginoo's Log Book

![100% AI-coded](https://img.shields.io/badge/100%25-AI--coded-blueviolet)
![Built with Claude](https://img.shields.io/badge/built%20with-Claude%20Code-8A2BE2)
![Status: early / experimental](https://img.shields.io/badge/status-early%20%2F%20experimental-orange)

An open-source car logbook PWA for Australian taxpayers using the ATO
**logbook method** to claim work-related car expenses. Track trips, odometer
readings, and business-use percentage, then generate the records the ATO
expects for your logbook period.

> ⚠️ **Early stage — use with caution.** This project is a **100% AI-coded**
> experiment (see [Built with Claude](#-built-with-claude--100-ai-coded)).
> It is not yet battle-tested. **Always double-check every figure before you
> lodge anything with the ATO, and confirm with a registered tax agent.** Not
> tax advice.

## 🤖 Built with Claude / 100% AI-coded

Every line of this project — code, tests, docs, and this README — was written
by **[Claude](https://claude.com/claude-code)** (Anthropic's Claude Code), with
a human acting only as product owner: setting direction, reviewing, and
approving. No human hand-wrote the implementation. It was built the "vibecoded"
way: brainstorm → plan → test-driven development → PR review → deploy, all
driven by Claude.

That's the fun of it — and the caveat. It's **early and experimental**; treat
outputs as a starting point, not gospel. Bug reports and scrutiny welcome via
[Issues](https://github.com/ginutgeorge-Aus/aussie-car-logbook/issues).

## 📖 User guide (non-technical)

New here or not a developer? The **[Wiki](https://github.com/ginutgeorge-Aus/aussie-car-logbook/wiki)**
is a plain-English manual: what you need, a step-by-step setup guide, how to
use the app day to day, the logbook method explained, and the reports. Source
lives in [`wiki/`](wiki/) and is published to the Wiki automatically.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript strict mode)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) via
  [OpenNext](https://opennext.js.org/cloudflare) — hosting, D1 (database),
  R2 (receipt storage), Workers AI
- [Drizzle ORM](https://orm.drizzle.team/) — D1 schema and queries
- [Vitest](https://vitest.dev/) — unit tests, including the tax engine

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.dev.vars` and fill in local-only values before
running anything that needs them:

```bash
cp .env.example .dev.vars
```

## Deploy to Cloudflare

Each user self-hosts their own copy on **Cloudflare Workers** (via
[OpenNext](https://opennext.js.org/cloudflare)). You deploy a
[tagged release](https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases), not `main`.

**1. Log in to your Cloudflare account** (once):

```bash
corepack pnpm install                      # installs the pinned local wrangler
corepack pnpm exec wrangler login
```

> Use the project-local `wrangler` (`corepack pnpm exec wrangler …`), **not**
> `pnpm dlx wrangler`. On pnpm 12 `dlx` blocks the `esbuild`/`workerd` build
> scripts and aborts with `ERR_PNPM_IGNORED_BUILDS`. The local binary is
> already pinned in `package.json` and matches CI.

**2. Create the Cloudflare resources** (once), then note the printed IDs:

```bash
corepack pnpm exec wrangler d1 create ginoos-log-book
corepack pnpm exec wrangler r2 bucket create ginoos-log-book-receipts
# Workers AI needs no resource — the [ai] binding is enough.
```

**3. Configure wrangler** — copy the example and paste your own `database_id`:

```bash
cp wrangler.toml.example wrangler.toml   # gitignored; never commit real IDs
# edit wrangler.toml: set database_id (the id printed by `d1 create` above)
```

**4. Apply migrations to the remote D1, then build + deploy:**

```bash
pnpm cf-typegen        # generate CloudflareEnv types (optional but recommended)
pnpm db:remote         # wrangler d1 migrations apply DB --remote
pnpm deploy            # opennextjs-cloudflare build && ... deploy
```

Use `pnpm preview` to run the built Worker locally before deploying.

### Lock it down — Cloudflare Access (required)

This app has **no built-in login**; it assumes a single user and delegates
auth to **[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)**
(free tier). Before exposing your deployment, add a **self-hosted Access
application** covering your Worker's hostname with a policy that allows only
your own Google account or email (one-time-PIN). Without this, your financial
data is public. See [SECURITY.md](SECURITY.md).

## No personal data in this repo

This is a public, open-source repository. Never commit:

- Real Cloudflare account IDs, D1 database IDs, or API tokens
- `.dev.vars`, `wrangler.toml`, or any `.env*` file (only the `*.example`
  templates with placeholder values are committed)
- Trip logs, odometer readings, receipts/receipt images, or any other
  personal or financial data

Local secrets and personal data stay in gitignored files
(`.dev.vars`, `wrangler.toml`, `.wrangler/`, `.open-next/`) or in your own
Cloudflare account — never in the git history.
