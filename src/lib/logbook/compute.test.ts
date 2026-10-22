import { expect, test } from "vitest";
import { logbookPeriodUse, tripKm, tripsToLegs, filterTripsByFy, resolveBusinessUse, logbookPeriodBusinessPctBps, logbookFyLabels, currentOdometer, fyKmTotals } from "@/lib/logbook/compute";
import type { LogbookPeriodRow, TripRow } from "@/lib/logbook/types";

const TODAY = "2099-01-01";

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

const t = (over: Partial<TripRow>): TripRow => ({
  id: 1, vehicleId: 1, periodId: null, date: "2024-08-01",
  odoStart: 0, odoEnd: 100, purpose: null, isBusiness: true, ...over,
});
const period = (over: Partial<LogbookPeriodRow>): LogbookPeriodRow => ({
  id: 1, vehicleId: 1, startDate: "2024-08-01", endDate: "2024-10-31", odoStart: 0, odoEnd: 100, ...over,
});
// Logbook period trips: 60 business / 40 private km => 60%.
const logbookTrips = [
  t({ id: 1, date: "2024-08-10", odoStart: 0, odoEnd: 60, isBusiness: true }),
  t({ id: 2, date: "2024-09-10", odoStart: 60, odoEnd: 100, isBusiness: false }),
];

test("resolveBusinessUse uses the valid logbook period's trips, not the FY's", () => {
  const laterTrip = t({ id: 3, date: "2025-03-01", odoStart: 100, odoEnd: 1100, isBusiness: false });
  const r = resolveBusinessUse({ trips: [...logbookTrips, laterTrip], periods: [period({})], fyLabel: "2024-25", today: TODAY });
  expect(r.ratio).toBeCloseTo(0.6, 10);
  expect(r.source).toEqual({ kind: "logbook", periodId: 1, startDate: "2024-08-01", endDate: "2024-10-31", firstFy: "2024-25", lastFy: "2028-29" });
  expect(r.notices).toEqual([]);
});

test("resolveBusinessUse uses a period crossing 30 June for its nominated FY window (#45)", () => {
  const cross = period({ startDate: "2025-06-10", endDate: "2025-09-10", nominatedFy: "2025-26" });
  const trips = [t({ id: 6, date: "2025-07-01", odoStart: 0, odoEnd: 100, isBusiness: true })];
  const r = resolveBusinessUse({ trips, periods: [cross], fyLabel: "2029-30", today: TODAY });
  expect(r.source).toMatchObject({ kind: "logbook", firstFy: "2025-26", lastFy: "2029-30" });
  expect(resolveBusinessUse({ trips, periods: [cross], fyLabel: "2024-25", today: TODAY }).source.kind).toBe("fy-trips");
});

test("resolveBusinessUse carries a prior logbook into an FY with no trips", () => {
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({})], fyLabel: "2026-27", today: TODAY });
  expect(r.ratio).toBeCloseTo(0.6, 10);
  expect(r.source.kind).toBe("logbook");
});

test("resolveBusinessUse picks the most recent valid logbook", () => {
  const newer = period({ id: 2, startDate: "2025-08-01", endDate: "2025-10-31" });
  const newerTrips = [
    t({ id: 4, date: "2025-08-05", odoStart: 0, odoEnd: 90, isBusiness: true }),
    t({ id: 5, date: "2025-08-06", odoStart: 90, odoEnd: 100, isBusiness: false }),
  ];
  const r = resolveBusinessUse({ trips: [...logbookTrips, ...newerTrips], periods: [period({}), newer], fyLabel: "2026-27", today: TODAY });
  expect(r.ratio).toBeCloseTo(0.9, 10);
  expect(r.source).toMatchObject({ kind: "logbook", periodId: 2 });
});

test("resolveBusinessUse ignores a logbook outside its 5-year window and falls back with a notice", () => {
  const fyTrips = [t({ id: 9, date: "2029-08-01", odoStart: 0, odoEnd: 100, isBusiness: false })];
  const r = resolveBusinessUse({ trips: [...logbookTrips, ...fyTrips], periods: [period({})], fyLabel: "2029-30", today: TODAY });
  expect(r.ratio).toBe(0);
  expect(r.source).toEqual({ kind: "fy-trips" });
  expect(r.notices).toHaveLength(1);
  expect(r.notices[0]).toMatch(/No valid logbook/);
});

test("resolveBusinessUse ignores periods shorter than 12 weeks", () => {
  const short = period({ endDate: "2024-10-22" }); // 83 days
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [short], fyLabel: "2024-25", today: TODAY });
  expect(r.source.kind).toBe("fy-trips");
});

test("resolveBusinessUse ignores a logbook for another vehicle", () => {
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({ vehicleId: 2 })], fyLabel: "2024-25", today: TODAY });
  expect(r.source.kind).toBe("fy-trips");
});

test("resolveBusinessUse skips a logbook period with no trips, with a notice", () => {
  const empty = period({ id: 2, startDate: "2025-08-01", endDate: "2025-10-31" });
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({}), empty], fyLabel: "2025-26", today: TODAY });
  expect(r.source).toMatchObject({ kind: "logbook", periodId: 1 });
  expect(r.notices).toHaveLength(1);
  expect(r.notices[0]).toMatch(/2025-08-01.*no trips/);
});

test("resolveBusinessUse falls back to FY trips when there is no logbook", () => {
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [], fyLabel: "2024-25", today: TODAY });
  expect(r.ratio).toBeCloseTo(0.6, 10);
  expect(r.source).toEqual({ kind: "fy-trips" });
  expect(r.notices[0]).toMatch(/all trips recorded in FY 2024-25/);
});

test("logbookPeriodBusinessPctBps is the basis points inside the period, or null with no trips", () => {
  expect(logbookPeriodBusinessPctBps(logbookTrips, period({}))).toBe(6000);
  expect(logbookPeriodBusinessPctBps(logbookTrips, period({ startDate: "2025-08-01", endDate: "2025-10-31" }))).toBeNull();
});

test("resolveBusinessUse ignores a logbook period that hasn't ended yet, with a notice", () => {
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({})], fyLabel: "2024-25", today: "2024-09-30" });
  expect(r.source).toEqual({ kind: "fy-trips" });
  expect(r.notices[0]).toMatch(/2024-08-01 to 2024-10-31 hasn't finished/);
});

test("resolveBusinessUse accepts a logbook period on its last day", () => {
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({})], fyLabel: "2024-25", today: "2024-10-31" });
  expect(r.source).toMatchObject({ kind: "logbook", periodId: 1 });
});

test("logbookFyLabels lists each period's valid FYs up to the current FY", () => {
  const short = period({ id: 2, startDate: "2023-08-01", endDate: "2023-08-10" });
  expect(logbookFyLabels([period({}), short], "2026-27")).toEqual(["2026-27", "2025-26", "2024-25"]);
});

test("currentOdometer is the highest trip odoEnd, else the opening odometer", () => {
  expect(currentOdometer([{ odoEnd: 84300 }, { odoEnd: 84312 }], 80000)).toBe(84312);
  expect(currentOdometer([], 80000)).toBe(80000);
  expect(currentOdometer([], null)).toBeNull();
  expect(currentOdometer([{ odoEnd: 100 }], 500)).toBe(500);
});

test("fyKmTotals sums business and total km within the FY", () => {
  const trips = [
    { date: "2024-07-02", odoStart: 0, odoEnd: 40, isBusiness: true },
    { date: "2024-08-02", odoStart: 40, odoEnd: 60, isBusiness: false },
    { date: "2024-06-30", odoStart: 0, odoEnd: 999, isBusiness: true }, // FY 2023-24
  ];
  expect(fyKmTotals(trips, "2024-25")).toEqual({ businessKm: 40, totalKm: 60 });
});

test("total km is the odometer span, not the sum of logged trips (#49)", () => {
  // 60 business km logged, but the odometer moved 200 km: unlogged private trips count.
  const p = period({ odoStart: 0, odoEnd: 200 });
  expect(logbookPeriodUse(logbookTrips, p)).toEqual({ ok: true, businessKm: 60, totalKm: 200 });
  expect(logbookPeriodBusinessPctBps(logbookTrips, p)).toBe(3000);
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [p], fyLabel: "2024-25", today: TODAY });
  expect(r.ratio).toBeCloseTo(0.3, 10);
});

test("a period with odometers but only private trips legitimately gives 0%", () => {
  const priv = [t({ id: 1, date: "2024-08-10", odoStart: 0, odoEnd: 50, isBusiness: false })];
  expect(logbookPeriodBusinessPctBps(priv, period({}))).toBe(0);
});

test("a period without odometer readings is skipped with a notice", () => {
  for (const missing of [{ odoStart: null }, { odoEnd: null }, { odoStart: undefined, odoEnd: undefined }]) {
    const p = period(missing);
    expect(logbookPeriodBusinessPctBps(logbookTrips, p)).toBeNull();
    const r = resolveBusinessUse({ trips: logbookTrips, periods: [p], fyLabel: "2024-25", today: TODAY });
    expect(r.source.kind).toBe("fy-trips");
    expect(r.notices[0]).toMatch(/2024-08-01 to 2024-10-31.*odometer readings are missing.*Trips page/);
  }
});

test("a period whose end odometer is not above the start is skipped", () => {
  for (const p of [period({ odoStart: 100, odoEnd: 100 }), period({ odoStart: 100, odoEnd: 50 })]) {
    expect(logbookPeriodBusinessPctBps(logbookTrips, p)).toBeNull();
    const r = resolveBusinessUse({ trips: logbookTrips, periods: [p], fyLabel: "2024-25", today: TODAY });
    expect(r.source.kind).toBe("fy-trips");
    expect(r.notices[0]).toMatch(/end odometer must be higher/);
  }
});

test("a period is skipped when a trip falls outside its odometer readings", () => {
  for (const p of [period({ odoStart: 10 }), period({ odoEnd: 90 })]) {
    expect(logbookPeriodBusinessPctBps(logbookTrips, p)).toBeNull();
    const r = resolveBusinessUse({ trips: logbookTrips, periods: [p], fyLabel: "2024-25", today: TODAY });
    expect(r.source.kind).toBe("fy-trips");
    expect(r.notices[0]).toMatch(/outside the period's odometer readings/);
  }
});

test("a period is skipped when business km exceed total km (overlapping trips)", () => {
  const overlap = [
    t({ id: 1, date: "2024-08-10", odoStart: 0, odoEnd: 80, isBusiness: true }),
    t({ id: 2, date: "2024-08-11", odoStart: 0, odoEnd: 80, isBusiness: true }),
  ];
  expect(logbookPeriodBusinessPctBps(overlap, period({}))).toBeNull();
  const r = resolveBusinessUse({ trips: overlap, periods: [period({})], fyLabel: "2024-25", today: TODAY });
  expect(r.notices[0]).toMatch(/business km exceed/);
});

test("an unusable newest period falls back to the previous valid one", () => {
  const bad = period({ id: 2, startDate: "2025-08-01", endDate: "2025-10-31", odoStart: null, odoEnd: null });
  const r = resolveBusinessUse({ trips: logbookTrips, periods: [period({}), bad], fyLabel: "2025-26", today: TODAY });
  expect(r.source).toMatchObject({ kind: "logbook", periodId: 1 });
  expect(r.notices[0]).toMatch(/2025-08-01 to 2025-10-31/);
});
