import { getReceipt } from "@/lib/data/receipts";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const objectKey = key.join("/");
  // Defence-in-depth: this route only ever serves receipt objects. Restrict it
  // to the receipts/ prefix so it can't be used to read other bucket objects
  // (all access is already gated by Cloudflare Access; this bounds the blast
  // radius if the bucket is ever shared). R2 is a flat keyspace, so this is a
  // prefix check, not a filesystem path check.
  if (!objectKey.startsWith("receipts/")) return new Response("Not found", { status: 404 });
  const object = await getReceipt(objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
