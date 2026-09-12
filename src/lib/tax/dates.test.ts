import { expect, test } from "vitest";
import { financialYear, basQuarter } from "@/lib/tax/dates";

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
