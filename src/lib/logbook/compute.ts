import {
  businessPct,
  businessPctBps,
  financialYear,
  LOGBOOK_MIN_DAYS,
  logbookCoversFy,
  logbookPeriodDays,
  logbookValidity,
} from "@/lib/tax";
import type { LogbookPeriodRow, TripLeg, TripRow, VehicleFyOdometerRow } from "@/lib/logbook/types";

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

/**
 * Business trips with no reason recorded — the ATO needs the reason for every
 * business journey.
 * Source: https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses
 */
export function businessTripsMissingPurpose<T extends Pick<TripRow, "purpose" | "isBusiness">>(trips: T[]): T[] {
  return trips.filter((t) => t.isBusiness && !t.purpose?.trim());
}

type PeriodTrip = Pick<TripRow, "vehicleId" | "date" | "odoStart" | "odoEnd" | "isBusiness">;

/** Km a logbook period measures, or why it can't set business use (`no-trips` = nothing recorded in it, not an odometer error). */
export type LogbookPeriodUse =
  | { ok: true; businessKm: number; totalKm: number }
  | { ok: false; kind: "no-trips" | "invalid"; reason: string };

/**
 * Business use measured by one logbook period under the ATO rule: business km
 * (that vehicle's business trips dated within the period) over total km, where
 * total km = odometer at the end of the period minus odometer at the start —
 * NOT the sum of logged trips, since unlogged private trips would otherwise
 * overstate business use. A period is unusable when its odometer readings are
 * missing or not increasing, or a logged trip falls outside them or overlaps another.
 * Source: https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses
 *
 * @param trips all trips.
 * @param period the logbook period (with its odometer readings).
 */
export function logbookPeriodUse(trips: PeriodTrip[], period: LogbookPeriodRow): LogbookPeriodUse {
  const invalid = (reason: string): LogbookPeriodUse => ({ ok: false, kind: "invalid", reason });
  const { odoStart, odoEnd } = period;
  if (odoStart == null || odoEnd == null) {
    return invalid("odometer readings are missing — add them on the Trips page");
  }
  if (odoEnd <= odoStart) {
    return invalid("the end odometer must be higher than the start odometer — fix them on the Trips page");
  }
  const inPeriod = trips.filter((t) => t.vehicleId === period.vehicleId && t.date >= period.startDate && t.date <= period.endDate);
  if (inPeriod.reduce((s, t) => s + tripKm(t), 0) === 0) return { ok: false, kind: "no-trips", reason: "no trips recorded" };
  if (inPeriod.some((t) => t.odoStart < odoStart || t.odoEnd > odoEnd)) {
    return invalid("a trip in it falls outside the period's odometer readings — fix the readings on the Trips page");
  }
  // One car can't cover the same km twice: overlapping trips would double-count business km.
  const byOdo = [...inPeriod].sort((a, b) => a.odoStart - b.odoStart);
  if (byOdo.some((t, i) => i > 0 && t.odoStart < byOdo[i - 1].odoEnd)) {
    return invalid("two trips in it overlap on the odometer — fix the trips' odometer readings");
  }
  // Every trip lies within the readings and none overlap, so businessKm ≤ totalKm.
  const totalKm = odoEnd - odoStart;
  const businessKm = inPeriod.filter((t) => t.isBusiness).reduce((s, t) => s + tripKm(t), 0);
  return { ok: true, businessKm, totalKm };
}

/**
 * Business use measured by one logbook period, in basis points (see
 * `businessPctBps`), or null when the period is unusable (see
 * `logbookPeriodUse`) or has no trips recorded.
 *
 * @param trips all trips.
 * @param period the logbook period.
 */
export function logbookPeriodBusinessPctBps(trips: PeriodTrip[], period: LogbookPeriodRow): number | null {
  const use = logbookPeriodUse(trips, period);
  if (!use.ok) return null;
  return businessPctBps(use.businessKm / use.totalKm);
}

/** Where a report's business-use % came from. */
export type BusinessUseSource =
  | { kind: "logbook"; periodId: number; startDate: string; endDate: string; firstFy: string; lastFy: string }
  | { kind: "fy-trips" };

/**
 * Business-use ratio for an FY under the ATO logbook method.
 *
 * Uses the most recent logbook period (latest start date) that is at least
 * 12 continuous weeks long, has ended (end date on or before `today`), is valid
 * for `fyLabel` (its first FY or one of the following 4) and has trips recorded
 * in it; the ratio is businessKm/totalKm
 * of that vehicle's trips dated within the period. A period with no trips is
 * skipped with a notice, as is one still in progress. Only when no valid logbook exists does it fall back to
 * all trips recorded in the FY, with a notice saying so.
 *
 * @param input all trips, all logbook periods, the target FY label and today's date (YYYY-MM-DD).
 * @returns the ratio (0..1), its source, and notices to show on the report.
 */
export function resolveBusinessUse(input: {
  trips: PeriodTrip[];
  periods: LogbookPeriodRow[];
  fyLabel: string;
  today: string;
}): { ratio: number; source: BusinessUseSource; notices: string[] } {
  const { trips, periods, fyLabel, today } = input;
  const notices: string[] = [];

  const candidates = periods
    .filter((p) => logbookPeriodDays(p.startDate, p.endDate) >= LOGBOOK_MIN_DAYS && logbookCoversFy(p, fyLabel))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : b.id - a.id));

  for (const p of candidates) {
    if (p.endDate > today) {
      notices.push(`Logbook period ${p.startDate} to ${p.endDate} hasn't finished yet — it's used once it ends.`);
      continue;
    }
    const use = logbookPeriodUse(trips, p);
    if (!use.ok) {
      notices.push(`Logbook period ${p.startDate} to ${p.endDate}: ${use.reason} — it was ignored.`);
      continue;
    }
    const { firstFy, lastFy } = logbookValidity(p);
    return {
      ratio: use.businessKm / use.totalKm,
      source: { kind: "logbook", periodId: p.id, startDate: p.startDate, endDate: p.endDate, firstFy, lastFy },
      notices,
    };
  }

  notices.push(
    `No valid logbook period covers FY ${fyLabel}, so business use is estimated from all trips recorded in FY ${fyLabel} ` +
      "and used for BAS GST credits only. The ATO logbook method needs a logbook kept for at least 12 continuous weeks (valid for 5 years).",
  );
  return { ratio: businessPct(tripsToLegs(filterTripsByFy(trips, fyLabel))), source: { kind: "fy-trips" }, notices };
}

/**
 * FY labels a logbook makes reportable: every FY each 12-week-plus period is
 * valid for, up to and including `currentFy`, newest first.
 *
 * @param periods all logbook periods.
 * @param currentFy the current FY label; later FYs are left out.
 */
export function logbookFyLabels(periods: LogbookPeriodRow[], currentFy: string): string[] {
  const labels = new Set<string>();
  for (const p of periods) {
    if (logbookPeriodDays(p.startDate, p.endDate) < LOGBOOK_MIN_DAYS) continue;
    const { firstFy, lastFy } = logbookValidity(p);
    for (let y = Number(firstFy.slice(0, 4)); y <= Number(lastFy.slice(0, 4)); y++) {
      const label = financialYear(`${y}-07-01`).label;
      if (label <= currentFy) labels.add(label);
    }
  }
  return [...labels].sort((a, b) => b.localeCompare(a));
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

/**
 * Which odometer readings an income year still lacks. The ATO wants the
 * reading at the start (1 July) and end (30 June) of each year a logbook is
 * relied on. A reading can't exist before its date, so the opening one is only
 * missing once the FY has started and the closing one once it has ended.
 * Source: https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses
 *
 * @param rows saved yearly readings.
 * @param fyLabel income year to check, e.g. "2025-26".
 * @param today ISO date the caller treats as now.
 * @returns `open` / `close` flags; both false when nothing is missing.
 */
export function missingFyOdometers(
  rows: Pick<VehicleFyOdometerRow, "fyLabel" | "odoOpen" | "odoClose">[],
  fyLabel: string,
  today: string,
): { open: boolean; close: boolean } {
  const row = rows.find((r) => r.fyLabel === fyLabel);
  const { startISO, endISO } = financialYear(`${fyLabel.slice(0, 4)}-07-01`);
  return {
    open: today >= startISO && row?.odoOpen == null,
    close: today > endISO && row?.odoClose == null,
  };
}
