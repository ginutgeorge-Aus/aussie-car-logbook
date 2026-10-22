import type { ExpenseInput } from "@/lib/tax/types";

export function gstFromInclusive(amountInclCents: number): number {
  return Math.round(amountInclCents / 11);
}

export function gstCredit(expenses: ExpenseInput[], businessPctRatio: number): number {
  const totalGst = expenses.reduce((s, e) => s + e.gstCents, 0);
  return Math.round(totalGst * businessPctRatio);
}

/** ATO: a tax invoice is required to claim a GST credit on purchases over $82.50 incl. GST. */
export const TAX_INVOICE_THRESHOLD_CENTS = 8250;

/**
 * Whether an expense's GST may be claimed on the BAS now: GST-free (nothing to
 * claim), at or under the tax-invoice threshold, or a tax invoice is held.
 */
export function gstCreditEligible(e: { amountInclCents: number; gstCents: number; taxInvoice: boolean }): boolean {
  return e.gstCents === 0 || e.amountInclCents <= TAX_INVOICE_THRESHOLD_CENTS || e.taxInvoice;
}
