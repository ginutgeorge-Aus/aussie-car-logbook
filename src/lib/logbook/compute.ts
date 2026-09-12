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
