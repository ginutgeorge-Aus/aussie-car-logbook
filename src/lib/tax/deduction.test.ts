import { expect, test } from "vitest";
import { annualDeduction } from "@/lib/tax/deduction";

const exp = [
  { amountInclCents: 11000, gstCents: 1000, dateISO: "2024-08-01", category: "fuel" as const },
];

test("GST-registered deducts on GST-exclusive base", () => {
  // base = 11000 - 1000 = 10000; 60% -> 6000
  expect(annualDeduction(exp, 0.6, true)).toBe(6000);
});
test("not GST-registered deducts on GST-inclusive base", () => {
  // base = 11000; 60% -> 6600
  expect(annualDeduction(exp, 0.6, false)).toBe(6600);
});
