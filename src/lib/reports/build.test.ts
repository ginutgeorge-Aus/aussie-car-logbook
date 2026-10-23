// Each rule tested here maps to its ATO source in docs/ato-rules.md.
import { describe, it, expect } from "vitest";
import { buildFyReport } from "@/lib/reports/build";
import type { LogbookPeriodRow, TripRow, VehicleFyOdometerRow, VehicleRow } from "@/lib/logbook/types";
import type { ExpenseRow } from "@/lib/data/expense";

const TODAY = "2099-01-01";

const trip = (over: Partial<TripRow>): TripRow => ({
  id: 1, vehicleId: 1, periodId: null, date: "2024-08-01", endDate: null,
  odoStart: 0, odoEnd: 100, purpose: "Client visit", isBusiness: true, ...over,
});
const expense = (over: Partial<ExpenseRow>): ExpenseRow => ({
  id: 1, vehicleId: 1, date: "2024-08-01", category: "fuel",
  amountInclCents: 11000, gstCents: 1000, vendor: null, abn: null, taxInvoice: true, receiptKey: null,
  notes: null, ocrRaw: null, ...over,
});

/** A 12-week-plus logbook covering the default 2024-08-01 trip date. */
const LOGBOOK_2024: LogbookPeriodRow = { id: 9, vehicleId: 1, startDate: "2024-07-01", endDate: "2024-10-31", odoStart: 0, odoEnd: 100 };

type ReportInput = Parameters<typeof buildFyReport>[0];

/** `buildFyReport` with complete odometer readings for the FY unless `fyOdometers` is given, so only odometer tests see those notices. */
const report = (input: Omit<ReportInput, "fyOdometers"> & { fyOdometers?: VehicleFyOdometerRow[] }) =>
  buildFyReport({
    fyOdometers: [{ id: 1, vehicleId: 1, fyLabel: input.fyLabel, odoOpen: 0, odoClose: 100 }],
    ...input,
  });

describe("buildFyReport", () => {
  it("flags missing start/end odometer readings for a logbook year without changing the figures (#51)", () => {
    const base = { trips: [trip({})], expenses: [expense({})], vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [LOGBOOK_2024], fyLabel: "2024-25" };
    const row = (odoOpen: number | null, odoClose: number | null): VehicleFyOdometerRow[] => [{ id: 1, vehicleId: 1, fyLabel: "2024-25", odoOpen, odoClose }];
    const odoNotices = (r: ReturnType<typeof report>) => r.notices.filter((n) => /Odometer reading/.test(n));
    const ok = report({ ...base, today: TODAY, fyOdometers: row(0, 100) });
    expect(odoNotices(ok)).toEqual([]);
    expect(odoNotices(report({ ...base, today: TODAY, fyOdometers: row(null, 100) }))).toEqual([
      "Odometer reading at the start of FY 2024-25 (1 July) is missing — the ATO needs start and end readings for each year you use a logbook. Add it on the Vehicle page.",
    ]);
    const none = report({ ...base, today: TODAY, fyOdometers: [] });
    expect(odoNotices(none)).toHaveLength(2);
    expect(odoNotices(none)[1]).toMatch(/end of FY 2024-25 \(30 June\)/);
    expect(none.bas).toEqual(ok.bas);
    expect(none.annual).toEqual(ok.annual);
    // The year hasn't ended yet: the 30 June reading can't exist.
    expect(odoNotices(report({ ...base, today: "2025-03-01", fyOdometers: row(0, null) }))).toEqual([]);
    // No valid logbook for the year: the deduction isn't claimed, so no odometer notice.
    expect(odoNotices(report({ ...base, logbookPeriods: [], today: TODAY, fyOdometers: [] }))).toEqual([]);
  });

  it("flags business trips with no reason without changing the figures (#50)", () => {
    const base = { expenses: [expense({})], vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [LOGBOOK_2024], fyLabel: "2024-25", today: TODAY };
    // Private trips and other-FY trips never count, so they have no reason in both runs.
    const others = [trip({ id: 3, purpose: null, isBusiness: false }), trip({ id: 4, purpose: null, date: "2023-08-01" })];
    const ok = report({ ...base, trips: [trip({}), trip({ id: 2 }), ...others] });
    const missing = report({ ...base, trips: [trip({ purpose: null }), trip({ id: 2, purpose: "  " }), ...others] });
    expect(ok.notices.some((n) => /no reason recorded/.test(n))).toBe(false);
    expect(missing.notices.filter((n) => /no reason recorded/.test(n))).toEqual([
      "2 business trips in FY 2024-25 have no reason recorded — the ATO needs the reason for every business journey. Add it on the Trips page.",
    ]);
    expect(missing.bas).toEqual(ok.bas);
  });

  it("holds back GST on expenses over $82.50 without a tax invoice", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })]; // 100% business
    const expenses = [
      expense({ id: 1, date: "2024-08-01", amountInclCents: 11000, gstCents: 1000, taxInvoice: false, vendor: "BP" }),
      expense({ id: 2, date: "2024-08-02", amountInclCents: 8250, gstCents: 750, taxInvoice: false }),
      expense({ id: 3, date: "2024-08-03", amountInclCents: 22000, gstCents: 2000, taxInvoice: true }),
    ];
    const r = report({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
    const q1 = r.bas.quarters[0];

    expect(q1.gstCreditCents).toBe(2750); // 750 (<= $82.50) + 2000 (invoice held)
    expect(q1.heldBackGstCents).toBe(1000);
    expect(q1.needsTaxInvoice).toEqual([{ id: 1, date: "2024-08-01", vendor: "BP", amountInclCents: 11000 }]);
    expect(r.bas.totalHeldBackGstCents).toBe(1000);
  });

  it("still deducts held-back expenses GST-exclusive (credit entitlement, not claim, is the test)", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })]; // 100% business
    const expenses = [expense({ amountInclCents: 11000, gstCents: 1000, taxInvoice: false, date: "2024-08-01" })];
    const r = report({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [LOGBOOK_2024], fyLabel: "2024-25", today: TODAY });

    expect(r.bas.quarters[0].heldBackGstCents).toBe(1000);
    expect(r.annual.runningCostsDeductionCents).toBe(10000); // 11000 - 1000, not 11000
  });

  it("lists no expenses to chase when business use is 0%", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: false })];
    const expenses = [expense({ amountInclCents: 11000, gstCents: 1000, taxInvoice: false })];
    const r = report({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

    expect(r.bas.quarters[0].heldBackGstCents).toBe(0);
    expect(r.bas.quarters[0].needsTaxInvoice).toEqual([]);
  });

  it("holds nothing back when not GST-registered", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const expenses = [expense({ amountInclCents: 11000, gstCents: 1000, taxInvoice: false })];
    const r = report({ trips, expenses, vehicle: null, settings: { gstRegistered: false }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

    expect(r.bas.quarters[0].heldBackGstCents).toBe(0);
    expect(r.bas.quarters[0].needsTaxInvoice).toEqual([]);
    expect(r.bas.totalHeldBackGstCents).toBe(0);
  });

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
    const r = report({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

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
      odoOpen: 0, odoClose: null, purchaseDate: "2024-07-01", purchaseCostCents: 4000000, purchaseGstCents: 363636, effectiveLifeYears: null,
    };
    const r = report({ trips, expenses, vehicle, settings: { gstRegistered: true }, logbookPeriods: [LOGBOOK_2024], fyLabel: "2024-25", today: TODAY });

    // running costs GST-excl at 100%: 11000 - 1000 = 10000.
    expect(r.annual.runningCostsDeductionCents).toBe(10000);
    // GST-registered: base = 4000000 - 363636 (1/11 GST) = 3636364; year 1 = 3636364 * 0.25 = 909091.
    expect(r.annual.depreciationDeductionCents).toBe(909091);
    expect(r.annual.totalDeductionCents).toBe(919091);
    expect(r.notices).toEqual([]);
  });

  it("pushes a notice and zeroes depreciation when the car limit FY is missing", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const vehicle: VehicleRow = {
      id: 1, make: "Toyota", model: "Corolla", rego: null,
      odoOpen: 0, odoClose: null, purchaseDate: "2099-07-01", purchaseCostCents: 4000000, purchaseGstCents: null, effectiveLifeYears: null,
    };
    const r = report({ trips, expenses: [], vehicle, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2099-00", today: TODAY });
    expect(r.annual.depreciationDeductionCents).toBe(0);
    expect(r.notices.some((n) => /car limit/.test(n))).toBe(true);
  });

  it("omits depreciation with no vehicle and no depreciation notice", () => {
    const r = report({ trips: [], expenses: [], vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
    expect(r.annual.depreciationDeductionCents).toBe(0);
    expect(r.notices.some((n) => /car limit/.test(n))).toBe(false);
  });

  it("excludes expenses outside the target FY from every figure", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })]; // 100% business, FY 2024-25
    const expenses = [
      expense({ id: 1, date: "2024-08-01", category: "fuel", amountInclCents: 11000, gstCents: 1000 }), // in FY 2024-25
      expense({ id: 2, date: "2024-05-01", category: "fuel", amountInclCents: 55000, gstCents: 5000 }), // FY 2023-24 — must be ignored
    ];
    const r = report({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [LOGBOOK_2024], fyLabel: "2024-25", today: TODAY });

    expect(r.bas.totalGstCreditCents).toBe(1000); // only the in-FY $10 GST, not $50
    expect(r.annual.runningCostsDeductionCents).toBe(10000); // 11000 - 1000, out-of-FY excluded
    expect(r.annual.byCategory).toEqual([{ category: "fuel", totalCents: 10000 }]); // ex-GST
  });

  it("aggregates expense totals per category within the FY", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const expenses = [
      expense({ id: 1, date: "2024-08-01", category: "fuel", amountInclCents: 11000 }),
      expense({ id: 2, date: "2024-09-01", category: "fuel", amountInclCents: 22000 }),
      expense({ id: 3, date: "2024-10-01", category: "rego", amountInclCents: 33000 }),
    ];
    const r = report({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });

    expect(r.annual.byCategory).toEqual([
      { category: "fuel", totalCents: 31000 }, // ex-GST: (11000 - 1000) + (22000 - 1000)
      { category: "rego", totalCents: 32000 }, // 33000 - 1000
    ]);
  });

  it("uses a valid prior logbook for an FY with no trips", () => {
    // Logbook kept Aug-Oct 2024: 75 business / 25 private km.
    const trips = [
      trip({ id: 1, date: "2024-08-10", odoStart: 0, odoEnd: 75, isBusiness: true }),
      trip({ id: 2, date: "2024-09-10", odoStart: 75, odoEnd: 100, isBusiness: false }),
    ];
    const logbookPeriods: LogbookPeriodRow[] = [{ id: 7, vehicleId: 1, startDate: "2024-08-01", endDate: "2024-10-31", odoStart: 0, odoEnd: 100 }];
    const expenses = [expense({ id: 1, date: "2026-08-15", amountInclCents: 11000, gstCents: 1000 })];
    const r = report({ trips, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods, fyLabel: "2026-27", today: TODAY });

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
    const r = report({ trips, expenses: [], vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
    expect(r.businessPct).toBe(1);
    expect(r.businessUseSource).toEqual({ kind: "fy-trips" });
    expect(r.notices[0]).toMatch(/estimated from all trips recorded in FY 2024-25/);
  });

  it("claims no car deduction without a valid logbook, but keeps the BAS credit (#52)", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const expenses = [expense({ amountInclCents: 11000, gstCents: 1000 })];
    const vehicle: VehicleRow = {
      id: 1, make: "Toyota", model: "Corolla", rego: null,
      odoOpen: 0, odoClose: null, purchaseDate: "2024-07-01", purchaseCostCents: 4000000, purchaseGstCents: 363636, effectiveLifeYears: null,
    };
    const r = report({ trips, expenses, vehicle, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
    expect(r.annual.claimable).toBe(false);
    expect(r.annual.runningCostsDeductionCents).toBe(0);
    expect(r.annual.depreciationDeductionCents).toBe(0);
    expect(r.annual.totalDeductionCents).toBe(0);
    expect(r.bas.totalGstCreditCents).toBeGreaterThan(1000); // running-cost GST + purchase credit, from FY trips
    expect(r.notices.some((n) => /car deduction can't be claimed/i.test(n))).toBe(true);
  });

  it("marks the deduction claimable with a valid logbook", () => {
    const trips = [trip({ odoStart: 0, odoEnd: 100, isBusiness: true })];
    const r = report({ trips, expenses: [], vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [LOGBOOK_2024], fyLabel: "2024-25", today: TODAY });
    expect(r.annual.claimable).toBe(true);
  });

  describe("car purchase GST credit", () => {
    const vehicle: VehicleRow = {
      id: 1, make: "Toyota", model: "Corolla", rego: null,
      odoOpen: 0, odoClose: null, purchaseDate: "2025-11-20", purchaseCostCents: 7500000, purchaseGstCents: 681818, effectiveLifeYears: null,
    };
    // 80% business in FY 2025-26.
    const trips = [
      trip({ id: 1, date: "2025-12-01", odoStart: 0, odoEnd: 800, isBusiness: true }),
      trip({ id: 2, date: "2025-12-02", odoStart: 800, odoEnd: 1000, isBusiness: false }),
    ];

    it("adds the capped, business-share purchase credit to the purchase quarter's BAS", () => {
      const r = report({ trips, expenses: [], vehicle, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2025-26", today: TODAY });
      // capped credit 633400 (1/11 x $69,674) x 0.8 = 506720, in Q2 (Oct-Dec).
      expect(r.bas.quarters[1].gstCreditCents).toBe(506720);
      expect(r.bas.quarters[0].gstCreditCents).toBe(0);
      expect(r.bas.totalGstCreditCents).toBe(506720);
      expect(r.bas.purchaseGstCreditCents).toBe(506720);
    });

    it("claims no purchase credit when not GST-registered", () => {
      const r = report({ trips, expenses: [], vehicle, settings: { gstRegistered: false }, logbookPeriods: [], fyLabel: "2025-26", today: TODAY });
      expect(r.bas.totalGstCreditCents).toBe(0);
      expect(r.bas.purchaseGstCreditCents).toBe(0);
    });

    it("claims the purchase credit only in the purchase FY", () => {
      const later = [trip({ id: 3, date: "2026-08-01", odoStart: 1000, odoEnd: 1100, isBusiness: true })];
      const r = report({ trips: [...trips, ...later], expenses: [], vehicle, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2026-27", today: TODAY });
      expect(r.bas.purchaseGstCreditCents).toBe(0);
      expect(r.bas.totalGstCreditCents).toBe(0);
    });

    it("reduces the depreciation cost by only the claimed purchase credit", () => {
      const v: VehicleRow = { ...vehicle, purchaseCostCents: 4400000, purchaseGstCents: 400000 };
      const r = report({ trips, expenses: [], vehicle: v, settings: { gstRegistered: true }, logbookPeriods: [{ id: 9, vehicleId: 1, startDate: "2025-11-20", endDate: "2026-02-28", odoStart: 0, odoEnd: 1000 }], fyLabel: "2025-26", today: TODAY });
      // credit 400000 x 0.8 = 320000 claimed; base 4400000 - 320000 = 4080000; 223 days held (20 Nov - 30 Jun).
      const decline = Math.round(4080000 * (223 / 365) * 0.25);
      expect(r.bas.purchaseGstCreditCents).toBe(320000);
      expect(r.annual.depreciationDeductionCents).toBe(Math.round(decline * 0.8));
    });

    it("keeps the purchase-FY claimed credit in later FYs' cost base", () => {
      const v: VehicleRow = { ...vehicle, purchaseCostCents: 4400000, purchaseGstCents: 400000 };
      // 2026-27: 50% business, but the cost base still uses the 80% purchase-FY claim.
      const later = [
        trip({ id: 3, date: "2026-08-01", odoStart: 1000, odoEnd: 1100, isBusiness: true }),
        trip({ id: 4, date: "2026-08-02", odoStart: 1100, odoEnd: 1200, isBusiness: false }),
      ];
      const r = report({ trips: [...trips, ...later], expenses: [], vehicle: v, settings: { gstRegistered: true }, logbookPeriods: [{ id: 9, vehicleId: 1, startDate: "2026-07-15", endDate: "2026-10-31", odoStart: 1000, odoEnd: 1200 }], fyLabel: "2026-27", today: TODAY });
      const first = Math.round(4080000 * (223 / 365) * 0.25);
      const decline = Math.round((4080000 - first) * 0.25);
      expect(r.annual.depreciationDeductionCents).toBe(Math.round(decline * 0.5));
      expect(r.notices.some((n) => /^Purchase year FY 2025-26 .*all trips recorded in FY 2025-26/.test(n))).toBe(true);
    });

    it("a self-assessed effective life changes the depreciation (#66)", () => {
      const v: VehicleRow = { ...vehicle, purchaseCostCents: 4400000, purchaseGstCents: 0 };
      const args = { trips, expenses: [], settings: { gstRegistered: true }, logbookPeriods: [{ id: 9, vehicleId: 1, startDate: "2025-11-20", endDate: "2026-02-28", odoStart: 0, odoEnd: 1000 }], fyLabel: "2025-26", today: TODAY };
      const def = report({ ...args, vehicle: v });
      const four = report({ ...args, vehicle: { ...v, effectiveLifeYears: 4 } });
      expect(four.annual.depreciationDeductionCents).toBe(Math.round(Math.round(4400000 * (223 / 365) * 0.5) * 0.8));
      expect(four.annual.depreciationDeductionCents).toBeGreaterThan(def.annual.depreciationDeductionCents);
    });

    it("private sale: no purchase credit and depreciation on the full cost (#46)", () => {
      const v: VehicleRow = { ...vehicle, purchaseCostCents: 4400000, purchaseGstCents: 0 };
      const r = report({ trips, expenses: [], vehicle: v, settings: { gstRegistered: true }, logbookPeriods: [{ id: 9, vehicleId: 1, startDate: "2025-11-20", endDate: "2026-02-28", odoStart: 0, odoEnd: 1000 }], fyLabel: "2025-26", today: TODAY });
      const decline = Math.round(4400000 * (223 / 365) * 0.25);
      expect(r.bas.purchaseGstCreditCents).toBe(0);
      expect(r.annual.depreciationDeductionCents).toBe(Math.round(decline * 0.8));
      expect(r.notices.some((n) => /purchase GST/i.test(n))).toBe(false);
    });

    it("unrecorded purchase GST: no credit, full-cost depreciation, and a notice (#46)", () => {
      const v: VehicleRow = { ...vehicle, purchaseCostCents: 4400000, purchaseGstCents: null };
      const r = report({ trips, expenses: [], vehicle: v, settings: { gstRegistered: true }, logbookPeriods: [{ id: 9, vehicleId: 1, startDate: "2025-11-20", endDate: "2026-02-28", odoStart: 0, odoEnd: 1000 }], fyLabel: "2025-26", today: TODAY });
      const decline = Math.round(4400000 * (223 / 365) * 0.25);
      expect(r.bas.purchaseGstCreditCents).toBe(0);
      expect(r.annual.depreciationDeductionCents).toBe(Math.round(decline * 0.8));
      expect(r.notices.some((n) => /GST on the car purchase isn't recorded/.test(n))).toBe(true);
    });

    it("no unrecorded-GST notice when not GST-registered", () => {
      const v: VehicleRow = { ...vehicle, purchaseGstCents: null };
      const r = report({ trips, expenses: [], vehicle: v, settings: { gstRegistered: false }, logbookPeriods: [], fyLabel: "2025-26", today: TODAY });
      expect(r.notices.some((n) => /GST on the car purchase isn't recorded/.test(n))).toBe(false);
    });

    it("shows no depreciation or car-limit notice for an FY before the purchase", () => {
      const future: VehicleRow = { ...vehicle, purchaseDate: "2027-08-01" };
      const r = report({ trips, expenses: [], vehicle: future, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2025-26", today: TODAY });
      expect(r.annual.depreciationDeductionCents).toBe(0);
      expect(r.notices.some((n) => /car limit/.test(n))).toBe(false);
    });

    it("warns and omits depreciation and purchase credit for an FY with no published car limit", () => {
      const future: VehicleRow = { ...vehicle, purchaseDate: "2027-08-01" };
      const futureTrips = [trip({ id: 4, date: "2027-08-02", odoStart: 0, odoEnd: 100, isBusiness: true })];
      const r = report({ trips: futureTrips, expenses: [], vehicle: future, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2027-28", today: TODAY });
      expect(r.annual.depreciationDeductionCents).toBe(0);
      expect(r.bas.purchaseGstCreditCents).toBe(0);
      expect(r.notices.some((n) => /car limit for FY 2027-28/.test(n))).toBe(true);
    });
  });

  describe("rounding, GST registration and categories (GLB-6)", () => {
    // 2/3 business: 200 of 300 km.
    const thirds = [
      trip({ id: 1, odoStart: 0, odoEnd: 200, isBusiness: true }),
      trip({ id: 2, odoStart: 200, odoEnd: 300, isBusiness: false }),
    ];

    it("computes dollars from the displayed % (2 dp), not the raw ratio", () => {
      const expenses = [expense({ id: 1, amountInclCents: 330000, gstCents: 30000 })];
      const r = report({ trips: thirds, expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [{ ...LOGBOOK_2024, odoEnd: 300 }], fyLabel: "2024-25", today: TODAY });
      expect(r.businessPctBps).toBe(6667);
      expect(r.businessPct).toBe(0.6667);
      expect(r.bas.totalGstCreditCents).toBe(20001); // 30000 x 0.6667, not 20000 (raw 2/3)
      expect(r.annual.runningCostsDeductionCents).toBe(200010); // 300000 x 0.6667
    });

    it("reports no BAS credit when not GST-registered", () => {
      const expenses = [expense({ id: 1, amountInclCents: 11000, gstCents: 1000 })];
      const r = report({ trips: [trip({})], expenses, vehicle: null, settings: { gstRegistered: false }, logbookPeriods: [LOGBOOK_2024], fyLabel: "2024-25", today: TODAY });
      expect(r.bas.totalGstCreditCents).toBe(0);
      expect(r.bas.quarters.every((q) => q.gstCreditCents === 0)).toBe(true);
      expect(r.annual.runningCostsDeductionCents).toBe(11000); // GST-inclusive when not registered
    });

    it("shows category totals on the same GST basis as the deduction", () => {
      const expenses = [expense({ id: 1, category: "fuel", amountInclCents: 11000, gstCents: 1000 })];
      const reg = report({ trips: [trip({})], expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
      expect(reg.annual.byCategory).toEqual([{ category: "fuel", totalCents: 10000 }]);
      expect(reg.annual.categoryBasis).toBe("ex-gst");
      const unreg = report({ trips: [trip({})], expenses, vehicle: null, settings: { gstRegistered: false }, logbookPeriods: [], fyLabel: "2024-25", today: TODAY });
      expect(unreg.annual.byCategory).toEqual([{ category: "fuel", totalCents: 11000 }]);
      expect(unreg.annual.categoryBasis).toBe("gst-inclusive");
    });

    it("excludes 'depreciation' expense rows from every claim, with a notice", () => {
      const expenses = [
        expense({ id: 1, category: "fuel", amountInclCents: 11000, gstCents: 1000 }),
        expense({ id: 2, category: "depreciation", amountInclCents: 500000, gstCents: 45455 }),
      ];
      const r = report({ trips: [trip({})], expenses, vehicle: null, settings: { gstRegistered: true }, logbookPeriods: [LOGBOOK_2024], fyLabel: "2024-25", today: TODAY });
      expect(r.bas.totalGstCreditCents).toBe(1000); // fuel only; the depreciation row's GST is not claimed
      expect(r.annual.runningCostsDeductionCents).toBe(10000);
      expect(r.annual.byCategory.map((c) => c.category)).toEqual(["fuel"]);
      expect(r.notices.some((n) => /depreciation.*excluded/i.test(n))).toBe(true);
    });
  });
});
