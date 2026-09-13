/// <reference types="@cloudflare/workers-types" />

// Ambient binding types for getCloudflareContext().env.
interface CloudflareEnv {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  AI: Ai;
}
