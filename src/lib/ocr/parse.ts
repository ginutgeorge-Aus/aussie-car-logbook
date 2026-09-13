import { isExpenseCategory } from "@/lib/expenses/categories";
import type { OcrResult } from "@/lib/ocr/types";

const ALL_NULL: OcrResult = {
  dateISO: null, amountInclCents: null, gstCents: null, vendor: null, category: null,
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function asObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") return null;
  const m = raw.match(/\{[\s\S]*\}/); // first {...} block, tolerates fences/prose
  if (!m) return null;
  try {
    const parsed: unknown = JSON.parse(m[0]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function toIso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function parseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // ISO
  if (m) return toIso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); // DD/MM/YYYY (AU day-first)
  if (m) return toIso(fullYear(+m[3]), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})$/); // DD Mon YYYY
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return toIso(fullYear(+m[3]), mo, +m[1]);
  }
  return null;
}

function parseCents(v: unknown): number | null {
  if (typeof v === "number") {
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  }
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function parseVendor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === "null" || s.length > 120) return null;
  return s;
}

function parseCategory(v: unknown): OcrResult["category"] {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "depreciation") return null; // computed, never OCR'd
  return isExpenseCategory(s) ? s : null;
}

export function parseOcrResult(raw: unknown): OcrResult {
  const o = asObject(raw);
  if (!o) return { ...ALL_NULL };
  const amountInclCents = parseCents(o.total);
  let gstCents = parseCents(o.gst);
  if (gstCents !== null && amountInclCents !== null && gstCents > amountInclCents) {
    gstCents = amountInclCents; // clamp GST to total
  }
  return {
    dateISO: parseDate(o.date),
    amountInclCents,
    gstCents,
    vendor: parseVendor(o.vendor),
    category: parseCategory(o.category),
  };
}
