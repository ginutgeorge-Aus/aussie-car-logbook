import { financialYear, gstFromInclusive, LOGBOOK_MIN_DAYS, logbookNominableFys, logbookPeriodDays } from "@/lib/tax";
import type { ParseResult } from "@/lib/logbook/types";

/** Plain non-negative decimal: digits with an optional fraction ("12", "12.5", ".5", "12."). */
const DECIMAL_RE = /^(\d+\.?\d*|\.\d+)$/;

/** Slack over 1/11 of the cost for invoices that round GST line by line. */
const PURCHASE_GST_ROUNDING_SLACK_CENTS = 100;

/**
 * Most GST a purchase tax invoice can show: 1/11 of the GST-inclusive cost,
 * plus a $1 slack for per-line rounding on multi-line invoices.
 *
 * @param costCents GST-inclusive purchase cost (cents).
 */
export function maxPurchaseGstCents(costCents: number): number {
  return gstFromInclusive(costCents) + PURCHASE_GST_ROUNDING_SLACK_CENTS;
}

/**
 * Converts a dollar string to integer cents, rounding half-up on the third
 * decimal. Only plain decimals are accepted — `Number()` forms such as "1e3",
 * "0x10", "Infinity", signs, spaces or thousands separators throw. Parsing is
 * done on the digits, so there is no floating-point error (1.005 -> 101).
 *
 * @throws RangeError for anything that is not a plain non-negative decimal.
 */
export function dollarsToCents(input: string): number {
  if (!DECIMAL_RE.test(input)) throw new RangeError(`Invalid dollar amount: ${input}`);
  const [whole, frac = ""] = input.split(".");
  const padded = (frac + "000").slice(0, 3);
  const cents = Number(whole || "0") * 100 + Number(padded.slice(0, 2)) + (Number(padded[2]) >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Invalid dollar amount: ${input}`);
  return cents;
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}

function optInt(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

export function parseVehicleForm(
  fd: FormData,
): ParseResult<{
  make: string;
  model: string;
  rego: string | null;
  odoOpen: number | null;
  purchaseDate: string | null;
  purchaseCostCents: number | null;
  purchaseGstCents: number | null;
}> {
  const errors: Record<string, string> = {};
  const make = str(fd, "make");
  const model = str(fd, "model");
  const rego = str(fd, "rego") || null;
  if (!make) errors.make = "Make is required.";
  if (!model) errors.model = "Model is required.";

  const odoOpenRaw = str(fd, "odoOpen");
  const odoOpen = optInt(odoOpenRaw);
  if (Number.isNaN(odoOpen) || (odoOpen !== null && odoOpen < 0)) errors.odoOpen = "Odometer must be a whole number ≥ 0.";

  const purchaseDate = str(fd, "purchaseDate") || null;
  const costRaw = str(fd, "purchaseCost");
  let purchaseCostCents: number | null = null;
  if (costRaw !== "") {
    try {
      purchaseCostCents = dollarsToCents(costRaw);
    } catch {
      errors.purchaseCost = "Enter a valid dollar amount.";
    }
  }
  const gstRaw = str(fd, "purchaseGst");
  let purchaseGstCents: number | null = null;
  if (gstRaw !== "") {
    try {
      purchaseGstCents = dollarsToCents(gstRaw);
    } catch {
      errors.purchaseGst = "Enter a valid dollar amount.";
    }
    if (purchaseGstCents !== null && !errors.purchaseCost) {
      if (purchaseCostCents === null) errors.purchaseGst = "Enter the purchase cost too.";
      else if (purchaseGstCents > maxPurchaseGstCents(purchaseCostCents)) {
        errors.purchaseGst = "GST can't be more than 1/11 of the purchase cost.";
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { make, model, rego, odoOpen: odoOpen ?? null, purchaseDate, purchaseCostCents, purchaseGstCents },
  };
}

/**
 * Parses the trip form. ATO: each business journey must show the dates it began
 * and ended, the odometer readings, the km travelled and the reason for it, so a
 * business trip needs a non-blank `purpose`; `endDate` is optional (blank or the
 * same day as `date` -> null).
 * Source: https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses
 */
export function parseTripForm(
  fd: FormData,
): ParseResult<{ date: string; endDate: string | null; odoStart: number; odoEnd: number; purpose: string | null; isBusiness: boolean }> {
  const errors: Record<string, string> = {};
  const date = str(fd, "date");
  if (!date) errors.date = "Date is required.";

  const odoStart = optInt(str(fd, "odoStart"));
  const odoEnd = optInt(str(fd, "odoEnd"));
  if (odoStart === null || Number.isNaN(odoStart) || odoStart < 0) errors.odoStart = "Start odometer must be a whole number ≥ 0.";
  if (odoEnd === null || Number.isNaN(odoEnd) || odoEnd < 0) errors.odoEnd = "End odometer must be a whole number ≥ 0.";
  if (!errors.odoStart && !errors.odoEnd && (odoEnd as number) <= (odoStart as number)) {
    errors.odoEnd = "End odometer must be greater than start.";
  }

  const purpose = str(fd, "purpose") || null;
  const isBusiness = str(fd, "isBusiness") === "on";
  // ATO: each business journey needs its reason.
  if (isBusiness && !purpose) errors.purpose = "Enter the reason for this business trip (ATO requirement).";

  // Optional end date (multi-day journey); same day as the start is stored as null.
  const endRaw = str(fd, "endDate");
  let endDate: string | null = null;
  if (endRaw) {
    if (!isIsoDate(endRaw)) errors.endDate = "Enter a valid end date.";
    else if (date && endRaw < date) errors.endDate = "End date can't be before the trip date.";
    else if (endRaw !== date) endDate = endRaw;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { date, endDate, odoStart: odoStart as number, odoEnd: odoEnd as number, purpose, isBusiness } };
}

/**
 * Whether `value` is a real calendar date in strict ISO `YYYY-MM-DD` form
 * (rejects e.g. "2024-02-30" and "2024-13-01").
 */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Parses the period odometer fields: both required non-negative whole km,
 * end above start. The ATO logbook must show the odometer at the start and end
 * of the period; total km = end − start.
 * Source: https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses
 */
export function parsePeriodOdometers(fd: FormData, errors: Record<string, string>): { odoStart: number; odoEnd: number } {
  const odoStart = optInt(str(fd, "odoStart"));
  const odoEnd = optInt(str(fd, "odoEnd"));
  if (odoStart === null || Number.isNaN(odoStart) || odoStart < 0) errors.odoStart = "Enter the odometer at the start of the logbook (whole km).";
  if (odoEnd === null || Number.isNaN(odoEnd) || odoEnd < 0) errors.odoEnd = "Enter the odometer at the end of the logbook (whole km).";
  if (!errors.odoStart && !errors.odoEnd && (odoEnd as number) <= (odoStart as number)) {
    errors.odoEnd = "End odometer must be higher than the start odometer.";
  }
  return { odoStart: odoStart as number, odoEnd: odoEnd as number };
}

/** Parses the form that sets odometer readings on an existing logbook period. */
export function parseLogbookPeriodOdometerForm(fd: FormData): ParseResult<{ odoStart: number; odoEnd: number }> {
  const errors: Record<string, string> = {};
  const value = parsePeriodOdometers(fd, errors);
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value };
}

/**
 * Parses the logbook-period form: start and end dates are required, must be
 * real ISO dates, end must not precede start, and the period must cover at
 * least 12 continuous weeks (ATO logbook method). Start/end odometer readings
 * are required too (see `parsePeriodOdometers`).
 */
export function parseLogbookPeriodForm(
  fd: FormData,
): ParseResult<{ startDate: string; endDate: string; nominatedFy: string | null; odoStart: number; odoEnd: number }> {
  const errors: Record<string, string> = {};
  const startDate = str(fd, "startDate");
  const endDate = str(fd, "endDate");
  if (!isIsoDate(startDate)) errors.startDate = "Enter a valid start date.";
  if (!isIsoDate(endDate)) errors.endDate = "Enter a valid end date.";
  if (!errors.startDate && !errors.endDate) {
    if (endDate < startDate) errors.endDate = "End date must be on or after the start date.";
    else if (logbookPeriodDays(startDate, endDate) < LOGBOOK_MIN_DAYS) {
      errors.endDate = "A logbook period must cover at least 12 continuous weeks (84 days).";
    }
  }
  // Only a period crossing 30 June has a choice of income year; otherwise it's the FY it's in.
  let nominatedFy: string | null = null;
  const nominatedRaw = str(fd, "nominatedFy");
  if (!errors.startDate && !errors.endDate && nominatedRaw !== "") {
    const options = logbookNominableFys({ startDate, endDate });
    if (!options.includes(nominatedRaw)) errors.nominatedFy = "Choose the FY the logbook starts or ends in.";
    else if (options.length > 1) nominatedFy = nominatedRaw;
  }
  const { odoStart, odoEnd } = parsePeriodOdometers(fd, errors);
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { startDate, endDate, nominatedFy, odoStart, odoEnd } };
}

/** Whether `label` is a well-formed income-year label ("YYYY-YY", second part = the following year). */
export function isFyLabel(label: string): boolean {
  return /^\d{4}-\d{2}$/.test(label) && financialYear(`${label.slice(0, 4)}-07-01`).label === label;
}

/**
 * Parses the yearly odometer form: a valid FY label plus optional readings at
 * the start (1 July) and end (30 June) of that year, each a non-negative whole
 * km, with the closing reading not below the opening one. The ATO wants both
 * readings for every income year a logbook is relied on.
 * Source: https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses
 */
export function parseVehicleFyOdometerForm(
  fd: FormData,
): ParseResult<{ fyLabel: string; odoOpen: number | null; odoClose: number | null }> {
  const errors: Record<string, string> = {};
  const fyLabel = str(fd, "fyLabel");
  if (!isFyLabel(fyLabel)) errors.fyLabel = "Choose a valid financial year.";
  const odoOpen = optInt(str(fd, "odoOpen"));
  const odoClose = optInt(str(fd, "odoClose"));
  if (Number.isNaN(odoOpen) || (odoOpen !== null && odoOpen < 0)) errors.odoOpen = "Odometer must be a whole number ≥ 0.";
  if (Number.isNaN(odoClose) || (odoClose !== null && odoClose < 0)) errors.odoClose = "Odometer must be a whole number ≥ 0.";
  if (!errors.odoOpen && !errors.odoClose && odoOpen !== null && odoClose !== null && odoClose < odoOpen) {
    errors.odoClose = "End-of-year odometer can't be below the start-of-year reading.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { fyLabel, odoOpen: odoOpen as number | null, odoClose: odoClose as number | null } };
}
