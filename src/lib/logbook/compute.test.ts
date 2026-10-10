import { expect, test } from "vitest";
import { tripKm, tripsToLegs, filterTripsByFy, fyBusinessPct, resolveBusinessUse, logbookPeriodBusinessPct } from "@/lib/logbook/compute";
import type { LogbookPeriodRow, TripRow } from "@/lib/logbook/types";

test("tripKm is odoEnd - odoStart", () => {
  expect(tripKm({ odoStart: 50000, odoEnd: 50040 })).toBe(40);
});

test("tripsToLegs maps to {km,isBusiness}", () => {
  expect(
    tripsToLegs([
      { odoStart: 0, odoEnd: 40, isBusiness: true },
      { odoStart: 40, odoEnd: 60, isBusiness: false },
    ]),
  ).toEqual([
    { km: 40, isBusiness: true },
    { km: 20, isBusiness: false },
  ]);
});

test("filterTripsByFy keeps only trips in the FY", () => {
  const trips = [
    { date: "2024-07-02" }, // FY 2024-25
    { date: "2024-06-30" }, // FY 2023-24
    { date: "2025-06-30" }, // FY 2024-25
  ];
  expect(filterTripsByFy(trips, "2024-25")).toEqual([
    { date: "2024-07-02" },
    { date: "2025-06-30" },
  ]);
});

test("fyBusinessPct = rounded business% over FY trips", () => {
  const trips = [
    { date: "2024-07-02", odoStart: 0, odoEnd: 40, isBusiness: true },
    { date: "2024-07-03", odoStart: 40, odoEnd: 60, isBusiness: false },
    { date: "2023-07-03", odoStart: 0, odoEnd: 999, isBusiness: false }, // other FY, excluded
  ];
  expect(fyBusinessPct(trips, "2024-25")).toBe(67); // 40/60
});

test("fyBusinessPct with no FY trips is 0 (no divide-by-zero)", () => {
  expect(fyBusinessPct([], "2024-25")).toBe(0);
});


const t = (over: Partial<TripRow>): TripRow => ({
  id: 1, vehicleId: 1, periodId: null, date: "2024-08-01",
  odoStart: 0, odoEnd: 100, purpose: null, isBusiness: true, ...over,
});
const period = (over: Partial<LogbookPeriodRow>): LogbookPeriodRow => ({
  id: 1, vehicleId: 1, startDate: "2024-08-01", endDate: "2024-10-31", ...over,
});
// Logbook period trips: 60 business / 40 private km => 60%.
const logbookTrips = [
  t({ id: 1, date: "2024-08-10", odoStart: 0, odoEnd: 60, isBusiness: true }),
  t({ id: 2, date: "2024-09-10", odoStart: 60, odoEnd: 100, isBusiness: false }),
];

test("resolveBusinessUse uses the valid logbook period's trips, not the FY's", () => {
  const laterTrip = t({ id: 3, date: "2025-03-01", odoStart: 100, odoEnd: 1100, isBusiness: false });
  const r = resolveBusinessUse({ trips: [...logbookTrips, laterTrip], periods: [period({})], fyLabel: "2024-25" });
  expect(r.ratio).toBeCloseTo(0.6, 10);
  expect(r.source).toEqual({ kind: "logbook", periodId: 1, startDate: "2024-08-01", endDate: "2024-10-31", firstFy: "2024-25", lastFy: "2028-29" });
  expect(r.notices).toEqual([]);
});

test("resolveBusinessUse carries a prior logbook into an FY with no trips", () => {
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({})], fyLabel: "2026-27" });
  expect(r.ratio).toBeCloseTo(0.6, 10);
  expect(r.source.kind).toBe("logbook");
});

test("resolveBusinessUse picks the most recent valid logbook", () => {
  const newer = period({ id: 2, startDate: "2025-08-01", endDate: "2025-10-31" });
  const newerTrips = [
    t({ id: 4, date: "2025-08-05", odoStart: 0, odoEnd: 90, isBusiness: true }),
    t({ id: 5, date: "2025-08-06", odoStart: 90, odoEnd: 100, isBusiness: false }),
  ];
  const r = resolveBusinessUse({ trips: [...logbookTrips, ...newerTrips], periods: [period({}), newer], fyLabel: "2026-27" });
  expect(r.ratio).toBeCloseTo(0.9, 10);
  expect(r.source).toMatchObject({ kind: "logbook", periodId: 2 });
});

test("resolveBusinessUse ignores a logbook outside its 5-year window and falls back with a notice", () => {
  const fyTrips = [t({ id: 9, date: "2029-08-01", odoStart: 0, odoEnd: 100, isBusiness: false })];
  const r = resolveBusinessUse({ trips: [...logbookTrips, ...fyTrips], periods: [period({})], fyLabel: "2029-30" });
  expect(r.ratio).toBe(0);
  expect(r.source).toEqual({ kind: "fy-trips" });
  expect(r.notices).toHaveLength(1);
  expect(r.notices[0]).toMatch(/No valid logbook/);
});

test("resolveBusinessUse ignores periods shorter than 12 weeks", () => {
  const short = period({ endDate: "2024-10-22" }); // 83 days
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [short], fyLabel: "2024-25" });
  expect(r.source.kind).toBe("fy-trips");
});

test("resolveBusinessUse ignores a logbook for another vehicle", () => {
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({ vehicleId: 2 })], fyLabel: "2024-25" });
  expect(r.source.kind).toBe("fy-trips");
});

test("resolveBusinessUse skips a logbook period with no trips, with a notice", () => {
  const empty = period({ id: 2, startDate: "2025-08-01", endDate: "2025-10-31" });
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({}), empty], fyLabel: "2025-26" });
  expect(r.source).toMatchObject({ kind: "logbook", periodId: 1 });
  expect(r.notices).toHaveLength(1);
  expect(r.notices[0]).toMatch(/2025-08-01.*no trips/);
});

test("resolveBusinessUse falls back to FY trips when there is no logbook", () => {
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [], fyLabel: "2024-25" });
  expect(r.ratio).toBeCloseTo(0.6, 10);
  expect(r.source).toEqual({ kind: "fy-trips" });
  expect(r.notices[0]).toMatch(/all trips recorded in FY 2024-25/);
});

test("logbookPeriodBusinessPct is the rounded % inside the period, or null with no trips", () => {
  expect(logbookPeriodBusinessPct(logbookTrips, period({}))).toBe(60);
  expect(logbookPeriodBusinessPct(logbookTrips, period({ startDate: "2025-08-01", endDate: "2025-10-31" }))).toBeNull();
});
