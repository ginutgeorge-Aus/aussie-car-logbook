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

/** The dates of a logbook period, plus the income year the taxpayer nominated it for (if any). */
export type LogbookPeriodDates = { startDate: string; endDate: string; nominatedFy?: string | null };

/**
 * FYs a logbook period can be nominated for: the FY it starts in, plus the FY
 * it ends in when it crosses 30 June.
 *
 * @param period the logbook period's start and end dates (YYYY-MM-DD).
 */
export function logbookNominableFys(period: LogbookPeriodDates): string[] {
  const startFy = financialYear(period.startDate).label;
  const endFy = financialYear(period.endDate).label;
  return startFy === endFy ? [startFy] : [startFy, endFy];
}

/**
 * The income year a logbook is for: its nominated FY when that is one the
 * period touches (a 12-week period crossing 30 June may be nominated for either
 * year), else the FY the period starts in.
 *
 * @param period the logbook period, with its optional nominated FY.
 */
export function logbookFirstFy(period: LogbookPeriodDates): string {
  const options = logbookNominableFys(period);
  return period.nominatedFy && options.includes(period.nominatedFy) ? period.nominatedFy : options[0];
}

/**
 * The FYs a logbook can be relied on for: the income year it is for (see
 * `logbookFirstFy`) through the 4 following FYs (ATO: "Your logbook is valid for 5 years").
 *
 * @param period the logbook period, with its optional nominated FY.
 * @returns first and last valid FY labels, e.g. { firstFy: "2024-25", lastFy: "2028-29" }.
 */
export function logbookValidity(period: LogbookPeriodDates): { firstFy: string; lastFy: string } {
  const firstFy = logbookFirstFy(period);
  const lastStartYear = Number(firstFy.slice(0, 4)) + LOGBOOK_VALID_YEARS - 1;
  return { firstFy, lastFy: financialYear(`${lastStartYear}-07-01`).label };
}

/**
 * Whether a logbook period is valid for `fyLabel`.
 *
 * @param period the logbook period, with its optional nominated FY.
 * @param fyLabel target FY label, e.g. "2025-26".
 */
export function logbookCoversFy(period: LogbookPeriodDates, fyLabel: string): boolean {
  const { firstFy, lastFy } = logbookValidity(period);
  return fyLabel >= firstFy && fyLabel <= lastFy;
}
