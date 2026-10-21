import { describe, it, expect } from "vitest";
import { buildFyReport } from "@/lib/reports/build";
import type { LogbookPeriodRow, TripRow, VehicleRow } from "@/lib/logbook/types";
import type { ExpenseRow } from "@/lib/data/expense";

const TODAY = "2099-01-01";

const trip = (over: Partial<TripRow>): TripRow => ({
  id: 1, vehicleId: 1, periodId: null, date: "2024-08-01",
  odoStart: 0, odoEnd: 100, purpose: null, isBusiness: true, ...over,
});
const expense = (over: Partial<ExpenseRow>): ExpenseRow => ({
  id: 1, vehicleId: 1, date: "2024-08-01", category: "fuel",
  amountInclCents: 11000, gstCents: 1000, vendor: null, receiptKey: null,
  notes: null, ocrRaw: null, ...over,
});

describe("buildFyReport", () => {
  it("buckets GST credit by quarter and totals the FY", () => {
    // 80% business (800 of 1000 km).
    const trips = [
      trip({ id: 1, odoStart: 0, odoEnd: 800, isBusiness: true }),
      trip({ id: 2, odoStart: 800, odoEnd: 1000, isBusiness: false }),
    ];
    const expenses = [
      expense({ id: 1, date: "2024-08-15", gstCents: 1000 }), // Q1
      expense({ id: 2, date: "2024-11-15", gstCents: 2000 }), // Q2
    ];
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

    expect(r.businessPct).toBe(0.8);
    expect(r.bas.quarters[0].gstCreditCents).toBe(800);  // 0.8 * 1000
    expect(r.bas.quarters[1].gstCreditCents).toBe(1600); // 0.8 * 2000
    expect(r.bas.quarters[2].gstCreditCents).toBe(0);
    expect(r.bas.totalGstCreditCents).toBe(2400); // sum of quarters
  });

  it("adds depreciation to running-costs deduction", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })]; // 100% business
    const expenses = [expense({ amountInclCents: 11000, gstCents: 1000, date: "2024-08-01" })];
    const vehicle: VehicleRow = {
      id: 1, make: "Toyota", model: "Corolla", rego: null,
      odoOpen: 0, odoClose: null, purchaseDate: "2024-07-01", purchaseCostCents: 4000000,
    };
    const r = buildFyReport({ trips, expenses, vehicle, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

    // running costs GST-excl at 100%: 11000 - 1000 = 10000.
    expect(r.annual.runningCostsDeductionCents).toBe(10000);
    // GST-registered: base = 4000000 - 363636 (1/11 GST) = 3636364; year 1 = 3636364 * 0.25 = 909091.
    expect(r.annual.depreciationDeductionCents).toBe(909091);
    expect(r.annual.totalDeductionCents).toBe(919091);
    expect(r.notices).toHaveLength(1); // only the "no valid logbook" fallback notice
    expect(r.notices[0]).toMatch(/No valid logbook/);
  });

  it("pushes a notice and zeroes depreciation when the car limit FY is missing", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const vehicle: VehicleRow = {
      id: 1, make: "Toyota", model: "Corolla", rego: null,
      odoOpen: 0, odoClose: null, purchaseDate: "2099-07-01", purchaseCostCents: 4000000,
    };
    const r = buildFyReport({ trips, expenses: [], vehicle, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2099-00", today: TODAY });
    expect(r.annual.depreciationDeductionCents).toBe(0);
    expect(r.notices.some((n) => /car limit/.test(n))).toBe(true);
  });

  it("omits depreciation with no vehicle and no depreciation notice", () => {
    const r = buildFyReport({ trips: [], expenses: [], vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
    expect(r.annual.depreciationDeductionCents).toBe(0);
    expect(r.notices.some((n) => /car limit/.test(n))).toBe(false);
  });

  it("excludes expenses outside the target FY from every figure", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })]; // 100% business, FY 2024-25
    const expenses = [
      expense({ id: 1, date: "2024-08-01", category: "fuel", amountInclCents: 11000, gstCents: 1000 }), // in FY 2024-25
      expense({ id: 2, date: "2024-05-01", category: "fuel", amountInclCents: 55000, gstCents: 5000 }), // FY 2023-24 — must be ignored
    ];
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

    expect(r.bas.totalGstCreditCents).toBe(1000); // only the in-FY $10 GST, not $50
    expect(r.annual.runningCostsDeductionCents).toBe(10000); // 11000 - 1000, out-of-FY excluded
    expect(r.annual.byCategory).toEqual([{ category: "fuel", totalInclCents: 11000 }]);
  });

  it("aggregates expense totals per category within the FY", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const expenses = [
      expense({ id: 1, date: "2024-08-01", category: "fuel", amountInclCents: 11000 }),
      expense({ id: 2, date: "2024-09-01", category: "fuel", amountInclCents: 22000 }),
      expense({ id: 3, date: "2024-10-01", category: "rego", amountInclCents: 33000 }),
    ];
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

    expect(r.annual.byCategory).toEqual([
      { category: "fuel", totalInclCents: 33000 }, // 11000 + 22000
      { category: "rego", totalInclCents: 33000 },
    ]);
  });

  it("uses a valid prior logbook for an FY with no trips", () => {
    // Logbook kept Aug-Oct 2024: 75 business / 25 private km.
    const trips = [
      trip({ id: 1, date: "2024-08-10", odoStart: 0, odoEnd: 75, isBusiness: true }),
      trip({ id: 2, date: "2024-09-10", odoStart: 75, odoEnd: 100, isBusiness: false }),
    ];
    const logbookPeriods: LogbookPeriodRow[] = [{ id: 7, vehicleId: 1, startDate: "2024-08-01", endDate: "2024-10-31" }];
    const expenses = [expense({ id: 1, date: "2026-08-15", amountInclCents: 11000, gstCents: 1000 })];
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods, fyLabel: "2026-27", today: TODAY });

    expect(r.businessPct).toBe(0.75);
    expect(r.businessUseSource).toEqual({
      kind: "logbook", periodId: 7, startDate: "2024-08-01", endDate: "2024-10-31", firstFy: "2024-25", lastFy: "2028-29",
    });
    expect(r.bas.totalGstCreditCents).toBe(750); // 0.75 * 1000
    expect(r.annual.runningCostsDeductionCents).toBe(7500); // 0.75 * (11000 - 1000)
    expect(r.notices).toEqual([]);
  });

  it("falls back to FY trips with a notice when no logbook is valid", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const r = buildFyReport({ trips, expenses: [], vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
    expect(r.businessPct).toBe(1);
    expect(r.businessUseSource).toEqual({ kind: "fy-trips" });
    expect(r.notices[0]).toMatch(/estimated from all trips recorded in FY 2024-25/);
  });

  describe("car purchase GST credit", () => {
    const vehicle: VehicleRow = {
      id: 1, make: "Toyota", model: "Corolla", rego: null,
      odoOpen: 0, odoClose: null, purchaseDate: "2025-11-20", purchaseCostCents: 7500000,
    };
    // 80% business in FY 2025-26.
    const trips = [
      trip({ id: 1, date: "2025-12-01", odoStart: 0, odoEnd: 800, isBusiness: true }),
      trip({ id: 2, date: "2025-12-02", odoStart: 800, odoEnd: 1000, isBusiness: false }),
    ];

    it("adds the capped, business-share purchase credit to the purchase quarter's BAS", () => {
      const r = buildFyReport({ trips, expenses: [], vehicle, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2025-26", today: TODAY });
      // capped credit 633400 (1/11 x $69,674) x 0.8 = 506720, in Q2 (Oct-Dec).
      expect(r.bas.quarters[1].gstCreditCents).toBe(506720);
      expect(r.bas.quarters[0].gstCreditCents).toBe(0);
      expect(r.bas.totalGstCreditCents).toBe(506720);
      expect(r.bas.purchaseGstCreditCents).toBe(506720);
    });

    it("claims no purchase credit when not GST-registered", () => {
      const r = buildFyReport({ trips, expenses: [], vehicle, settings: { gstRegistered: false }, logbookPeriods: [], fyLabel: "2025-26", today: TODAY });
      expect(r.bas.totalGstCreditCents).toBe(0);
      expect(r.bas.purchaseGstCreditCents).toBe(0);
    });

    it("claims the purchase credit only in the purchase FY", () => {
      const later = [trip({ id: 3, date: "2026-08-01", odoStart: 1000, odoEnd: 1100, isBusiness: true })];
      const r = buildFyReport({ trips: [...trips, ...later], expenses: [], vehicle, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2026-27", today: TODAY });
      expect(r.bas.purchaseGstCreditCents).toBe(0);
      expect(r.bas.totalGstCreditCents).toBe(0);
    });

    it("reduces the depreciation cost by only the claimed purchase credit", () => {
      const v: VehicleRow = { ...vehicle, purchaseCostCents: 4400000 };
      const r = buildFyReport({ trips, expenses: [], vehicle: v, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2025-26", today: TODAY });
      // credit 400000 x 0.8 = 320000 claimed; base 4400000 - 320000 = 4080000; 223 days held (20 Nov - 30 Jun).
      const decline = Math.round(4080000 * (223 / 365) * 0.25);
      expect(r.bas.purchaseGstCreditCents).toBe(320000);
      expect(r.annual.depreciationDeductionCents).toBe(Math.round(decline * 0.8));
    });

    it("keeps the purchase-FY claimed credit in later FYs' cost base", () => {
      const v: VehicleRow = { ...vehicle, purchaseCostCents: 4400000 };
      // 2026-27: 50% business, but the cost base still uses the 80% purchase-FY claim.
      const later = [
        trip({ id: 3, date: "2026-08-01", odoStart: 1000, odoEnd: 1100, isBusiness: true }),
        trip({ id: 4, date: "2026-08-02", odoStart: 1100, odoEnd: 1200, isBusiness: false }),
      ];
      const r = buildFyReport({ trips: [...trips, ...later], expenses: [], vehicle: v, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2026-27", today: TODAY });
      const first = Math.round(4080000 * (223 / 365) * 0.25);
      const decline = Math.round((4080000 - first) * 0.25);
      expect(r.annual.depreciationDeductionCents).toBe(Math.round(decline * 0.5));
    });

    it("shows no depreciation or car-limit notice for an FY before the purchase", () => {
      const future: VehicleRow = { ...vehicle, purchaseDate: "2027-08-01" };
      const r = buildFyReport({ trips, expenses: [], vehicle: future, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2025-26", today: TODAY });
      expect(r.annual.depreciationDeductionCents).toBe(0);
      expect(r.notices.some((n) => /car limit/.test(n))).toBe(false);
    });

    it("warns and omits depreciation and purchase credit for an FY with no published car limit", () => {
      const future: VehicleRow = { ...vehicle, purchaseDate: "2027-08-01" };
      const futureTrips = [trip({ id: 4, date: "2027-08-02", odoStart: 0, odoEnd: 100, isBusiness: true })];
      const r = buildFyReport({ trips: futureTrips, expenses: [], vehicle: future, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2027-28", today: TODAY });
      expect(r.annual.depreciationDeductionCents).toBe(0);
      expect(r.bas.purchaseGstCreditCents).toBe(0);
      expect(r.notices.some((n) => /car limit for FY 2027-28/.test(n))).toBe(true);
    });
  });
});
