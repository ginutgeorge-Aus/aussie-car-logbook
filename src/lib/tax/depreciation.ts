import { financialYear, daysHeldInFy } from "@/lib/tax/dates";

// GST-exclusive car depreciation cost limit per FY (in cents).
// Update yearly from ATO. Source: ATO "car cost limit for depreciation".
export const CAR_LIMIT_CENTS: Record<string, number> = {
  "2023-24": 6864900, // $68,649
  "2024-25": 6967400, // $69,674
};

export function carLimitFor(fyLabel: string): number {
  const v = CAR_LIMIT_CENTS[fyLabel];
  if (v === undefined) throw new Error(`No car cost limit configured for FY ${fyLabel}`);
  return v;
}

export function diminishingValue(input: {
  openingValueCents: number;
  daysHeld: number;
  effectiveLifeYears: number;
}): number {
  const { openingValueCents, daysHeld, effectiveLifeYears } = input;
  const decline = openingValueCents * (daysHeld / 365) * (2 / effectiveLifeYears);
  return Math.round(decline);
}

export const EFFECTIVE_LIFE_YEARS = 8;

export function depreciationForFy(input: {
  purchaseCostCents: number;
  purchaseDateISO: string;
  fyLabel: string;
  effectiveLifeYears?: number;
}): number {
  const { purchaseCostCents, purchaseDateISO, fyLabel } = input;
  const effectiveLifeYears = input.effectiveLifeYears ?? EFFECTIVE_LIFE_YEARS;

  const purchaseFy = financialYear(purchaseDateISO).label;
  const purchaseStartYear = Number(purchaseFy.slice(0, 4));
  const targetStartYear = Number(fyLabel.slice(0, 4));
  if (targetStartYear < purchaseStartYear) return 0;

  let opening = Math.min(purchaseCostCents, carLimitFor(purchaseFy));
  for (let sy = purchaseStartYear; sy <= targetStartYear; sy++) {
    const label = `${sy}-${String(sy + 1).slice(2)}`;
    const daysHeld = daysHeldInFy(purchaseDateISO, label);
    const decline = diminishingValue({ openingValueCents: opening, daysHeld, effectiveLifeYears });
    const closing = Math.max(0, opening - decline);
    if (sy === targetStartYear) return opening - closing;
    opening = closing;
  }
  return 0;
}
