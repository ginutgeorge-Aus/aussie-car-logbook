import type { TripLeg } from "@/lib/tax/types";

export function businessPct(trips: TripLeg[]): number {
  const total = trips.reduce((s, t) => s + t.km, 0);
  if (total === 0) return 0;
  const business = trips.filter((t) => t.isBusiness).reduce((s, t) => s + t.km, 0);
  return business / total;
}

export function businessPctRounded(trips: TripLeg[]): number {
  return Math.round(businessPct(trips) * 100);
}
