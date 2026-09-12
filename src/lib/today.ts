/**
 * Today's date as ISO `YYYY-MM-DD` in Australian time.
 *
 * UI-edge helper (not pure — reads "now"), so it lives outside `src/lib/tax`.
 * `en-CA` formats as `YYYY-MM-DD`; the `Australia/Sydney` timeZone stops the
 * FY-boundary bug where `new Date().toISOString()` (UTC) reads 30 Jun for the
 * first ~10-14h of 1 Jul AEST and picks the wrong default financial year.
 */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}
