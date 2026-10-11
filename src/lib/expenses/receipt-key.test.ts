import { describe, expect, it } from "vitest";
import { receiptName } from "./receipt-key";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("receiptName", () => {
  it("builds date_category_amount_uuid.ext", () => {
    expect(receiptName({ date: "2026-07-01", category: "fuel", amountInclCents: 8550 }, "jpg", UUID)).toBe(
      `2026-07-01_fuel_85-50_${UUID}.jpg`,
    );
  });

  it("keeps the full UUID so same-metadata receipts never collide", () => {
    expect(receiptName(undefined, "jpg", UUID)).toBe(`${UUID}.jpg`);
  });

  it.each(["2026/07/01", "../x", "2026-07-01?a#b", "abc"])("drops a non-ISO date %j from the key", (date) => {
    expect(receiptName({ date }, "jpg", UUID)).toBe(`${UUID}.jpg`);
  });

  it("slugs the category to filename-safe chars", () => {
    expect(receiptName({ category: "Tyres & Parts/../" }, "png", UUID)).toBe(`tyres-parts_${UUID}.png`);
  });
});
