# GLB-9 PWA Install Behind Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (small plan, inline) — steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app installs cleanly from behind Cloudflare Access on iPhone (Safari → Add to Home Screen) and desktop Chrome. The manifest loads with the Access cookie, it has a stable `id`, the template leftovers are gone, and offline still shows a clear "you're offline" screen.

**Architecture:** This needs no new dependencies and no dashboard change. Drop `metadata.manifest`, because Next only adds `crossOrigin` to that link on Vercel preview builds. Instead, render the `<link rel="manifest" crossOrigin="use-credentials">` ourselves from a tiny pure module (`src/lib/pwa/`) so it can be unit-tested. Add `id` to the static `public/manifest.webmanifest` and guard it with a vitest test that also checks the icon files and their PNG sizes. Delete the unused create-next-app assets. Keep the service worker's offline approach as it is (YAGNI).

**Tech Stack:** Next.js 16.3 App Router (metadata API), static `public/` assets served by OpenNext/Workers assets, Vitest (node env), Cloudflare Access.

## Global Constraints

- Package manager is **pnpm via corepack**: `corepack pnpm test`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm build`.
- Vitest only collects `src/**/*.test.ts` in the `node` environment. Put testable logic in a pure `.ts` module and don't render TSX in tests (see `.claude/rules/testing.md`).
- Public repo: no account IDs or real hostnames in docs/tests. Use `<your-app>.workers.dev` placeholders.
- The service worker must keep **never caching** API responses, mutations or receipt images (a tax app must not show stale financial data).
- Work on a `fix/glb-9-pwa-install` branch off `main`. Do not build on `glb3-fix`.

---

## Findings (investigated 2026-10-07 against working tree)

| # | Ticket claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Manifest fetched without credentials behind Access → login redirect, not installable | **CONFIRMED** (code + spec; not yet reproduced live) | `src/app/layout.tsx:20` sets `metadata.manifest: "/manifest.webmanifest"`. Next renders it at `node_modules/next/dist/lib/metadata/metadata.js:292-297` with `crossOrigin: !manifestOrigin && process.env.VERCEL_ENV === 'preview' ? 'use-credentials' : undefined`, so **no crossorigin attribute on Cloudflare**. The HTML spec fetches `<link rel=manifest>` with credentials mode `omit` unless `crossorigin="use-credentials"`, so the `CF_Authorization` cookie isn't sent and Access 302s to `<team>.cloudflareaccess.com`. The manifest parse then fails, and Chrome reports "No manifest" / not installable. The metadata API has **no option** to set it (`generate-metadata.md` §manifest shows href only, and `next.config` `crossOrigin` only affects `next/script`). |
| 1b | (related) SW + icons behind Access | **Not a problem** | `navigator.serviceWorker.register("/sw.js")` (`src/components/ServiceWorkerRegister.tsx:11`) is a same-origin fetch that sends cookies. `sw.js` `addAll` precache uses default `credentials: "same-origin"` (`public/sw.js:17`). Chrome fetches manifest icons in the page's context, and the apple-touch-icon is a normal page subresource. |
| 2 | Maskable icons unpadded | **REFUTED** | `public/icons/icon-{192,512}.png` (and `apple-touch-icon.png`, 180) are full-bleed opaque green `#15803d` squares. The white steering-wheel glyph's farthest pixel is at **34% of width** from centre, which is inside the 40% maskable safe-zone radius (measured by decoding the PNGs). The manifest declares separate `any` and `maskable` entries (`public/manifest.webmanifest:12-15`), which is valid. Nothing gets cropped. No regeneration needed; we'll eyeball it once in DevTools (Verify). |
| 3 | No manifest `id` | **CONFIRMED** | `public/manifest.webmanifest:1-17` has no `id`. Chrome falls back to `start_url`, which works but isn't stable if `start_url` ever changes. Add `"id": "/"`. |
| 4 | Leftover 0-byte template SVGs | **PARTLY REFUTED — not 0-byte, but leftover** | `public/{file,globe,next,vercel,window}.svg` are 128–1375 bytes (create-next-app originals, dated Sep 12). `grep` finds **no references** in `src/`, `docs/`, `README.md`, `wiki/`. Also found: `src/app/favicon.ico` is the byte-identical create-next-app favicon (md5 `c30c7d42…` = `create-next-app@16.3.4/templates/app-tw/ts/app/favicon.ico`), i.e. the Next/Vercel logo. Remove all six. `metadata.icons.icon` already points at `/icons/icon-192.png` (`layout.tsx:27`). |
| 5 | Offline = static message only | **CONFIRMED — by design, keep** | `public/sw.js:9-15,35-42`: network-first navigations fall back to an inline "You're offline" page. Static assets and icons use SWR, and everything else passes through. This is deliberate (`sw.js:2-4`) and matches `wiki/FAQ.md:48-50`. Chrome no longer needs an offline-capable `fetch` handler to be installable. No change, apart from a cache-name bump so clients pick up the new icons/manifest promptly. |

### Decision: `use-credentials` vs Access bypass

**Chosen: `crossOrigin="use-credentials"` on a hand-rendered manifest link.**
- It's code-only, so every self-hoster gets it on upgrade. There's no per-user dashboard step and no doc burden.
- With a bypass, the manifest, `sw.js` and icons would be publicly readable, and each self-hoster would have to add a Bypass policy. The README/wiki default flow is the one-click **Worker → Access tab → All traffic**, which offers no per-path bypass. Users would need a manual self-hosted Access app per path, which is error-prone. The manifest reveals no secrets, but the bypass isn't worth that cost.
- Edge case: if the Access session has **expired** when the browser re-fetches the manifest, the fetch still redirects. That's harmless, because the browser keeps the installed app's last good manifest, and the next authenticated page load re-fetches it.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/pwa/manifest-link.ts` | **Create.** `MANIFEST_HREF` + `manifestLinkProps` (pure constants) |
| `src/lib/pwa/manifest-link.test.ts` | **Create.** Asserts `use-credentials` + href |
| `src/lib/pwa/manifest.test.ts` | **Create.** Validates `public/manifest.webmanifest` (id, start_url/scope, icons exist, PNG IHDR size matches `sizes`, maskable 192+512 present) and that template leftovers are absent |
| `src/app/layout.tsx` | **Modify.** Remove `manifest:` from `metadata`; render `<head><link {...manifestLinkProps} /></head>` |
| `public/manifest.webmanifest` | **Modify.** Add `"id": "/"` |
| `public/sw.js` | **Modify.** `CACHE = "glb-v2"` (one line) |
| `public/{file,globe,next,vercel,window}.svg`, `src/app/favicon.ico` | **Delete** |
| `wiki/Setup-Guide.md` (Step 9) | **Modify.** Exact iPhone + desktop Chrome install steps; note you sign in once more inside the installed app |

Size: **S** (about 40 logic lines, 3 small new files, 6 deletions).

---

### Task 1: Manifest link with credentials (pure module + layout)

**Files:**
- Create: `src/lib/pwa/manifest-link.ts`, `src/lib/pwa/manifest-link.test.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write the failing test** — `src/lib/pwa/manifest-link.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { MANIFEST_HREF, manifestLinkProps } from "@/lib/pwa/manifest-link";

describe("manifestLinkProps", () => {
  it("sends the Access cookie with the manifest fetch", () => {
    // Without this the browser fetches the manifest credential-less and
    // Cloudflare Access redirects it to the login page → not installable.
    expect(manifestLinkProps.crossOrigin).toBe("use-credentials");
  });

  it("points at the static manifest", () => {
    expect(manifestLinkProps).toEqual({
      rel: "manifest",
      href: MANIFEST_HREF,
      crossOrigin: "use-credentials",
    });
    expect(MANIFEST_HREF).toBe("/manifest.webmanifest");
  });
});
```

- [ ] **Step 2: Run, expect FAIL (module not found)**

`corepack pnpm test src/lib/pwa/manifest-link.test.ts`

- [ ] **Step 3: Implement** — `src/lib/pwa/manifest-link.ts`

```ts
/** Path of the static web app manifest in `public/`. */
export const MANIFEST_HREF = "/manifest.webmanifest";

/**
 * Props for the `<link rel="manifest">` tag. Rendered by hand in the root
 * layout because Next's `metadata.manifest` only adds `crossOrigin` on Vercel
 * preview builds. Behind Cloudflare Access the manifest must be fetched with
 * credentials or Access redirects it to the login page.
 */
export const manifestLinkProps = {
  rel: "manifest",
  href: MANIFEST_HREF,
  crossOrigin: "use-credentials",
} as const;
```

- [ ] **Step 4: Run, expect PASS** — same command.

- [ ] **Step 5: Wire into layout** — `src/app/layout.tsx`

```diff
+import { manifestLinkProps } from "@/lib/pwa/manifest-link";
 ...
   applicationName: "Ginoo's Log Book",
-  manifest: "/manifest.webmanifest",
+  // manifest: rendered manually in <head> with crossOrigin="use-credentials" (GLB-9)
   appleWebApp: {
 ...
     <html lang="en" className={...}>
+      <head>
+        <link {...manifestLinkProps} />
+      </head>
       <body className="min-h-full flex flex-col">
```

Do **not** keep `metadata.manifest` as well, or the page would emit two manifest links and the browser uses the first (credential-less) one.

- [ ] **Step 6: Typecheck** — `corepack pnpm exec next typegen && corepack pnpm exec tsc --noEmit`

---

### Task 2: Manifest `id` + manifest/asset guard test

**Files:**
- Create: `src/lib/pwa/manifest.test.ts`
- Modify: `public/manifest.webmanifest`

- [ ] **Step 1: Write the failing test** — `src/lib/pwa/manifest.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const pub = (p: string) => path.join(process.cwd(), "public", p.replace(/^\//, ""));
const manifest = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8"));

/** Width/height from a PNG's IHDR chunk (bytes 16-23, big-endian). */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("manifest.webmanifest", () => {
  it("has a stable id inside scope", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("every icon exists and its PNG size matches `sizes`", () => {
    for (const icon of manifest.icons) {
      const file = pub(icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = pngSize(file);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  it("ships any + maskable icons at 192 and 512", () => {
    for (const purpose of ["any", "maskable"]) {
      const sizes = manifest.icons.filter((i: { purpose: string }) => i.purpose === purpose).map((i: { sizes: string }) => i.sizes);
      expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    }
  });
});

describe("template leftovers", () => {
  it.each(["file.svg", "globe.svg", "next.svg", "vercel.svg", "window.svg"])("public/%s removed", (f) => {
    expect(existsSync(pub(f))).toBe(false);
  });
  it("create-next-app favicon removed", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/favicon.ico"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (`id` undefined; leftovers present)

`corepack pnpm test src/lib/pwa/manifest.test.ts`

- [ ] **Step 3: Add `id`** — `public/manifest.webmanifest`, after `short_name`:

```json
  "id": "/",
```

- [ ] **Step 4: Delete leftovers**

```bash
rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg src/app/favicon.ico
```

(Use `git rm` when committing.) With `favicon.ico` gone, the tab icon comes from `metadata.icons.icon` → `/icons/icon-192.png`. Browsers that blindly request `/favicon.ico` get a harmless 404.

- [ ] **Step 5: Run, expect PASS** — same command, then the full suite: `corepack pnpm test`

---

### Task 3: Service-worker cache bump

**Files:** Modify `public/sw.js:5`

- [ ] **Step 1:** `const CACHE = "glb-v1";` → `const CACHE = "glb-v2";`. The changed bytes trigger an SW update, and `activate` deletes `glb-v1`, so the new manifest/icons aren't served stale from an SWR cache. Nothing else changes. Offline stays the inline message, and API/receipts/mutations are still never cached.
- [ ] **Step 2:** `node --check public/sw.js` (syntax only; the SW has no unit tests, and adding a SW test harness is out of scope).

---

### Task 4: Install docs (feature PR → docs in same PR)

**Files:** Modify `wiki/Setup-Guide.md` Step 9 (~line 133)

- [ ] Replace the 3 generic steps with:
  - **iPhone:** open the app in **Safari**, sign in → **Share** → **Add to Home Screen** → **Add**. Open it from the home screen. **You'll sign in once more**, because the installed app keeps its own login separate from Safari.
  - **Android / desktop Chrome or Edge:** sign in → click the **install icon** in the address bar (or menu → **Install Ginoo's Log Book**).
  - Tip: the installed app asks you to sign in again whenever your Access session expires. Owners can lengthen it in Zero Trust → Access → your app → **Session duration**.
- [ ] `wiki/FAQ.md:48-50` (offline) is already accurate. Leave it.

---

## Verification

1. `corepack pnpm test` — all green, including both new `src/lib/pwa/*.test.ts`.
2. `corepack pnpm exec tsc --noEmit` (after `next typegen`), then `corepack pnpm build`, which is the CI gate.
3. Local head check: `corepack pnpm preview`, then `curl -s localhost:8787/ | grep -o '<link rel="manifest"[^>]*>'` → exactly **one** match, containing `crossorigin="use-credentials"`. Also `curl -sI localhost:8787/next.svg` → 404.
4. **Deployed, behind Access** (needs a deploy, so owner or PO):
   - Desktop Chrome → DevTools → **Application → Manifest**: no errors or warnings, **App id** reads `/`, and the identity and icons render. Tick **"Show only the minimum safe area for maskable icons"**. The wheel should sit fully inside the circle (confirms finding 2).
   - **Network** tab, filter `manifest`: status **200** `application/manifest+json`, **not** a 302 to `*.cloudflareaccess.com`. Request headers include `Cookie: CF_Authorization=…`.
   - **Application → Service workers**: `sw.js` activated. **Cache storage** shows only `glb-v2`.
   - Install icon appears in the omnibox → install → it opens in its own window with the green icon.
   - Offline check: DevTools Network → **Offline** → reload → "You're offline" screen.
   - Lighthouse 12+ has no PWA category. Use the Application tab's **Installability** section instead (it should show no errors).
5. **iPhone (Safari):** Share → Add to Home Screen → the icon is the green wheel (not a page screenshot or the Next logo). Launch it: standalone (no Safari chrome), the Access sign-in works inside it, and the dashboard loads. Airplane mode → relaunch → offline screen.

## Owner-only steps

- **Deploy and run the live install checks** (Verification steps 4 and 5). They need the real Access-protected URL and an iPhone.
- *Optional:* raise the Access **Session duration** (e.g. 1 month) so the installed app doesn't re-prompt for login often. This is a dashboard setting with no code involved.
- No Access bypass policy is needed. Do **not** add one.

## PO decisions (confirmed by PO 2026-10-07 — all defaults)

- **Offline scope = keep the "You're offline" message only.** There's no cached read-only view of trips/expenses, because a tax app must not show stale financial figures. A read-only offline cache or offline trip capture with sync would be a separate follow-up card, if wanted.

## Follow-ups (not in this card)

- Offline trip entry with background sync (only if PO wants it, per the decision above).
- Generate a real `favicon.ico` from the wheel icon if the 404 on `/favicon.ico` ever matters (cosmetic).
