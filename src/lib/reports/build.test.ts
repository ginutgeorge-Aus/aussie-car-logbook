import { describe, it, expect } from "vitest";
import { buildFyReport } from "@/lib/reports/build";
import type { TripRow, VehicleRow } from "@/lib/logbook/types";
import type { ExpenseRow } from "@/lib/data/expense";

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
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, fyLabel: "2024-25" });

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
    const r = buildFyReport({ trips, expenses, vehicle, settings: { gstRegistered: true }, fyLabel: "2024-25" });

    // running costs GST-excl at 100%: 11000 - 1000 = 10000.
    expect(r.annual.runningCostsDeductionCents).toBe(10000);
    // depreciation year 1 full = 4000000 * 0.25 = 1000000, at 100% business.
    expect(r.annual.depreciationDeductionCents).toBe(1000000);
    expect(r.annual.totalDeductionCents).toBe(1010000);
    expect(r.notices).toEqual([]);
  });

  it("pushes a notice and zeroes depreciation when the car limit FY is missing", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const vehicle: VehicleRow = {
      id: 1, make: "Toyota", model: "Corolla", rego: null,
      odoOpen: 0, odoClose: null, purchaseDate: "2099-07-01", purchaseCostCents: 4000000,
    };
    const r = buildFyReport({ trips, expenses: [], vehicle, settings: { gstRegistered: true }, fyLabel: "2099-00" });
    expect(r.annual.depreciationDeductionCents).toBe(0);
    expect(r.notices.length).toBe(1);
  });

  it("omits depreciation with no vehicle and no notice", () => {
    const r = buildFyReport({ trips: [], expenses: [], vehicle: null, settings: { gstRegistered: true }, fyLabel: "2024-25" });
    expect(r.annual.depreciationDeductionCents).toBe(0);
    expect(r.notices).toEqual([]);
  });

  it("excludes expenses outside the target FY from every figure", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })]; // 100% business, FY 2024-25
    const expenses = [
      expense({ id: 1, date: "2024-08-01", category: "fuel", amountInclCents: 11000, gstCents: 1000 }), // in FY 2024-25
      expense({ id: 2, date: "2024-05-01", category: "fuel", amountInclCents: 55000, gstCents: 5000 }), // FY 2023-24 — must be ignored
    ];
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, fyLabel: "2024-25" });

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
    const r = buildFyReport({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, fyLabel: "2024-25" });

    expect(r.annual.byCategory).toEqual([
      { category: "fuel", totalInclCents: 33000 }, // 11000 + 22000
      { category: "rego", totalInclCents: 33000 },
    ]);
  });
});
