/// <reference types="@cloudflare/workers-types" />

// Ambient binding types for getCloudflareContext().env.
// Add the AI binding in slice 3b when OCR lands.
interface CloudflareEnv {
  DB: D1Database;
  RECEIPTS: R2Bucket;
}
