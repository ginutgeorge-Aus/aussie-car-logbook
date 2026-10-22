import { dollarsToCents } from "@/lib/logbook/parse";
import { gstFromInclusive, isValidAbn, normaliseAbn } from "@/lib/tax";
import { isExpenseCategory } from "@/lib/expenses/categories";
import type { ExpenseCategory } from "@/lib/tax/types";
import type { ParseResult } from "@/lib/logbook/types";

/** Slack over 1/11 for invoices that round GST per line (ATO taxable-sale rounding rule). */
const GST_LINE_ROUNDING_CENTS = 5;

export type ExpenseInput = {
  date: string;
  category: ExpenseCategory;
  amountInclCents: number;
  gstCents: number;
  vendor: string | null;
  abn: string | null;
  taxInvoice: boolean;
  notes: string | null;
};

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}

/**
 * GST for an expense: 0 when GST-free; 1/11 of the amount when left blank; a typed
 * GST must not exceed 1/11 of the amount (skipped when the amount itself is invalid).
 */
function parseGst(
  gstRaw: string,
  gstFree: boolean,
  amountInclCents: number,
  amountInvalid: boolean,
): { gstCents: number; error?: string } {
  if (gstFree) return { gstCents: 0 };
  if (gstRaw === "") return { gstCents: gstFromInclusive(amountInclCents) };
  let gstCents: number;
  try {
    gstCents = dollarsToCents(gstRaw);
  } catch {
    return { gstCents: 0, error: "Enter a valid GST amount." };
  }
  // GST is at most 1/11 of a GST-inclusive amount (rounded to the cent, as gstFromInclusive does),
  // plus a few cents: the ATO rounding rule lets invoices round GST per line, which can sum higher.
  // Never more than the amount itself, so the GST-exclusive amount can't go negative.
  const maxGst = Math.min(gstFromInclusive(amountInclCents) + GST_LINE_ROUNDING_CENTS, amountInclCents);
  if (!amountInvalid && gstCents > maxGst) return { gstCents, error: "GST can't be more than 1/11 of the amount." };
  return { gstCents };
}

/** Optional seller ABN: blank → null; otherwise normalised and checksum-validated. */
function parseAbn(raw: string): { abn: string | null; error?: string } {
  const abn = normaliseAbn(raw);
  if (!abn) return { abn: null };
  return isValidAbn(abn) ? { abn } : { abn, error: "Enter a valid 11-digit ABN." };
}

/**
 * Parses the expense form: date, a user-enterable category, a positive amount
 * and GST (defaults to 1/11 of the amount; 0 when GST-free; a typed GST must not
 * exceed 1/11 of the amount), an optional seller ABN (checksum-validated) and
 * a tax-invoice flag.
 */
export function parseExpenseForm(fd: FormData): ParseResult<ExpenseInput> {
  const errors: Record<string, string> = {};

  const date = str(fd, "date");
  if (!date) errors.date = "Date is required.";

  const category = str(fd, "category");
  if (!isExpenseCategory(category)) errors.category = "Choose a category.";

  let amountInclCents = 0;
  const amountRaw = str(fd, "amountIncl");
  try {
    amountInclCents = dollarsToCents(amountRaw);
    if (amountInclCents <= 0) errors.amountIncl = "Amount must be greater than 0.";
  } catch {
    errors.amountIncl = "Enter a valid dollar amount.";
  }

  const gst = parseGst(str(fd, "gst"), str(fd, "gstFree") === "on", amountInclCents, !!errors.amountIncl);
  const gstCents = gst.gstCents;
  if (gst.error) errors.gst = gst.error;

  const vendor = str(fd, "vendor") || null;
  const { abn, error: abnError } = parseAbn(str(fd, "abn"));
  if (abnError) errors.abn = abnError;
  const taxInvoice = str(fd, "taxInvoice") === "on";
  const notes = str(fd, "notes") || null;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { date, category: category as ExpenseCategory, amountInclCents, gstCents, vendor, abn, taxInvoice, notes },
  };
}
