import { expect, test } from "vitest";
import {
  businessPct,
  businessPctRounded,
  LOGBOOK_MIN_DAYS,
  logbookPeriodDays,
  logbookValidity,
  logbookCoversFy,
} from "@/lib/tax/logbook";

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


test("logbook period length is inclusive days", () => {
  expect(logbookPeriodDays("2024-07-01", "2024-07-01")).toBe(1);
  expect(logbookPeriodDays("2024-07-01", "2024-09-22")).toBe(84);
  expect(LOGBOOK_MIN_DAYS).toBe(84); // 12 continuous weeks
});

test("a logbook is valid for its first FY and the following 4 FYs", () => {
  expect(logbookValidity("2024-08-01")).toEqual({ firstFy: "2024-25", lastFy: "2028-29" });
  // A period that starts in June belongs to the FY it starts in.
  expect(logbookValidity("2025-06-10")).toEqual({ firstFy: "2024-25", lastFy: "2028-29" });
});

test("logbookCoversFy checks the 5-year window", () => {
  expect(logbookCoversFy("2024-08-01", "2023-24")).toBe(false);
  expect(logbookCoversFy("2024-08-01", "2024-25")).toBe(true);
  expect(logbookCoversFy("2024-08-01", "2028-29")).toBe(true);
  expect(logbookCoversFy("2024-08-01", "2029-30")).toBe(false);
});
