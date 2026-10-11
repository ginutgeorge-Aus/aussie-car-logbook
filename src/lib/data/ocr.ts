import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildReceiptPrompt } from "@/lib/ocr/prompt";
import { buildOcrMessages, extractOcrResponse, toOcrError } from "@/lib/ocr/model";

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

// Sends the receipt image to Workers AI vision and returns the model's raw
// response for parseOcrResult to normalize. Throws on binding/model error —
// the caller (scanReceiptAction) logs it and degrades to manual entry.
export async function runReceiptOcr(file: File): Promise<unknown> {
  const { env } = await getCloudflareContext({ async: true });
  const messages = buildOcrMessages(buildReceiptPrompt(), file.type, new Uint8Array(await file.arrayBuffer()));
  let res;
  try {
    res = await env.AI.run(MODEL, { messages });
  } catch (e) {
    throw toOcrError(e);
  }
  return extractOcrResponse(res);
}
