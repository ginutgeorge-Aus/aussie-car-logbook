---
paths:
  - "src/middleware.ts"
  - "src/proxy.ts"
  - "src/app/receipt/**"
  - "docs/deploy-*.md"
---

# Auth — Cloudflare Access only

- **No in-app auth.** One user per deployment; Cloudflare Access (Google / email-OTP) sits in front of the whole hostname. There is no session, user table, role, or login page — don't add one.
- Consequence: every route and server action is implicitly "the owner". Security work here is **input validation, XSS/injection, and R2 key scoping**, not authorisation (see `.claude/rules/security.md`).
- **Never weaken the Access gate**: no public bypass paths, no unauthenticated API routes. If a feature needs a public URL (e.g. share link), raise it as a design question first.
- Optional defence-in-depth (not yet implemented): verify the `Cf-Access-Jwt-Assertion` header against the team's JWKS in middleware. If added, keep it config-driven (team domain + AUD via env), never hard-coded.
- Setup lives in `docs/deploy-ui.md` (dashboard one-click Access).
