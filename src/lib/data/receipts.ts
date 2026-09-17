import { getCloudflareContext } from "@opennextjs/cloudflare";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function bucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.RECEIPTS;
}

// Allowlist of raster image types only. SVG is deliberately excluded: an
// image/svg+xml object can carry inline <script> that executes when the
// receipt route serves it same-origin (stored XSS). Only these types are
// accepted and, in turn, ever set as the served Content-Type.
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export function assertReceiptFile(file: File): void {
  if (!ALLOWED_TYPES[file.type]) {
    throw new Error("Receipt must be a JPEG, PNG, WebP, or HEIC image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Receipt image is too large (max 10 MB).");
  }
}

// Optional descriptive bits woven into the R2 key so stored receipts are
// human-scannable (date_category_amount) instead of opaque UUIDs. A short
// random suffix still guarantees uniqueness.
export type ReceiptMeta = {
  date?: string; // ISO YYYY-MM-DD
  category?: string;
  amountInclCents?: number;
};

// Keeps only filename-safe chars; collapses the rest to single dashes.
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function receiptName(meta: ReceiptMeta | undefined, ext: string): string {
  const parts: string[] = [];
  if (meta?.date) parts.push(meta.date);
  if (meta?.category) parts.push(slug(meta.category));
  if (meta?.amountInclCents != null) parts.push((meta.amountInclCents / 100).toFixed(2).replace(".", "-"));
  parts.push(crypto.randomUUID().slice(0, 8));
  return `${parts.join("_")}.${ext}`;
}

export async function putReceipt(vehicleId: number, file: File, meta?: ReceiptMeta): Promise<string> {
  assertReceiptFile(file);
  const ext = ALLOWED_TYPES[file.type];
  const key = `receipts/${vehicleId}/${receiptName(meta, ext)}`;
  const b = await bucket();
  await b.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return key;
}

export async function getReceipt(key: string): Promise<R2ObjectBody | null> {
  const b = await bucket();
  return b.get(key);
}

export async function deleteReceipt(key: string): Promise<void> {
  if (!key) return;
  const b = await bucket();
  await b.delete(key);
}
