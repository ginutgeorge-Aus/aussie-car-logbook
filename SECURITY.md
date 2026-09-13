# Security Policy

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report privately via GitHub's [**Private vulnerability reporting**](https://github.com/ginutgeorge-Aus/aussie-car-logbook/security/advisories/new)
(Security tab → *Report a vulnerability*). This opens a private advisory only
you and the maintainer can see.

You'll get an acknowledgement within **7 days**. If a fix is warranted, it's
released as a patched tag and the advisory is published with credit (unless you
ask to stay anonymous).

## Scope

This is a **self-hosted, single-user** app. Each user deploys their own copy to
their own Cloudflare account; there is no shared server and no central data.
The most relevant classes of issue:

- Secrets or personal data leaking into the repo, build output, or logs
- Auth bypass around the Cloudflare Access gate
- Injection / XSS in receipt handling, OCR, or report rendering
- Anything that could expose one deployment's D1/R2 data

## Out of scope

- Vulnerabilities in a user's own misconfigured Cloudflare account or hosting
- Issues requiring a compromised deploy machine or leaked Cloudflare credentials
- Best-practice suggestions with no exploit path (open a normal issue instead)

## Handling secrets

The repo is public and enforces this automatically: **secret scanning +
push protection, gitleaks on every push/PR, and a weekly full-history sweep.**
Never commit `.dev.vars`, `wrangler.toml`, `account_id`/`database_id`, real tax
data, or receipt images. Only `*.example` config with placeholders is allowed.
