import {
  financialYear,
  fyQuarters,
  gstCredit,
  annualDeduction,
  depreciationForFy,
  carPurchaseGstCents,
} from "@/lib/tax";
import { resolveBusinessUse, type BusinessUseSource } from "@/lib/logbook/compute";
import type { LogbookPeriodRow, TripRow, VehicleRow } from "@/lib/logbook/types";
import type { ExpenseRow } from "@/lib/data/expense";
import type { ExpenseCategory, ExpenseInput } from "@/lib/tax/types";

export type FyReport = {
  fyLabel: string;
  businessPct: number;
  /** Where `businessPct` came from: a valid logbook period, or the FY-trips fallback. */
  businessUseSource: BusinessUseSource;
  bas: {
    quarters: Array<{ quarter: 1 | 2 | 3 | 4; label: string; gstCreditCents: number }>;
    totalGstCreditCents: number;
    /** Business share of the capped car-purchase GST credit (already inside its quarter). */
    purchaseGstCreditCents: number;
  };
  annual: {
    runningCostsDeductionCents: number;
    depreciationDeductionCents: number;
    totalDeductionCents: number;
    byCategory: Array<{ category: ExpenseCategory; totalInclCents: number }>;
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
    const gst = carPurchaseGstCents({ purchaseCostCents: vehicle.purchaseCostCents, purchaseDateISO: vehicle.purchaseDate });
    return { creditCents: Math.round(gst * ratio), dateISO: vehicle.purchaseDate, notice: null };
  } catch {
    return { ...none, notice: missingCarLimitNotice(fyLabel, "the car purchase GST credit is omitted from the BAS") };
  }
}

/**
 * Builds the BAS (quarterly GST credit) and annual income-tax deduction report
 * for one FY. Business use comes from the most recent valid logbook period
 * (ATO logbook method), falling back to the FY's own trips with a notice when
 * no valid logbook exists (see `resolveBusinessUse`).
 */
export function buildFyReport(input: {
  trips: TripRow[];
  expenses: ExpenseRow[];
  vehicle: VehicleRow | null;
  settings: { gstRegistered: boolean };
  logbookPeriods: LogbookPeriodRow[];
  fyLabel: string;
  today: string;
}): FyReport {
  const { trips, expenses, vehicle, settings, logbookPeriods, fyLabel, today } = input;
  const businessUse = resolveBusinessUse({ trips, periods: logbookPeriods, fyLabel, today });
  const notices: string[] = [...businessUse.notices];
  const ratio = businessUse.ratio;
  const fyExpenses = expenses.filter((e) => financialYear(e.date).label === fyLabel);

  const purchase = carPurchaseCredit({ vehicle, gstRegistered: settings.gstRegistered, fyLabel, ratio });
  if (purchase.notice) notices.push(purchase.notice);

  const quarters = fyQuarters(fyLabel).map((q) => {
    const inQ = fyExpenses.filter((e) => e.date >= q.startISO && e.date <= q.endISO);
    const purchaseInQ = purchase.dateISO !== null && purchase.dateISO >= q.startISO && purchase.dateISO <= q.endISO;
    return {
      quarter: q.quarter,
      label: q.label,
      gstCreditCents: gstCredit(inQ.map(toExpenseInput), ratio) + (purchaseInQ ? purchase.creditCents : 0),
    };
  });
  const totalGstCreditCents = quarters.reduce((s, q) => s + q.gstCreditCents, 0);

  const runningCostsDeductionCents = annualDeduction(
    fyExpenses.map(toExpenseInput),
    ratio,
    settings.gstRegistered,
  );

  let depreciationDeductionCents = 0;
  if (vehicle?.purchaseDate && vehicle.purchaseCostCents != null && financialYear(vehicle.purchaseDate).label <= fyLabel) {
    try {
      // The cost base drops by the credit claimed in the purchase FY, at that FY's business share.
      const purchaseFy = financialYear(vehicle.purchaseDate).label;
      const purchaseRatio =
        purchaseFy === fyLabel ? ratio : resolveBusinessUse({ trips, periods: logbookPeriods, fyLabel: purchaseFy, today }).ratio;
      const purchaseGstClaimedCents = settings.gstRegistered
        ? Math.round(
            carPurchaseGstCents({ purchaseCostCents: vehicle.purchaseCostCents, purchaseDateISO: vehicle.purchaseDate }) * purchaseRatio,
          )
        : 0;
      const decline = depreciationForFy({
        purchaseCostCents: vehicle.purchaseCostCents,
        purchaseDateISO: vehicle.purchaseDate,
        fyLabel,
        purchaseGstClaimedCents,
      });
      depreciationDeductionCents = Math.round(decline * ratio);
    } catch {
      notices.push(missingCarLimitNotice(financialYear(vehicle.purchaseDate).label, "Depreciation is omitted"));
    }
  }

  const byCategoryMap = new Map<ExpenseCategory, number>();
  for (const e of fyExpenses) {
    const cat = e.category as ExpenseCategory;
    byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + e.amountInclCents);
  }
  const byCategory = Array.from(byCategoryMap, ([category, totalInclCents]) => ({ category, totalInclCents }));

  return {
    fyLabel,
    businessPct: ratio,
    businessUseSource: businessUse.source,
    bas: { quarters, totalGstCreditCents, purchaseGstCreditCents: purchase.creditCents },
    annual: {
      runningCostsDeductionCents,
      depreciationDeductionCents,
      totalDeductionCents: runningCostsDeductionCents + depreciationDeductionCents,
      byCategory,
    },
    notices,
  };
}
