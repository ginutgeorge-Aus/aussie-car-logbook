import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";

// EXPENSE_CATEGORIES already excludes "depreciation" (computed, not entered).
export function buildReceiptPrompt(): string {
  const codes = EXPENSE_CATEGORIES.map((c) => c.code).join(", ");
  return [
    "You are reading an Australian vehicle-expense receipt.",
    "Return ONLY a single JSON object, no prose, with exactly these keys:",
    `{"date": string, "total": string, "gst": string, "vendor": string, "category": string}`,
    "- date: the purchase date exactly as printed (e.g. 14/03/2026).",
    "- total: the total amount paid including GST, digits only (e.g. 82.50).",
    "- gst: the GST/tax amount if printed, otherwise an empty string.",
    "- vendor: the business name.",
    `- category: the best match from [${codes}], or an empty string if unsure.`,
    "Use an empty string for any field you cannot read. Do not guess.",
  ].join("\n");
}
