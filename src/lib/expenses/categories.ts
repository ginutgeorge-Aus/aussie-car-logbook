import type { ExpenseCategory } from "@/lib/tax/types";

// Display order + labels for the expense form dropdown.
// `code` is the value stored in DB (an ExpenseCategory). "depreciation" is
// computed, not user-entered, so it is intentionally omitted here.
export const EXPENSE_CATEGORIES = [
  { code: "fuel", label: "Fuel" },
  { code: "rego", label: "Registration" },
  { code: "insurance", label: "Insurance" },
  { code: "service", label: "Servicing" },
  { code: "repairs", label: "Repairs" },
  { code: "tyres", label: "Tyres" },
  { code: "interest", label: "Interest" },
  { code: "lease", label: "Lease" },
  { code: "other", label: "Other" },
] as const satisfies ReadonlyArray<{ code: ExpenseCategory; label: string }>;

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return EXPENSE_CATEGORIES.some((c) => c.code === v);
}

/**
 * Friendly label for a stored category code (e.g. "rego" → "Registration").
 * Covers the computed "depreciation" category too; unknown codes pass through.
 */
export function categoryLabel(code: string): string {
  if (code === "depreciation") return "Depreciation";
  return EXPENSE_CATEGORIES.find((c) => c.code === code)?.label ?? code;
}
