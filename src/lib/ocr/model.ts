// Pure helpers for the Workers AI vision call in src/lib/data/ocr.ts.

/** Thrown when Meta's licence hasn't been accepted on this account yet. */
export class OcrLicenceError extends Error {}

/** Documented input: a base64 data URI in an image_url content part. */
export function buildOcrMessages(prompt: string, mimeType: string, bytes: Uint8Array) {
  const url = `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  return [
    { role: "system", content: "You extract structured data from receipt images." },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url } },
      ],
    },
  ];
}

/** Llama 3.2 needs a one-time "agree" per account (error 5016). See docs/ocr.md. */
export function toOcrError(e: unknown): unknown {
  return /\b5016\b|\bagree\b/i.test(String(e)) ? new OcrLicenceError(String(e)) : e;
}

/** `response` is usually JSON text; some model versions return it parsed. */
export function extractOcrResponse(res: unknown): unknown {
  const out = (res as { response?: unknown } | null)?.response;
  const empty = out == null || (typeof out === "string" && out.trim() === "");
  if (empty || (typeof out !== "string" && typeof out !== "object")) {
    throw new Error(`OCR: unexpected model output ${JSON.stringify(res)?.slice(0, 200)}`);
  }
  return out;
}
