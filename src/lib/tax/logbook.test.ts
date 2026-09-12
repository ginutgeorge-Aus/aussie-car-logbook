import { expect, test } from "vitest";
import { businessPct, businessPctRounded } from "@/lib/tax/logbook";

const trips = [
  { km: 100, isBusiness: true },
  { km: 100, isBusiness: true },
  { km: 100, isBusiness: false },
];

test("business ratio is businessKm/totalKm", () => {
  expect(businessPct(trips)).toBeCloseTo(200 / 300, 10);
});
test("rounded percentage", () => {
  expect(businessPctRounded(trips)).toBe(67);
});
test("no trips -> 0, no divide-by-zero", () => {
  expect(businessPct([])).toBe(0);
  expect(businessPctRounded([])).toBe(0);
});
