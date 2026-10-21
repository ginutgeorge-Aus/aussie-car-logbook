import {
  businessPct,
  businessPctRounded,
  financialYear,
  LOGBOOK_MIN_DAYS,
  logbookCoversFy,
  logbookPeriodDays,
  logbookValidity,
} from "@/lib/tax";
import type { LogbookPeriodRow, TripLeg, TripRow } from "@/lib/logbook/types";

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
 * Trip legs of the period's vehicle dated within the logbook period (inclusive).
 *
 * @param trips all trips.
 * @param period the logbook period.
 */
function logbookPeriodLegs(
  trips: Pick<TripRow, "vehicleId" | "date" | "odoStart" | "odoEnd" | "isBusiness">[],
  period: LogbookPeriodRow,
): TripLeg[] {
  return tripsToLegs(
    trips.filter((t) => t.vehicleId === period.vehicleId && t.date >= period.startDate && t.date <= period.endDate),
  );
}

/**
 * Rounded business-use % measured by one logbook period, or null when no
 * kilometres were recorded inside it.
 *
 * @param trips all trips.
 * @param period the logbook period.
 */
export function logbookPeriodBusinessPct(
  trips: Pick<TripRow, "vehicleId" | "date" | "odoStart" | "odoEnd" | "isBusiness">[],
  period: LogbookPeriodRow,
): number | null {
  const legs = logbookPeriodLegs(trips, period);
  if (legs.reduce((s, l) => s + l.km, 0) === 0) return null;
  return businessPctRounded(legs);
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
  trips: Pick<TripRow, "vehicleId" | "date" | "odoStart" | "odoEnd" | "isBusiness">[];
  periods: LogbookPeriodRow[];
  fyLabel: string;
  today: string;
}): { ratio: number; source: BusinessUseSource; notices: string[] } {
  const { trips, periods, fyLabel, today } = input;
  const notices: string[] = [];

  const candidates = periods
    .filter((p) => logbookPeriodDays(p.startDate, p.endDate) >= LOGBOOK_MIN_DAYS && logbookCoversFy(p.startDate, fyLabel))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : b.id - a.id));

  for (const p of candidates) {
    if (p.endDate > today) {
      notices.push(`Logbook period ${p.startDate} to ${p.endDate} hasn't finished yet — it's used once it ends.`);
      continue;
    }
    const legs = logbookPeriodLegs(trips, p);
    if (legs.reduce((s, l) => s + l.km, 0) === 0) {
      notices.push(`Logbook period ${p.startDate} to ${p.endDate} has no trips recorded — it was ignored.`);
      continue;
    }
    const { firstFy, lastFy } = logbookValidity(p.startDate);
    return {
      ratio: businessPct(legs),
      source: { kind: "logbook", periodId: p.id, startDate: p.startDate, endDate: p.endDate, firstFy, lastFy },
      notices,
    };
  }

  notices.push(
    `No valid logbook period covers FY ${fyLabel}, so business use is estimated from all trips recorded in FY ${fyLabel}. ` +
      "The ATO logbook method needs a logbook kept for at least 12 continuous weeks (valid for 5 years) — add one on the Trips page.",
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
    const { firstFy, lastFy } = logbookValidity(p.startDate);
    for (let y = Number(firstFy.slice(0, 4)); y <= Number(lastFy.slice(0, 4)); y++) {
      const label = financialYear(`${y}-07-01`).label;
      if (label <= currentFy) labels.add(label);
    }
  }
  return [...labels].sort().reverse();
}
