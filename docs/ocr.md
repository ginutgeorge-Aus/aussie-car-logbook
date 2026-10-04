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
3. **One-time licence step (also needed on your deployed instance).** Meta requires
   each Cloudflare account to accept the Llama 3.2 licence/AUP before first use.
   Until then every scan fails with error `5016` and the form shows "Receipt
   scanning needs one-time setup". To accept, send the prompt `agree` once:
   - **Dashboard:** Workers AI → Models → `llama-3.2-11b-vision-instruct` →
     playground → send the message `agree`.
   - **API:** `curl https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai/run/@cf/meta/llama-3.2-11b-vision-instruct -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -d '{"prompt":"agree"}'`

   The app doesn't accept the licence for you: agreeing to Meta's terms is your call.

## Flow

1. Tap **Scan receipt** → take a photo or pick one from the library.
2. The browser downscales it and re-encodes it as JPEG (~150 KB, `src/lib/image/compress.ts`).
   HEIC/PNG become JPEG here, so every photo is scannable and the multi-MB camera
   original never leaves the phone.
3. `scanReceiptAction` sends it to the model as a base64 data URI (`image_url`
   content part, `src/lib/ocr/model.ts`) and pre-fills the form.

## Behaviour / limits

- Scanning does **not** upload to R2. The compressed image is uploaded only when the
  expense is saved.
- Server Actions accept bodies up to 11 MB (`next.config.ts`), so an uncompressed
  upload still reaches the 10 MB receipt cap instead of failing at Next's 1 MB default.
- AI/parse failures fall back to manual entry. The real error is logged server-side
  (`wrangler tail` / Workers logs: `scanReceiptAction: OCR failed`); the user sees a
  short message.
- GST: OCR fills the GST field only when a GST/tax line is printed on the receipt. If
  none is printed, the field is left blank and the form auto-computes GST as 1/11 of the
  total on save — tick **GST-free** for a genuinely non-GST vendor so no GST is claimed.
