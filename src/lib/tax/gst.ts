import type { ExpenseInput } from "@/lib/tax/types";

export function gstFromInclusive(amountInclCents: number): number {
  return Math.round(amountInclCents / 11);
}

export function gstCredit(expenses: ExpenseInput[], businessPctRatio: number): number {
  const totalGst = expenses.reduce((s, e) => s + e.gstCents, 0);
  return Math.round(totalGst * businessPctRatio);
}
