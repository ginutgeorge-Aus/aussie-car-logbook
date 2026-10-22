// Each rule tested here maps to its ATO source in docs/ato-rules.md.
import { expect, test, describe, it } from "vitest";
import {
  carLimitFor,
  carPurchaseGstCents,
  diminishingValue,
  depreciationForFy,
  EFFECTIVE_LIFE_YEARS,
} from "@/lib/tax/depreciation";

test("car limit lookup by FY matches the ATO table", () => {
  expect(carLimitFor("2020-21")).toBe(5913600);
  expect(carLimitFor("2021-22")).toBe(6073300);
  expect(carLimitFor("2022-23")).toBe(6474100);
  expect(carLimitFor("2023-24")).toBe(6810800); // $68,108 (was wrongly $68,649)
  expect(carLimitFor("2024-25")).toBe(6967400);
  expect(carLimitFor("2025-26")).toBe(6967400);
  expect(carLimitFor("2026-27")).toBe(6988300);
});
test("car limit lookup fails loudly for an unpublished/unknown FY", () => {
  expect(() => carLimitFor("1999-00")).toThrow(/1999-00/);
  expect(() => carLimitFor("2027-28")).toThrow(/2027-28/);
});

describe("carPurchaseGstCents", () => {
  it("is the GST shown on the tax invoice", () => {
    expect(carPurchaseGstCents({ purchaseGstCents: 400000, purchaseDateISO: "2024-07-01" })).toBe(400000);
  });
  it("is 0 for a private sale (no GST on the invoice)", () => {
    expect(carPurchaseGstCents({ purchaseGstCents: 0, purchaseDateISO: "2024-07-01" })).toBe(0);
  });
  it("is 0 when the GST isn't recorded (no tax invoice, no credit)", () => {
    expect(carPurchaseGstCents({ purchaseGstCents: null, purchaseDateISO: "2024-07-01" })).toBe(0);
  });
  // ATO: max GST credit 2025-26 = 1/11 x $69,674 = $6,334; 2026-27 = 1/11 x $69,883 = $6,353.
  it("is capped at 1/11 of the car limit for the purchase FY", () => {
    expect(carPurchaseGstCents({ purchaseGstCents: 681818, purchaseDateISO: "2025-07-01" })).toBe(633400);
    expect(carPurchaseGstCents({ purchaseGstCents: 818182, purchaseDateISO: "2026-07-01" })).toBe(635300);
  });
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
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2023-07-01", fyLabel: "2023-24", purchaseGstClaimedCents: 0 }),
    ).toBe(1002740);
  });

  // Year 2 opening = 4000000 - 1002740 = 2997260; decline = 2997260 * 0.25 = 749315.
  it("rolls the written-down value forward to year 2", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2023-07-01", fyLabel: "2024-25", purchaseGstClaimedCents: 0 }),
    ).toBe(749315);
  });

  // Part-year purchase 2024-04-01 (FY 2023-24): daysHeld=91.
  // 4000000 * (91/365) * 0.25 = 249315.06.. -> 249315 (rounded).
  it("pro-rates the purchase-year decline by days held", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2024-04-01", fyLabel: "2023-24", purchaseGstClaimedCents: 0 }),
    ).toBe(249315);
  });

  // Cost above the 2024-25 car limit ($69,674) is capped to the limit as the base.
  // opening = 6967400; year 1 decline = 6967400 * 0.25 = 1741850.
  it("caps the cost base at the car cost limit of the purchase FY", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 9000000, purchaseDateISO: "2024-07-01", fyLabel: "2024-25", purchaseGstClaimedCents: 0 }),
    ).toBe(1741850);
  });

  it("returns 0 for an FY before the purchase FY", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2024-07-01", fyLabel: "2023-24", purchaseGstClaimedCents: 0 }),
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
      depreciationForFy({ purchaseCostCents: 4000000, purchaseDateISO: "2024-07-01", fyLabel: "2027-28", purchaseGstClaimedCents: 0 }),
    ).toBe(423031);
  });

  // GST-registered: cost base excludes the (capped) purchase GST credit, then the car limit applies.
  // $44,000 incl. GST: credit 400000 -> base 4000000 -> full-year decline 1000000.
  it("uses the GST-exclusive cost base when GST-registered", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4400000, purchaseDateISO: "2024-07-01", fyLabel: "2024-25", purchaseGstClaimedCents: 400000 }),
    ).toBe(1000000);
  });

  // ATO Guide to depreciating assets example: $75,000 car in 2025-26, credit capped at $6,334,
  // cost = 75,000 - 6,334 = $68,666 (< car limit). Decline = 6866600 * 0.25 = 1716650.
  it("reduces cost by the capped credit before applying the car limit (ATO example)", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 7500000, purchaseDateISO: "2025-07-01", fyLabel: "2025-26", purchaseGstClaimedCents: 633400 }),
    ).toBe(1716650);
  });

  // $100,000 car: 10000000 - 633400 = 9366600, capped to the 2025-26 limit 6967400 -> 1741850.
  it("still caps a GST-registered cost base at the car limit", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 10000000, purchaseDateISO: "2025-07-01", fyLabel: "2025-26", purchaseGstClaimedCents: 633400 }),
    ).toBe(1741850);
  });

  // ATO: cost is reduced only by the credit actually claimable. 80% business use:
  // credit 400000 x 0.8 = 320000 -> base 4080000 -> full-year decline 1020000.
  it("reduces cost by only the claimed (business-share) purchase credit", () => {
    expect(
      depreciationForFy({ purchaseCostCents: 4400000, purchaseDateISO: "2024-07-01", fyLabel: "2024-25", purchaseGstClaimedCents: 320000 }),
    ).toBe(1020000);
  });

  it("depreciates a car bought in the current FY (2026-27)", () => {
    // Non-registered, $80,000 > limit $69,883 -> 6988300 * 0.25 = 1747075.
    expect(
      depreciationForFy({ purchaseCostCents: 8000000, purchaseDateISO: "2026-07-01", fyLabel: "2026-27", purchaseGstClaimedCents: 0 }),
    ).toBe(1747075);
  });
});
