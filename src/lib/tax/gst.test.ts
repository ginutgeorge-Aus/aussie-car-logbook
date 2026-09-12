import { expect, test } from "vitest";
import { gstFromInclusive, gstCredit } from "@/lib/tax/gst";

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
