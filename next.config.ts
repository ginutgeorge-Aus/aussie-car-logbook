import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB. The client compresses receipts to ~200KB, but a raw
      // upload (JS failed, old client) must still reach assertReceiptFile's
      // 10MB cap instead of dying in the framework. +1MB multipart headroom.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;

// Wires local D1/R2 bindings into `next dev` only. Must NOT run during a
// production `next build`: a remote binding in wrangler.toml would open a
// remote connection and fail demanding CLOUDFLARE_API_TOKEN (opennext runs
// the build non-interactively).
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
