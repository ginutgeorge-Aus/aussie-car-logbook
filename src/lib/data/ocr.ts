import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildReceiptPrompt } from "@/lib/ocr/prompt";

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

// Sends the receipt image to Workers AI vision and returns the model's raw
// text response for parseOcrResult to normalize. Throws on binding/model
// error — the caller (scanReceiptAction) catches and degrades to manual entry.
export async function runReceiptOcr(file: File): Promise<unknown> {
  const { env } = await getCloudflareContext({ async: true });
  const bytes = [...new Uint8Array(await file.arrayBuffer())];
  const res = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: "You extract structured data from receipt images." },
      { role: "user", content: buildReceiptPrompt() },
    ],
    image: bytes,
  } as never);
  return (res as { response?: unknown }).response ?? res;
}
