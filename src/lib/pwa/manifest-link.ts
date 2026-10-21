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
