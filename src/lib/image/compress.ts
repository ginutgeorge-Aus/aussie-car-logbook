// Client-only receipt compressor. Downscales + re-encodes to JPEG so the blob
// sent to Workers AI OCR and stored in R2 stays tiny (target < 150 KB). Also
// normalizes HEIC/PNG to JPEG via the canvas, so any camera output becomes
// scannable and cheap to store.

const TARGET_BYTES = 150 * 1024; // 150 KB
const START_EDGE = 1600; // longest-edge px cap on first attempt
const START_QUALITY = 0.7;
const MIN_QUALITY = 0.4;
const MIN_EDGE = 800;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    img.src = url;
  });
}

function encode(img: HTMLImageElement, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't compress that image."))),
      "image/jpeg",
      quality,
    );
  });
}

// Returns a JPEG File under ~150 KB. Steps quality down first, then dimensions,
// stopping at the floor even if still slightly over (rare for real receipts).
export async function compressReceipt(file: File): Promise<File> {
  const img = await loadImage(file);
  let quality = START_QUALITY;
  let maxEdge = START_EDGE;
  let blob = await encode(img, maxEdge, quality);

  while (blob.size > TARGET_BYTES && !(quality <= MIN_QUALITY && maxEdge <= MIN_EDGE)) {
    if (quality > MIN_QUALITY) quality = Math.max(MIN_QUALITY, quality - 0.1);
    else maxEdge = Math.max(MIN_EDGE, Math.round(maxEdge * 0.8));
    blob = await encode(img, maxEdge, quality);
  }

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
