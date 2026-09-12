import type { ExpenseInput } from "@/lib/tax/types";

export function annualDeduction(
  expenses: ExpenseInput[],
  businessPctRatio: number,
  gstRegistered: boolean,
): number {
  const base = expenses.reduce((s, e) => {
    const amt = gstRegistered ? e.amountInclCents - e.gstCents : e.amountInclCents;
    return s + amt;
  }, 0);
  return Math.round(base * businessPctRatio);
}
