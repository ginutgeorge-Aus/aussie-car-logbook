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

  const gstFree = str(fd, "gstFree") === "on";
  let gstCents = 0;
  const gstRaw = str(fd, "gst");
  if (!gstFree) {
    if (gstRaw === "") {
      gstCents = gstFromInclusive(amountInclCents);
    } else {
      try {
        gstCents = dollarsToCents(gstRaw);
      } catch {
        errors.gst = "Enter a valid GST amount.";
      }
    }
    // GST is at most 1/11 of a GST-inclusive amount (rounded to the cent, as gstFromInclusive does),
    // plus a few cents: the ATO rounding rule lets invoices round GST per line, which can sum higher.
    // Never more than the amount itself, so the GST-exclusive amount can't go negative.
    const maxGst = Math.min(gstFromInclusive(amountInclCents) + GST_LINE_ROUNDING_CENTS, amountInclCents);
    if (!errors.gst && !errors.amountIncl && gstCents > maxGst) {
      errors.gst = "GST can't be more than 1/11 of the amount.";
    }
  }

  const vendor = str(fd, "vendor") || null;
  const abnRaw = normaliseAbn(str(fd, "abn"));
  if (abnRaw && !isValidAbn(abnRaw)) errors.abn = "Enter a valid 11-digit ABN.";
  const abn = abnRaw || null;
  const taxInvoice = str(fd, "taxInvoice") === "on";
  const notes = str(fd, "notes") || null;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { date, category: category as ExpenseCategory, amountInclCents, gstCents, vendor, abn, taxInvoice, notes },
  };
}
