import type { ExpenseInput } from "@/lib/tax/types";

/**
 * Income-tax deduction for running costs: business share of each expense. GST-registered:
 * the GST-exclusive amount, since the GST comes back as a BAS credit. ATO "Effect of GST
 * credits on income tax deductions": "claim the amount of the purchase less any GST credit
 * you're entitled to". Source: https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits/effect-of-gst-credits-on-income-tax-deductions
 */
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
