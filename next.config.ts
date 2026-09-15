import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Wires local D1/R2 bindings into `next dev` only. Must NOT run during a
// production `next build`: with the [ai] binding in wrangler.toml it opens a
// remote connection and fails demanding CLOUDFLARE_API_TOKEN (opennext runs
// the build non-interactively).
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
