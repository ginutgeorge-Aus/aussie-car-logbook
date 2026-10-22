/** ATO ABN checksum weights, one per digit. */
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/** Strips all whitespace (ABNs are usually printed as "51 824 753 556"). */
export function normaliseAbn(raw: string): string {
  return raw.replace(/\s+/g, "");
}

/**
 * ATO ABN check: 11 digits; subtract 1 from the first digit, weight each digit,
 * and the sum must be divisible by 89. Source: https://abr.business.gov.au/Help/AbnFormat
 */
export function isValidAbn(raw: string): boolean {
  const abn = normaliseAbn(raw);
  if (!/^\d{11}$/.test(abn)) return false;
  const digits = abn.split("").map(Number);
  digits[0] -= 1;
  const sum = digits.reduce((s, d, i) => s + d * ABN_WEIGHTS[i], 0);
  return sum % 89 === 0;
}
