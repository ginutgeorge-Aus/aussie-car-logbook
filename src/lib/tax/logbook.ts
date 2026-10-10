import type { TripLeg } from "@/lib/tax/types";
import { financialYear } from "@/lib/tax/dates";

/**
 * Business-use ratio (0..1) for a set of trip legs: businessKm / totalKm.
 * Returns 0 when there are no kilometres (no divide-by-zero).
 */
export function businessPct(trips: TripLeg[]): number {
  const total = trips.reduce((s, t) => s + t.km, 0);
  if (total === 0) return 0;
  const business = trips.filter((t) => t.isBusiness).reduce((s, t) => s + t.km, 0);
  return business / total;
}

/**
 * Rounding authority for business use: integer basis points (business % x 100),
 * i.e. the percentage rounded to 2 decimal places. Reports display this value
 * and compute every dollar figure from `bps / 10000`, so shown % and $ agree.
 *
 * @param ratio raw business-use ratio (0..1).
 */
export function businessPctBps(ratio: number): number {
  return Math.round(ratio * 10000);
}

/**
 * Formats basis points as a percentage string with 2 decimals (no "%" sign).
 *
 * @param bps business use in basis points, e.g. 6667 -> "66.67".
 */
export function formatBusinessPct(bps: number): string {
  return (bps / 100).toFixed(2);
}

/** Business-use percentage for a set of trip legs, rounded to 2 decimal places. */
export function businessPctRounded(trips: TripLeg[]): number {
  return businessPctBps(businessPct(trips)) / 100;
}

/** ATO logbook method: the logbook must cover at least 12 continuous weeks. */
export const LOGBOOK_MIN_DAYS = 12 * 7;

/** ATO logbook method: a logbook is valid for its first income year plus the following 4. */
export const LOGBOOK_VALID_YEARS = 5;

/**
 * Length of a logbook period in days, counting both the start and end dates.
 *
 * @param startISO first day of the period (YYYY-MM-DD).
 * @param endISO last day of the period (YYYY-MM-DD).
 */
export function logbookPeriodDays(startISO: string, endISO: string): number {
  const start = new Date(startISO + "T00:00:00Z").getTime();
  const end = new Date(endISO + "T00:00:00Z").getTime();
  return Math.round((end - start) / 86400000) + 1;
}

/**
 * The FYs a logbook can be relied on for: the FY in which the logbook period
 * starts, through the 4 following FYs (ATO: "Your logbook is valid for 5 years").
 *
 * @param startISO first day of the logbook period (YYYY-MM-DD).
 * @returns first and last valid FY labels, e.g. { firstFy: "2024-25", lastFy: "2028-29" }.
 */
export function logbookValidity(startISO: string): { firstFy: string; lastFy: string } {
  const firstFy = financialYear(startISO).label;
  const lastStartYear = Number(firstFy.slice(0, 4)) + LOGBOOK_VALID_YEARS - 1;
  return { firstFy, lastFy: financialYear(`${lastStartYear}-07-01`).label };
}

/**
 * Whether a logbook whose period starts on `startISO` is valid for `fyLabel`.
 *
 * @param startISO first day of the logbook period (YYYY-MM-DD).
 * @param fyLabel target FY label, e.g. "2025-26".
 */
export function logbookCoversFy(startISO: string, fyLabel: string): boolean {
  const { firstFy, lastFy } = logbookValidity(startISO);
  return fyLabel >= firstFy && fyLabel <= lastFy;
}
