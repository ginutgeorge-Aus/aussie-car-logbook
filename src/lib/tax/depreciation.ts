import { financialYear, daysHeldInFy } from "@/lib/tax/dates";
import { gstFromInclusive } from "@/lib/tax/gst";

// ATO "car limit" per FY (in cents): the most cost that can be depreciated for a
// car first used/leased in that FY, and the basis of the maximum purchase GST
// credit (limit / 11). Indexed yearly — add the new FY each July from the ATO.
// Sources (checked 2026-10-10):
//   2020-21 .. 2025-26 — "Table 2: Yearly car limit" in ATO "Depreciation and capital expenses
//     and allowances" (print section): https://www.ato.gov.au/api/public/content/0-b8fed6d8-e559-4de3-b9e2-3734fa6c7ba4
//     and the car-limit list on https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/tradies-be-certain-about-what-you-can-claim
//     (2023-24 is $68,108; the value previously here, $68,649, was wrong)
//   2025-26 — https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/changes-to-car-thresholds-from-1-july
//   2026-27 ($69,883) — https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/car-thresholds-from-1-july
// An FY missing here throws (never silently 0); reports turn that into a visible warning.
export const CAR_LIMIT_CENTS: Record<string, number> = {
  "2020-21": 5913600, // $59,136
  "2021-22": 6073300, // $60,733
  "2022-23": 6474100, // $64,741
  "2023-24": 6810800, // $68,108
  "2024-25": 6967400, // $69,674
  "2025-26": 6967400, // $69,674
  "2026-27": 6988300, // $69,883
};

/**
 * Car limit in cents for an FY.
 *
 * @param fyLabel FY label such as "2025-26".
 * @throws Error naming the FY when no ATO limit is configured for it.
 */
export function carLimitFor(fyLabel: string): number {
  const v = CAR_LIMIT_CENTS[fyLabel];
  if (v === undefined) throw new Error(`No ATO car limit configured for FY ${fyLabel}`);
  return v;
}

/**
 * GST credit on a car purchase (before business-use apportionment): the GST on
 * the tax invoice, capped at 1/11 of the car limit for the purchase FY. A
 * private sale (0) or unrecorded GST (null — no tax invoice, no credit) gives 0.
 *
 * @param input GST on the purchase tax invoice (cents, or null when not recorded) and purchase date (ISO).
 * @throws Error when the purchase FY has no configured car limit.
 */
export function carPurchaseGstCents(input: { purchaseGstCents: number | null; purchaseDateISO: string }): number {
  const maxCredit = gstFromInclusive(carLimitFor(financialYear(input.purchaseDateISO).label));
  return Math.min(input.purchaseGstCents ?? 0, maxCredit);
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

/**
 * Decline in value of the car for one FY (diminishing value, before business-use %).
 *
 * Cost base: the GST-inclusive purchase cost, reduced by the purchase GST credit
 * actually claimed on the BAS (the capped credit x purchase-FY business share;
 * 0 when not GST-registered), then capped at the car limit for the purchase FY —
 * the order in the ATO Guide to depreciating assets.
 *
 * @param input GST-inclusive purchase cost (cents), purchase date, target FY,
 *   claimed purchase GST credit (cents), and optional effective life (default 8 years).
 * @throws Error when the purchase FY has no configured car limit.
 */
export function depreciationForFy(input: {
  purchaseCostCents: number;
  purchaseDateISO: string;
  fyLabel: string;
  purchaseGstClaimedCents: number;
  effectiveLifeYears?: number;
}): number {
  const { purchaseCostCents, purchaseDateISO, fyLabel, purchaseGstClaimedCents } = input;
  const effectiveLifeYears = input.effectiveLifeYears ?? EFFECTIVE_LIFE_YEARS;

  const purchaseFy = financialYear(purchaseDateISO).label;
  const purchaseStartYear = Number(purchaseFy.slice(0, 4));
  const targetStartYear = Number(fyLabel.slice(0, 4));
  if (targetStartYear < purchaseStartYear) return 0;

  let opening = Math.min(purchaseCostCents - purchaseGstClaimedCents, carLimitFor(purchaseFy));
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
