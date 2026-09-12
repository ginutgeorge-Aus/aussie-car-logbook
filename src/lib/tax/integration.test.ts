import { expect, test } from "vitest";
import { businessPct, gstCredit, annualDeduction, basQuarter } from "@/lib/tax";

test("end-to-end over seed-like data", () => {
  const trips = [
    { km: 40, isBusiness: true },
    { km: 20, isBusiness: false },
  ];
  const pct = businessPct(trips); // 40/60
  const expenses = [
    { amountInclCents: 8900, gstCents: 809, dateISO: "2024-07-05", category: "fuel" as const },
    { amountInclCents: 45000, gstCents: 4091, dateISO: "2024-08-01", category: "service" as const },
  ];
  expect(basQuarter("2024-08-01").quarter).toBe(1);
  expect(gstCredit(expenses, pct)).toBe(Math.round((809 + 4091) * (40 / 60)));
  expect(annualDeduction(expenses, pct, true)).toBe(
    Math.round((8900 - 809 + 45000 - 4091) * (40 / 60)),
  );
});
