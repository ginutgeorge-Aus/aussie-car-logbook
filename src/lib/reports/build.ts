import {
  financialYear,
  fyQuarters,
  gstCredit,
  gstCreditEligible,
  annualDeduction,
  depreciationForFy,
  carPurchaseGstCents,
  businessPctBps,
} from "@/lib/tax";
import { businessTripsMissingPurpose, filterTripsByFy, missingFyOdometers, resolveBusinessUse, type BusinessUseSource } from "@/lib/logbook/compute";
import type { LogbookPeriodRow, TripRow, VehicleFyOdometerRow, VehicleRow } from "@/lib/logbook/types";
import type { ExpenseRow } from "@/lib/data/expense";
import type { ExpenseCategory, ExpenseInput } from "@/lib/tax/types";

/** An expense whose GST credit is held back until a tax invoice is recorded. */
export type NeedsTaxInvoiceItem = { id: number; date: string; vendor: string | null; amountInclCents: number };

export type FyReport = {
  fyLabel: string;
  /** Business use in basis points (% to 2 dp) — the displayed value. */
  businessPctBps: number;
  /** `businessPctBps / 10000`: the ratio every dollar figure is computed from. */
  businessPct: number;
  /** Where `businessPct` came from: a valid logbook period, or the FY-trips fallback. */
  businessUseSource: BusinessUseSource;
  bas: {
    quarters: Array<{
      quarter: 1 | 2 | 3 | 4;
      label: string;
      gstCreditCents: number;
      /** Business share of GST not claimable yet: over $82.50 with no tax invoice (ATO rule). */
      heldBackGstCents: number;
      needsTaxInvoice: NeedsTaxInvoiceItem[];
    }>;
    totalGstCreditCents: number;
    totalHeldBackGstCents: number;
    /** Business share of the capped car-purchase GST credit (already inside its quarter). */
    purchaseGstCreditCents: number;
  };
  annual: {
    /**
     * False when no valid logbook covers the FY: the ATO logbook method then
     * allows no car deduction, so every deduction figure is 0 (#52).
     */
    claimable: boolean;
    runningCostsDeductionCents: number;
    depreciationDeductionCents: number;
    totalDeductionCents: number;
    /** FY expense totals per category, on the same GST basis as the deduction (see `categoryBasis`). */
    byCategory: Array<{ category: ExpenseCategory; totalCents: number }>;
    categoryBasis: "ex-gst" | "gst-inclusive";
  };
  notices: string[];
};

function toExpenseInput(e: ExpenseRow): ExpenseInput {
  return {
    amountInclCents: e.amountInclCents,
    gstCents: e.gstCents,
    dateISO: e.date,
    category: e.category as ExpenseCategory,
  };
}

/**
 * Report warning for a purchase FY with no ATO car limit configured.
 *
 * @param purchaseFy FY label of the car purchase.
 * @param omitted what was left out because of it, e.g. "Depreciation is omitted".
 */
function missingCarLimitNotice(purchaseFy: string, omitted: string): string {
  return `No ATO car limit for FY ${purchaseFy} is configured — ${omitted}. Add it to src/lib/tax/depreciation.ts from the ATO.`;
}

/**
 * Business share of the car-purchase GST credit for the report FY: claimed only
 * when GST-registered and only in the FY of purchase, capped at 1/11 of that
 * FY's car limit, then multiplied by the business-use ratio.
 *
 * @returns the credit (cents), the purchase date that places it in a BAS
 *   quarter (null when none is claimed), and a notice when the car limit is missing.
 */
function carPurchaseCredit(input: {
  vehicle: VehicleRow | null;
  gstRegistered: boolean;
  fyLabel: string;
  ratio: number;
}): { creditCents: number; dateISO: string | null; notice: string | null } {
  const { vehicle, gstRegistered, fyLabel, ratio } = input;
  const none = { creditCents: 0, dateISO: null, notice: null };
  if (!gstRegistered || !vehicle?.purchaseDate || vehicle.purchaseCostCents == null) return none;
  if (financialYear(vehicle.purchaseDate).label !== fyLabel) return none;
  try {
    const gst = carPurchaseGstCents({ purchaseGstCents: vehicle.purchaseGstCents, purchaseDateISO: vehicle.purchaseDate });
    return { creditCents: Math.round(gst * ratio), dateISO: vehicle.purchaseDate, notice: null };
  } catch {
    return { ...none, notice: missingCarLimitNotice(fyLabel, "the car purchase GST credit is omitted from the BAS") };
  }
}

/**
 * Builds the BAS (quarterly GST credit) and annual income-tax deduction report
 * for one FY. Business use is rounded once, to basis points (% to 2 dp), and
 * every dollar figure uses that rounded ratio. BAS credits are 0 unless
 * GST-registered; 'depreciation' expense rows are excluded (computed instead). Business use comes from the most recent valid logbook period
 * (ATO logbook method), falling back to the FY's own trips with a notice when
 * no valid logbook exists (see `resolveBusinessUse`). That fallback feeds BAS
 * only: without a valid logbook the income-tax car deduction is 0. Notices also
 * flag a missing start/end-of-year odometer reading for a year the logbook covers.
 */
export function buildFyReport(input: {
  trips: TripRow[];
  expenses: ExpenseRow[];
  vehicle: VehicleRow | null;
  settings: { gstRegistered: boolean };
  logbookPeriods: LogbookPeriodRow[];
  fyOdometers: VehicleFyOdometerRow[];
  fyLabel: string;
  today: string;
}): FyReport {
  const { trips, expenses, vehicle, settings, logbookPeriods, fyOdometers, fyLabel, today } = input;
  const businessUse = resolveBusinessUse({ trips, periods: logbookPeriods, fyLabel, today });
  const notices: string[] = [...businessUse.notices];
  // Single rounding: % to 2 dp; all dollars use the same rounded ratio that is displayed.
  const bps = businessPctBps(businessUse.ratio);
  const ratio = bps / 10000;
  // ATO logbook method: no valid logbook, no car deduction (ITAA 1997 s28-100(2): "you must ... keep a log book"). BAS still apportions
  // GST by business use, which doesn't need a logbook, so it keeps `ratio`.
  const claimable = businessUse.source.kind === "logbook";
  const deductionRatio = claimable ? ratio : 0;
  if (!claimable) {
    notices.push(
      `The car deduction can't be claimed for FY ${fyLabel} — the ATO logbook method needs a valid logbook. ` +
        "Keep a logbook for at least 12 continuous weeks, then add it on the Trips page.",
    );
  }
  // Flag only (no $ change): the ATO needs odometer readings at the start and end of each year a logbook is relied on.
  if (claimable) {
    const missing = missingFyOdometers(fyOdometers, fyLabel, today);
    const tail = " — the ATO needs start and end readings for each year you use a logbook. Add it on the Vehicle page.";
    if (missing.open) notices.push(`Odometer reading at the start of FY ${fyLabel} (1 July) is missing${tail}`);
    if (missing.close) notices.push(`Odometer reading at the end of FY ${fyLabel} (30 June) is missing${tail}`);
  }
  // Flag only (no $ change): the ATO needs the reason for every business journey.
  const noReason = businessTripsMissingPurpose(filterTripsByFy(trips, fyLabel)).length;
  if (noReason > 0) {
    notices.push(
      `${noReason} business ${noReason === 1 ? "trip" : "trips"} in FY ${fyLabel} ${noReason === 1 ? "has" : "have"} no reason recorded — ` +
        "the ATO needs the reason for every business journey. Add it on the Trips page.",
    );
  }
  const inFy = expenses.filter((e) => financialYear(e.date).label === fyLabel);
  // Depreciation is computed from the vehicle; a 'depreciation' expense row would double count.
  const fyExpenses = inFy.filter((e) => e.category !== "depreciation");
  if (fyExpenses.length < inFy.length) {
    notices.push(
      "Expenses recorded under the 'depreciation' category were excluded — car depreciation is calculated from the vehicle's purchase details.",
    );
  }

  const purchase = carPurchaseCredit({ vehicle, gstRegistered: settings.gstRegistered, fyLabel, ratio });
  if (purchase.notice) notices.push(purchase.notice);
  if (
    settings.gstRegistered &&
    vehicle?.purchaseDate &&
    vehicle.purchaseCostCents != null &&
    vehicle.purchaseGstCents == null &&
    financialYear(vehicle.purchaseDate).label <= fyLabel
  ) {
    notices.push(
      "The GST on the car purchase isn't recorded, so no GST credit is claimed for it and depreciation uses the full cost. " +
        "Enter the GST from the tax invoice on the Vehicle page (0 for a private sale).",
    );
  }

  const quarters = fyQuarters(fyLabel).map((q) => {
    const inQ = fyExpenses.filter((e) => e.date >= q.startISO && e.date <= q.endISO);
    const purchaseInQ = purchase.dateISO !== null && purchase.dateISO >= q.startISO && purchase.dateISO <= q.endISO;
    // No GST credits at all unless GST-registered.
    if (!settings.gstRegistered) {
      return { quarter: q.quarter, label: q.label, gstCreditCents: 0, heldBackGstCents: 0, needsTaxInvoice: [] };
    }
    const claimable = inQ.filter((e) => gstCreditEligible(e));
    const held = inQ.filter((e) => !gstCreditEligible(e));
    const heldBackGstCents = gstCredit(held.map(toExpenseInput), ratio);
    return {
      quarter: q.quarter,
      label: q.label,
      gstCreditCents: gstCredit(claimable.map(toExpenseInput), ratio) + (purchaseInQ ? purchase.creditCents : 0),
      heldBackGstCents,
      // Nothing to chase when the business share is 0 (e.g. 0% business use).
      needsTaxInvoice: heldBackGstCents > 0
        ? held.map((e) => ({ id: e.id, date: e.date, vendor: e.vendor, amountInclCents: e.amountInclCents }))
        : [],
    };
  });
  const totalGstCreditCents = quarters.reduce((s, q) => s + q.gstCreditCents, 0);
  const totalHeldBackGstCents = quarters.reduce((s, q) => s + q.heldBackGstCents, 0);

  const runningCostsDeductionCents = annualDeduction(
    fyExpenses.map(toExpenseInput),
    deductionRatio,
    settings.gstRegistered,
  );

  let depreciationDeductionCents = 0;
  if (vehicle?.purchaseDate && vehicle.purchaseCostCents != null && financialYear(vehicle.purchaseDate).label <= fyLabel) {
    try {
      // The cost base drops by the credit claimed in the purchase FY, at that FY's business share.
      const purchaseFy = financialYear(vehicle.purchaseDate).label;
      let purchaseRatio = ratio;
      if (purchaseFy !== fyLabel) {
        const purchaseUse = resolveBusinessUse({ trips, periods: logbookPeriods, fyLabel: purchaseFy, today });
        purchaseRatio = purchaseUse.ratio;
        if (settings.gstRegistered) {
          notices.push(
            ...purchaseUse.notices.map((n) => `Purchase year FY ${purchaseFy} (sets the GST taken off the depreciation base): ${n}`),
          );
        }
      }
      const purchaseGstClaimedCents = settings.gstRegistered
        ? Math.round(
            carPurchaseGstCents({ purchaseGstCents: vehicle.purchaseGstCents, purchaseDateISO: vehicle.purchaseDate }) * purchaseRatio,
          )
        : 0;
      const decline = depreciationForFy({
        purchaseCostCents: vehicle.purchaseCostCents,
        purchaseDateISO: vehicle.purchaseDate,
        fyLabel,
        purchaseGstClaimedCents,
        effectiveLifeYears: vehicle.effectiveLifeYears ?? undefined,
      });
      depreciationDeductionCents = Math.round(decline * deductionRatio);
    } catch {
      notices.push(missingCarLimitNotice(financialYear(vehicle.purchaseDate).label, "Depreciation is omitted"));
    }
  }

  const byCategoryMap = new Map<ExpenseCategory, number>();
  for (const e of fyExpenses) {
    const cat = e.category as ExpenseCategory;
    const amount = settings.gstRegistered ? e.amountInclCents - e.gstCents : e.amountInclCents;
    byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + amount);
  }
  const byCategory = Array.from(byCategoryMap, ([category, totalCents]) => ({ category, totalCents }));

  return {
    fyLabel,
    businessPctBps: bps,
    businessPct: ratio,
    businessUseSource: businessUse.source,
    bas: { quarters, totalGstCreditCents, totalHeldBackGstCents, purchaseGstCreditCents: purchase.creditCents },
    annual: {
      claimable,
      runningCostsDeductionCents,
      depreciationDeductionCents,
      totalDeductionCents: runningCostsDeductionCents + depreciationDeductionCents,
      byCategory,
      categoryBasis: settings.gstRegistered ? "ex-gst" : "gst-inclusive",
    },
    notices,
  };
}
