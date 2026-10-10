import {
  financialYear,
  fyQuarters,
  gstCredit,
  annualDeduction,
  depreciationForFy,
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
}): FyReport {
  const { trips, expenses, vehicle, settings, logbookPeriods, fyLabel } = input;
  const businessUse = resolveBusinessUse({ trips, periods: logbookPeriods, fyLabel });
  const notices: string[] = [...businessUse.notices];
  const ratio = businessUse.ratio;
  const fyExpenses = expenses.filter((e) => financialYear(e.date).label === fyLabel);

  const quarters = fyQuarters(fyLabel).map((q) => {
    const inQ = fyExpenses.filter((e) => e.date >= q.startISO && e.date <= q.endISO);
    return {
      quarter: q.quarter,
      label: q.label,
      gstCreditCents: gstCredit(inQ.map(toExpenseInput), ratio),
    };
  });
  const totalGstCreditCents = quarters.reduce((s, q) => s + q.gstCreditCents, 0);

  const runningCostsDeductionCents = annualDeduction(
    fyExpenses.map(toExpenseInput),
    ratio,
    settings.gstRegistered,
  );

  let depreciationDeductionCents = 0;
  if (vehicle?.purchaseDate && vehicle.purchaseCostCents != null) {
    try {
      const decline = depreciationForFy({
        purchaseCostCents: vehicle.purchaseCostCents,
        purchaseDateISO: vehicle.purchaseDate,
        fyLabel,
      });
      depreciationDeductionCents = Math.round(decline * ratio);
    } catch {
      notices.push(
        `No car cost limit configured for the purchase year — depreciation omitted from FY ${fyLabel}. Update src/lib/tax/depreciation.ts.`,
      );
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
    bas: { quarters, totalGstCreditCents },
    annual: {
      runningCostsDeductionCents,
      depreciationDeductionCents,
      totalDeductionCents: runningCostsDeductionCents + depreciationDeductionCents,
      byCategory,
    },
    notices,
  };
}
