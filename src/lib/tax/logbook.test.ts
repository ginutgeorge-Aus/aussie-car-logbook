import { expect, test } from "vitest";
import {
  businessPct,
  businessPctRounded,
  businessPctBps,
  formatBusinessPct,
  LOGBOOK_MIN_DAYS,
  logbookPeriodDays,
  logbookValidity,
  logbookCoversFy,
  logbookFirstFy,
  logbookNominableFys,
} from "@/lib/tax/logbook";

const trips = [
  { km: 100, isBusiness: true },
  { km: 100, isBusiness: true },
  { km: 100, isBusiness: false },
];

test("business ratio is businessKm/totalKm", () => {
  expect(businessPct(trips)).toBeCloseTo(200 / 300, 10);
});
test("rounded percentage is % to 2 decimal places", () => {
  expect(businessPctRounded(trips)).toBe(66.67);
});
test("businessPctBps is the single rounding authority (basis points)", () => {
  expect(businessPctBps(2 / 3)).toBe(6667);
  expect(businessPctBps(1)).toBe(10000);
  expect(businessPctBps(0)).toBe(0);
  expect(formatBusinessPct(6667)).toBe("66.67");
  expect(formatBusinessPct(10000)).toBe("100.00");
});
test("no trips -> 0, no divide-by-zero", () => {
  expect(businessPct([])).toBe(0);
  expect(businessPctRounded([])).toBe(0);
});


test("logbook period length is inclusive days", () => {
  expect(logbookPeriodDays("2024-07-01", "2024-07-01")).toBe(1);
  expect(logbookPeriodDays("2024-07-01", "2024-09-22")).toBe(84);
  expect(LOGBOOK_MIN_DAYS).toBe(84); // 12 continuous weeks
});

const AUG_2024 = { startDate: "2024-08-01", endDate: "2024-10-31" };
// 12-week period crossing 30 June: June 2025 (FY 2024-25) to September 2025 (FY 2025-26).
const JUN_SEP_2025 = { startDate: "2025-06-10", endDate: "2025-09-10" };

test("a logbook is valid for its first FY and the following 4 FYs", () => {
  expect(logbookValidity(AUG_2024)).toEqual({ firstFy: "2024-25", lastFy: "2028-29" });
  // With no nomination, a period crossing 30 June belongs to the FY it starts in.
  expect(logbookValidity(JUN_SEP_2025)).toEqual({ firstFy: "2024-25", lastFy: "2028-29" });
});

test("a period crossing 30 June can be nominated for the FY it ends in", () => {
  expect(logbookValidity({ ...JUN_SEP_2025, nominatedFy: "2025-26" })).toEqual({ firstFy: "2025-26", lastFy: "2029-30" });
  expect(logbookValidity({ ...JUN_SEP_2025, nominatedFy: "2024-25" })).toEqual({ firstFy: "2024-25", lastFy: "2028-29" });
});

test("a nominated FY the period doesn't touch is ignored", () => {
  expect(logbookFirstFy({ ...AUG_2024, nominatedFy: "2025-26" })).toBe("2024-25");
  expect(logbookFirstFy({ ...JUN_SEP_2025, nominatedFy: "2026-27" })).toBe("2024-25");
});

test("logbookNominableFys lists both FYs only when the period crosses 30 June", () => {
  expect(logbookNominableFys(AUG_2024)).toEqual(["2024-25"]);
  expect(logbookNominableFys(JUN_SEP_2025)).toEqual(["2024-25", "2025-26"]);
});

test("logbookCoversFy checks the 5-year window", () => {
  expect(logbookCoversFy(AUG_2024, "2023-24")).toBe(false);
  expect(logbookCoversFy(AUG_2024, "2024-25")).toBe(true);
  expect(logbookCoversFy(AUG_2024, "2028-29")).toBe(true);
  expect(logbookCoversFy(AUG_2024, "2029-30")).toBe(false);
  const nominated = { ...JUN_SEP_2025, nominatedFy: "2025-26" };
  expect(logbookCoversFy(nominated, "2024-25")).toBe(false);
  expect(logbookCoversFy(nominated, "2029-30")).toBe(true);
});
