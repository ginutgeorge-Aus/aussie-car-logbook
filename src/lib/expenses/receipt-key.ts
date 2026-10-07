// Pure R2 object-key naming for receipts (I/O lives in src/lib/data/receipts.ts).

// Optional descriptive bits woven into the R2 key so stored receipts are
// human-scannable (date_category_amount) instead of opaque UUIDs. A full UUID
// suffix still guarantees uniqueness (R2 is last-writer-wins per key).
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

export function receiptName(meta: ReceiptMeta | undefined, ext: string, uuid: string): string {
  const parts: string[] = [];
  if (meta?.date && /^\d{4}-\d{2}-\d{2}$/.test(meta.date)) parts.push(meta.date); // never raw input in a key
  if (meta?.category) parts.push(slug(meta.category));
  if (meta?.amountInclCents != null) parts.push((meta.amountInclCents / 100).toFixed(2).replace(".", "-"));
  parts.push(uuid);
  return `${parts.join("_")}.${ext}`;
}
