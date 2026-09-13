import { getCloudflareContext } from "@opennextjs/cloudflare";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function bucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.RECEIPTS;
}

function extFromType(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  return "bin";
}

export async function putReceipt(vehicleId: number, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Receipt must be an image.");
  if (file.size > MAX_BYTES) throw new Error("Receipt image is too large (max 10 MB).");
  const key = `receipts/${vehicleId}/${crypto.randomUUID()}.${extFromType(file.type)}`;
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
