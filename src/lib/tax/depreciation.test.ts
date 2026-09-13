import { expect, test, describe, it } from "vitest";
import { carLimitFor, diminishingValue, depreciationForFy, EFFECTIVE_LIFE_YEARS } from "@/lib/tax/depreciation";

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

describe("depreciationForFy", () => {
  // Car bought 2023-07-01 for $40,000 (under the 2023-24 limit). Full first year.
  // rate = 2/8 = 0.25. Year 1 (366 days, leap year): 4000000 * (366/365) * 0.25 = 1002739.73 -> 1002740.
  it("computes a full first-year decline", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2023-07-01", fyLabel: "2023-24" }),
    ).toBe(1002740);
  });

  // Year 2 opening = 4000000 - 1002740 = 2997260; decline = 2997260 * 0.25 = 749315.
  it("rolls the written-down value forward to year 2", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2023-07-01", fyLabel: "2024-25" }),
    ).toBe(749315);
  });

  // Part-year purchase 2024-04-01 (FY 2023-24): daysHeld=91.
  // 4000000 * (91/365) * 0.25 = 249315.06.. -> 249315 (rounded).
  it("pro-rates the purchase-year decline by days held", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2024-04-01", fyLabel: "2023-24" }),
    ).toBe(249315);
  });

  // Cost above the 2024-25 car limit ($69,674) is capped to the limit as the base.
  // opening = 6967400; year 1 decline = 6967400 * 0.25 = 1741850.
  it("caps the cost base at the car cost limit of the purchase FY", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 9000000, purchaseDateISO: "2024-07-01", fyLabel: "2024-25" }),
    ).toBe(1741850);
  });

  it("returns 0 for an FY before the purchase FY", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2024-07-01", fyLabel: "2023-24" }),
    ).toBe(0);
  });

  it("exports an 8-year effective life default", () => {
    expect(EFFECTIVE_LIFE_YEARS).toBe(8);
  });

  // Purchase 2024-07-01 for $40,000, rolled to FY2027-28 which contains the
  // leap day 2028-02-29 (366-day FY). Chain of full-year diminishing declines:
  //   FY24-25 (365d): open 4000000, decline 1000000 -> close 3000000
  //   FY25-26 (365d): decline 750000 -> close 2250000
  //   FY26-27 (365d): decline 562500 -> close 1687500
  //   FY27-28 (366d): round(1687500 * 0.25 * 366/365) = 423031  (would be 421875 if 365 were used)
  it("uses actual (366) days for a later leap financial year", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2024-07-01", fyLabel: "2027-28" }),
    ).toBe(423031);
  });
});
