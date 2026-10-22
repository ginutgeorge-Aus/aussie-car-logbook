import type { ExpenseInput } from "@/lib/tax/types";

/**
 * GST in a GST-inclusive amount: 1/11, rounded to the nearest cent (0.5 up).
 * ATO "Tax invoices": "the amount of GST should be rounded to the nearest cent (rounding 0.5 cents upwards)".
 * Source: https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices
 */
export function gstFromInclusive(amountInclCents: number): number {
  return Math.round(amountInclCents / 11);
}

/**
 * BAS GST credit: the business share of the GST paid. ATO "When you can claim a GST credit":
 * "you can only claim a GST credit for the part of the purchase relating to your business use".
 * Source: https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits/when-you-can-claim-a-gst-credit
 */
export function gstCredit(expenses: ExpenseInput[], businessPctRatio: number): number {
  const totalGst = expenses.reduce((s, e) => s + e.gstCents, 0);
  return Math.round(totalGst * businessPctRatio);
}

/** ATO: a tax invoice is required to claim a GST credit on purchases over $82.50 incl. GST. Source: https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits/when-you-can-claim-a-gst-credit */
export const TAX_INVOICE_THRESHOLD_CENTS = 8250;

/** ATO: tax invoices for sales of $1,000+ incl. GST must also show the buyer's identity or ABN. Source: https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices */
export const TAX_INVOICE_BUYER_ID_THRESHOLD_CENTS = 100000;

/**
 * Whether an expense's GST may be claimed on the BAS now: GST-free (nothing to
 * claim), at or under the tax-invoice threshold, or a tax invoice is held.
 */
export function gstCreditEligible(e: { amountInclCents: number; gstCents: number; taxInvoice: boolean }): boolean {
  return e.gstCents === 0 || e.amountInclCents <= TAX_INVOICE_THRESHOLD_CENTS || e.taxInvoice;
}
