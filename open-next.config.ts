import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext adapter config for the Cloudflare Workers deploy target.
// Defaults are sufficient for this app (no incremental cache / queue overrides).
export default defineCloudflareConfig();
