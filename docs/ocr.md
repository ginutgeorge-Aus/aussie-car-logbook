# Receipt OCR (Workers AI)

The "Scan receipt" button on the expense form sends the image to a Cloudflare
Workers AI vision model (`@cf/meta/llama-3.2-11b-vision-instruct`) and pre-fills
the form. The user reviews every field before saving — OCR is never authoritative
and never auto-saves.

## Enabling locally

1. `[ai]` binding is already in `wrangler.toml.example` (`binding = "AI"`). Copy it
   into your gitignored `wrangler.toml`.
2. The AI binding makes `@opennextjs/cloudflare` require a Cloudflare API token at
   build/dev time. Put `CLOUDFLARE_API_TOKEN=<token with Workers AI access>` in your
   gitignored `.dev.vars` (see `.env.example`). Without the `[ai]` binding, the rest
   of the app builds and runs normally; only OCR is unavailable.
3. First use of the Llama vision model on a Cloudflare account requires a one-time
   agreement to Meta's license/AUP (Cloudflare dashboard → Workers AI, or via API).

## Behaviour / limits

- Scanning does **not** upload to R2. The image is uploaded only when the expense is
  saved (unchanged from slice 3a).
- HEIC images can be uploaded and saved but **cannot be scanned** (the vision model
  expects JPEG/PNG/WebP); the button reports this and manual entry still works.
- Any AI/parse failure degrades silently to manual entry.
- GST: OCR fills the GST field only when a GST/tax line is printed on the receipt. If
  none is printed, the field is left blank and the form auto-computes GST as 1/11 of the
  total on save — tick **GST-free** for a genuinely non-GST vendor so no GST is claimed.
