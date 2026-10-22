// Each rule tested here maps to its ATO source in docs/ato-rules.md.
import { expect, test } from "vitest";
import { gstFromInclusive, gstCredit, gstCreditEligible, TAX_INVOICE_THRESHOLD_CENTS } from "@/lib/tax/gst";

test("GST is 1/11 rounded to nearest cent", () => {
  expect(gstFromInclusive(11000)).toBe(1000); // $110 -> $10
  expect(gstFromInclusive(9625)).toBe(875);   // $96.25 -> $8.75
});
test("GST credit is businessPct x total GST, rounded", () => {
  const exp = [
    { amountInclCents: 11000, gstCents: 1000, dateISO: "2024-08-01", category: "fuel" as const },
    { amountInclCents: 5500, gstCents: 500, dateISO: "2024-08-10", category: "service" as const },
  ];
  expect(gstCredit(exp, 0.5)).toBe(750); // 0.5 * 1500
});
test("tax-invoice threshold is $82.50 incl GST", () => {
  expect(TAX_INVOICE_THRESHOLD_CENTS).toBe(8250);
});
test("GST credit eligibility follows the ATO tax-invoice rule", () => {
  // At the threshold: any receipt is enough.
  expect(gstCreditEligible({ amountInclCents: 8250, gstCents: 750, taxInvoice: false })).toBe(true);
  // Over it: needs a tax invoice.
  expect(gstCreditEligible({ amountInclCents: 8251, gstCents: 750, taxInvoice: false })).toBe(false);
  expect(gstCreditEligible({ amountInclCents: 8251, gstCents: 750, taxInvoice: true })).toBe(true);
  // GST-free: nothing to claim, never held back.
  expect(gstCreditEligible({ amountInclCents: 20000, gstCents: 0, taxInvoice: false })).toBe(true);
});
