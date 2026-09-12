# Ginoo's Log Book

An open-source car logbook PWA for Australian taxpayers using the ATO
**logbook method** to claim work-related car expenses. Track trips, odometer
readings, and business-use percentage, then generate the records the ATO
expects for your logbook period.

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

> Placeholder — filled in once the Cloudflare/Drizzle/D1 setup lands (see
> `.superpowers/sdd/` task briefs). Broad shape:

```bash
cp wrangler.toml.example wrangler.toml
# fill in your own D1 database_id, then:
pnpm dlx wrangler d1 migrations apply <DB_NAME>
pnpm build
pnpm dlx wrangler deploy
```

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
