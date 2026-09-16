# Troubleshooting

Common problems and fixes. If your issue isn't here, open an issue on
[GitHub](https://github.com/ginutgeorge-Aus/aussie-car-logbook/issues).

---

## Setup

### `pnpm` isn't found
Turn it on with `corepack enable` (needs Node.js installed first — see
[What You Need](What-You-Need)). Close and reopen your terminal afterwards.

### `ERR_PNPM_IGNORED_BUILDS` when running a `wrangler` command
You used the `pnpm dlx wrangler …` form. Newer pnpm blocks that. Use
`corepack pnpm exec wrangler …` instead (same command, just `exec` not `dlx`) —
it runs the wrangler that came with the app in Step 3 of the
[Setup Guide](Setup-Guide).

### `wrangler login` doesn't open a browser (or "Timed out waiting for authorization code")
Copy the link it prints and paste it into your browser manually, then sign in
to Cloudflare and click **Allow** — do it promptly, it stops waiting after a
minute or two. Run it from **inside the app folder** with
`corepack pnpm exec wrangler login`.

### Deploy fails / "database_id" errors
Check Step 6 of the [Setup Guide](Setup-Guide): you must copy
`wrangler.toml.example` to `wrangler.toml` and paste in the real `database_id`
that `wrangler d1 create` printed. A missing or wrong ID is the usual cause.

---

## Signing in / access

### Anyone can open my app (no sign-in screen!) 🔒
The Cloudflare Access lock isn't set up. **Do Step 8 of the
[Setup Guide](Setup-Guide) now** — until then your financial data is public.
Test by opening your app's address in a private/incognito window: you should
be stopped at a sign-in screen.

### I'm locked out of my own app
Your Access policy doesn't list your email. In the Cloudflare dashboard go to
**Zero Trust → Access → Applications**, open your app, and check the policy
allows your exact email address (or Google account). Fix and save.

---

## Using the app

### Business-use % looks wrong
- Check each trip's **Business** tick is correct.
- Make sure **odo start/end** are right — distance comes from those.
- Confirm you're viewing the right **financial year** in the dropdown.
- Remember it's business km ÷ total km across the trips you've logged.

### Receipt scan filled in the wrong details
AI reading isn't perfect. Just correct any wrong field before you tap **Add
expense**. Always review date, amount, GST, vendor, and category.

### GST looks off on an expense
GST auto-fills as amount ÷ 11. If a receipt shows a different GST amount, type
the correct figure over it. For no-GST items, tick **GST-free**.

### My reports say depreciation was left out for a year
This means the ATO **car cost limit** for your car's purchase year isn't
configured in the app. It's a small, one-time code update in
`src/lib/tax/depreciation.ts` (add that year's limit from the ATO website),
then redeploy. If you're not comfortable editing it, open a GitHub issue and
ask for the year to be added — or ask a tech-comfortable friend. Your other
report figures are unaffected.

### A report is empty
You need **trips** (for business-use %) and **expenses** (for the dollar
figures) in the selected financial year. Add some, or switch to a year that
has data.

---

## Data & updates

### How do I back up before updating?
Export your database and download your receipts before a big update:
```bash
corepack pnpm exec wrangler d1 export ginoos-log-book --output backup.sql
```
Download receipt images from your **R2 bucket** in the Cloudflare dashboard.

### Will an update erase my data?
No — updates are non-destructive. Your trips and receipts survive. Backing up
first is still good practice.

---

Still stuck? Open an issue on
[GitHub](https://github.com/ginutgeorge-Aus/aussie-car-logbook/issues) with
what you did and what happened.
