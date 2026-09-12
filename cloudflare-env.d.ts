/// <reference types="@cloudflare/workers-types" />

// Ambient binding types for getCloudflareContext().env.
// Add R2 (RECEIPTS) and AI bindings in their own slices when first used.
interface CloudflareEnv {
  DB: D1Database;
}
