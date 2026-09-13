import type { ExpenseCategory } from "@/lib/tax/types";

export type OcrResult = {
  dateISO: string | null;
  amountInclCents: number | null;
  gstCents: number | null;
  vendor: string | null;
  category: ExpenseCategory | null;
};

export type OcrActionResult =
  | { ok: true; value: OcrResult }
  | { ok: false; error: string };
