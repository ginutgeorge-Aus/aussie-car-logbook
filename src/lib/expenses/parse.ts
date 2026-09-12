import { dollarsToCents } from "@/lib/logbook/parse";
import { gstFromInclusive } from "@/lib/tax";
import { isExpenseCategory } from "@/lib/expenses/categories";
import type { ExpenseCategory } from "@/lib/tax/types";
import type { ParseResult } from "@/lib/logbook/types";

export type ExpenseInput = {
  date: string;
  category: ExpenseCategory;
  amountInclCents: number;
  gstCents: number;
  vendor: string | null;
  notes: string | null;
};

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}

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
    if (!errors.gst && !errors.amountIncl) {
      if (gstCents < 0) errors.gst = "GST cannot be negative.";
      else if (gstCents > amountInclCents) gstCents = amountInclCents; // clamp
    }
  }

  const vendor = str(fd, "vendor") || null;
  const notes = str(fd, "notes") || null;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { date, category: category as ExpenseCategory, amountInclCents, gstCents, vendor, notes },
  };
}
