/**
 * Display formatters for the UI edge. Pure and timezone-free: dates are parsed
 * from the stored `YYYY-MM-DD` text and resolved with UTC maths, so a server in
 * UTC and a phone in Sydney always render the same calendar day.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats an ISO date as "Tue 14 Sep" (optionally "Tue 14 Sep 2026").
 * Returns the input unchanged if it is not `YYYY-MM-DD`.
 */
export function humanDate(iso: string, { withYear = false }: { withYear?: boolean } = {}): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const base = `${weekday} ${d} ${MONTHS[mo - 1]}`;
  return withYear ? `${base} ${y}` : base;
}

/** Inserts thousands separators into a non-negative integer. */
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Formats integer cents as "$4,812.40" (negative as "-$25.50"). */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  return `${sign}$${group(dollars)}.${rem}`;
}

/** Formats integer cents rounded to whole dollars, e.g. "$4,812" — for tight phone tiles. */
export function formatMoneyWhole(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${group(Math.round(Math.abs(cents) / 100))}`;
}

/** Formats a kilometre count with thousands separators, e.g. "84,312". */
export function formatKm(km: number): string {
  return km < 0 ? `-${group(-km)}` : group(km);
}

/** Splits an odometer reading into digits, zero-padded to at least six. */
export function odometerDigits(km: number): string[] {
  return String(Math.max(0, Math.trunc(km))).padStart(6, "0").split("");
}

/** Shortens an FY label "2026-27" to "26–27" for the FY chip. */
export function fyShort(fyLabel: string): string {
  const m = /^\d{2}(\d{2})-(\d{2})$/.exec(fyLabel);
  return m ? `${m[1]}–${m[2]}` : fyLabel;
}
