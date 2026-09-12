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
