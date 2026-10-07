import type { ParseResult } from "@/lib/logbook/types";

/** App-wide settings the user can edit on /settings. */
export type SettingsInput = {
  gstRegistered: boolean;
  /** Normalised "XX XXX XXX XXX", or null when cleared. */
  abn: string | null;
};

const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/**
 * Checks an 11-digit ABN against the official ATO checksum: subtract 1 from the
 * first digit, weight each digit (10,1,3,5,7,9,11,13,15,17,19), and the sum must
 * be divisible by 89. Input must be digits only (strip spaces first).
 */
export function isValidAbn(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  const sum = ABN_WEIGHTS.reduce((acc, w, i) => {
    const d = Number(digits[i]) - (i === 0 ? 1 : 0);
    return acc + d * w;
  }, 0);
  return sum % 89 === 0;
}

/** Formats 11 ABN digits as the conventional "XX XXX XXX XXX". */
export function formatAbn(digits: string): string {
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}

/**
 * Parses the /settings form. `gstRegistered` is a checkbox (present = true).
 * `abn` is optional: whitespace is stripped, empty clears it to null, otherwise
 * it must be 11 digits passing the ATO checksum and is stored normalised.
 */
export function parseSettingsForm(fd: FormData): ParseResult<SettingsInput> {
  const errors: Record<string, string> = {};
  const gstRegistered = fd.get("gstRegistered") !== null;

  const abnDigits = (fd.get("abn") ?? "").toString().replace(/\s+/g, "");
  let abn: string | null = null;
  if (abnDigits !== "") {
    if (!/^\d{11}$/.test(abnDigits)) errors.abn = "ABN must be 11 digits.";
    else if (!isValidAbn(abnDigits)) errors.abn = "That ABN isn't valid — check the digits.";
    else abn = formatAbn(abnDigits);
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { gstRegistered, abn } };
}
