import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Wires the local D1/R2 bindings into `next dev` via the OpenNext adapter.
initOpenNextCloudflareForDev();
