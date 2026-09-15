# FAQ

### Is it really free?
Yes. The app is open source and runs on Cloudflare's free tier. You only need
a free Cloudflare account. No monthly fee, no credit card.

### Who can see my data?
Only you. Your trips, expenses, and receipt photos live inside **your own**
Cloudflare account, protected by a sign-in lock (Cloudflare Access) that you
set up. The people who wrote the app cannot see any of it.

### Do I need to know how to code?
No. Setup involves copying and pasting a few commands once — no coding, no
understanding of code required. After that, it's a normal phone app. See
[What You Need](What-You-Need).

### Is this tax advice?
No. It does the sums using the ATO **logbook method**, but you're responsible
for your claim. Check with a registered tax agent if unsure.

### Cents-per-km or logbook method?
This app is built for the **logbook method** (claim your actual business-use %
of real costs). It does not do the cents-per-kilometre method.

### Do I have to log every trip forever?
No — the ATO logbook method needs a **continuous 12-week logbook** that's
representative of your driving, and that percentage can be used for up to 5
years. See [Understanding the Logbook Method](Understanding-the-Logbook-Method).

### Does the receipt scanner always get it right?
Usually, but not always. **Always check every field** after scanning before
you save. A wrong amount means a wrong claim.

### Will updating the app delete my data?
No. Updates are non-destructive — your trips and receipts survive. Still,
taking a backup before a big update is smart (see below).

### How do I back up my data?
Your data is a Cloudflare **D1** database and an **R2** bucket in your account.
You can export the database with Wrangler
(`wrangler d1 export ginoos-log-book`) and download your receipt images from
the R2 bucket in the Cloudflare dashboard. Keep a copy somewhere safe.

### Can more than one person use it?
Each deployment is for **one person**. If two people need it, each sets up
their own copy (each is free). There's no shared multi-user mode.

### Can I use it offline?
It's a PWA, so it opens like an app, but it needs internet to save and read
your data (which lives in the cloud).

### It says depreciation was left out for a year — why?
Your car's purchase-year cost limit isn't set in the app yet. It's a one-line
update. See [Troubleshooting](Troubleshooting).

### I got locked out / the sign-in isn't working.
That's the Cloudflare Access lock. Check your Access policy in the Cloudflare
dashboard lists the right email. See [Troubleshooting](Troubleshooting).

### Where's the source code / how do I report a bug?
On GitHub:
[aussie-car-logbook](https://github.com/ginutgeorge-Aus/aussie-car-logbook).
Open an issue there. Report security problems privately per the repo's
SECURITY.md.
