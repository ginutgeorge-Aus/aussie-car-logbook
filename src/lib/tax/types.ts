export type ExpenseCategory =
  | "fuel" | "rego" | "insurance" | "service" | "repairs"
  | "tyres" | "interest" | "lease" | "depreciation" | "other";

export type TripLeg = { km: number; isBusiness: boolean };

export type ExpenseInput = {
  amountInclCents: number;
  gstCents: number;
  dateISO: string; // YYYY-MM-DD
  category: ExpenseCategory;
};
