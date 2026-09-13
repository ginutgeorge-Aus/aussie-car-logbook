import { expect, test, describe, it } from "vitest";
import { financialYear, basQuarter, fyQuarters, daysHeldInFy } from "@/lib/tax/dates";

test("July date is start of new FY", () => {
  expect(financialYear("2024-07-01")).toEqual({ startISO: "2024-07-01", endISO: "2025-06-30", label: "2024-25" });
});
test("June date is end of FY started prior year", () => {
  expect(financialYear("2025-06-30")).toEqual({ startISO: "2024-07-01", endISO: "2025-06-30", label: "2024-25" });
});
test("BAS quarters map correctly", () => {
  expect(basQuarter("2024-08-15").quarter).toBe(1); // Jul-Sep
  expect(basQuarter("2024-11-01").quarter).toBe(2); // Oct-Dec
  expect(basQuarter("2025-02-10").quarter).toBe(3); // Jan-Mar
  expect(basQuarter("2025-05-20").quarter).toBe(4); // Apr-Jun
  expect(basQuarter("2024-11-01").label).toBe("Q2 2024-25");
});

describe("fyQuarters", () => {
  it("returns the four BAS quarter ranges for an FY label", () => {
    const q = fyQuarters("2024-25");
    expect(q).toEqual([
      { quarter: 1, label: "Q1 2024-25", startISO: "2024-07-01", endISO: "2024-09-30" },
      { quarter: 2, label: "Q2 2024-25", startISO: "2024-10-01", endISO: "2024-12-31" },
      { quarter: 3, label: "Q3 2024-25", startISO: "2025-01-01", endISO: "2025-03-31" },
      { quarter: 4, label: "Q4 2024-25", startISO: "2025-04-01", endISO: "2025-06-30" },
    ]);
  });
});

describe("daysHeldInFy", () => {
  it("counts purchase date to 30 Jun inclusive for a mid-FY purchase", () => {
    // 2024-04-01 .. 2024-06-30 inclusive = 91 days (FY 2023-24)
    expect(daysHeldInFy("2024-04-01", "2023-24")).toBe(91);
  });
  it("counts a full FY inclusive when the date precedes the FY start", () => {
    // clamps to 2024-07-01 .. 2025-06-30 inclusive = 365 days
    expect(daysHeldInFy("2020-01-01", "2024-25")).toBe(365);
  });
  it("returns 0 when the date is after the FY end", () => {
    expect(daysHeldInFy("2026-01-01", "2024-25")).toBe(0);
  });
});
