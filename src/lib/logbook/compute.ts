import { businessPctRounded, financialYear } from "@/lib/tax";
import type { TripLeg, TripRow } from "@/lib/logbook/types";

export function tripKm(t: { odoStart: number; odoEnd: number }): number {
  return t.odoEnd - t.odoStart;
}

export function tripsToLegs(
  trips: Pick<TripRow, "odoStart" | "odoEnd" | "isBusiness">[],
): TripLeg[] {
  return trips.map((t) => ({ km: tripKm(t), isBusiness: t.isBusiness }));
}

export function filterTripsByFy<T extends { date: string }>(
  trips: T[],
  fyLabel: string,
): T[] {
  return trips.filter((t) => financialYear(t.date).label === fyLabel);
}

export function fyBusinessPct(
  trips: Pick<TripRow, "date" | "odoStart" | "odoEnd" | "isBusiness">[],
  fyLabel: string,
): number {
  return businessPctRounded(tripsToLegs(filterTripsByFy(trips, fyLabel)));
}

/**
 * Latest known odometer reading: the highest trip `odoEnd`, never below the
 * vehicle's opening odometer. Null when neither is known.
 */
export function currentOdometer(trips: Pick<TripRow, "odoEnd">[], odoOpen: number | null): number | null {
  return trips.reduce<number | null>((max, t) => (max === null || t.odoEnd > max ? t.odoEnd : max), odoOpen);
}

/** Business and total km driven within one FY (display figures for the dashboard). */
export function fyKmTotals(
  trips: Pick<TripRow, "date" | "odoStart" | "odoEnd" | "isBusiness">[],
  fyLabel: string,
): { businessKm: number; totalKm: number } {
  let businessKm = 0;
  let totalKm = 0;
  for (const leg of tripsToLegs(filterTripsByFy(trips, fyLabel))) {
    totalKm += leg.km;
    if (leg.isBusiness) businessKm += leg.km;
  }
  return { businessKm, totalKm };
}
