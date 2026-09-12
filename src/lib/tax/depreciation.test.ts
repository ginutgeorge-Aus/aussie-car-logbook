import { expect, test } from "vitest";
import { CAR_LIMIT_CENTS, carLimitFor, diminishingValue } from "@/lib/tax/depreciation";

test("car limit lookup by FY", () => {
  expect(carLimitFor("2024-25")).toBe(6967400);
  expect(() => carLimitFor("1999-00")).toThrow();
});
test("diminishing value full year, 8yr life", () => {
  expect(diminishingValue({ openingValueCents: 4000000, daysHeld: 365, effectiveLifeYears: 8 })).toBe(1000000);
});
test("diminishing value part year", () => {
  expect(diminishingValue({ openingValueCents: 4000000, daysHeld: 182, effectiveLifeYears: 8 })).toBe(498630);
});
