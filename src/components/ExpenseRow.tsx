"use client";

import { useState } from "react";
import { deleteExpenseAction, updateExpenseAction } from "@/lib/actions";
import { EXPENSE_CATEGORIES, categoryLabel } from "@/lib/expenses/categories";
import { centsToDollars } from "@/lib/logbook/parse";
import { formatMoney, humanDate } from "@/lib/format";
import { FieldError, FormError } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui";
import type { ExpenseRow as ExpenseRowType } from "@/lib/data/expense";

/** Stacked edit form for one expense; `onDone` leaves edit mode (after save or cancel). */
function ExpenseEditForm({ expense, onDone }: { expense: ExpenseRowType; onDone: () => void }) {
  const { state, pending, onSubmit } = useFormSubmit(updateExpenseAction.bind(null, expense.id), { onSuccess: onDone });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form method="post" onSubmit={onSubmit} aria-label={`Edit ${categoryLabel(expense.category)} expense`} className="flex flex-col gap-3 py-3">
      <input type="hidden" name="notes" value={expense.notes ?? ""} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Date</span>
          <input name="date" type="date" defaultValue={expense.date} className={inputCls} />
          <FieldError message={errs.date} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Category</span>
          <select name="category" defaultValue={expense.category} className={inputCls}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <FieldError message={errs.category} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Vendor</span>
          <input name="vendor" defaultValue={expense.vendor ?? ""} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Amount incl GST ($)</span>
          <input name="amountIncl" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={centsToDollars(expense.amountInclCents)} className={`${inputCls} font-mono`} />
          <FieldError message={errs.amountIncl} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>GST ($)</span>
          <input name="gst" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={centsToDollars(expense.gstCents)} className={`${inputCls} font-mono`} />
          <FieldError message={errs.gst} />
        </label>
        <label className="col-span-2 md:col-span-1 flex flex-col gap-1.5">
          <span className={labelCls}>Replace receipt</span>
          <input name="receipt" type="file" accept="image/*" className="min-h-11 text-sm text-muted file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-transparent file:px-3 file:text-ink" />
        </label>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
      </div>
      <FormError message={!state.ok ? state.error : null} />
    </form>
  );
}

/** Edit + Delete (with confirm) buttons for one expense. */
function ExpenseActions({ expense, onEdit }: { expense: ExpenseRowType; onEdit: () => void }) {
  const del = useFormSubmit(deleteExpenseAction, {
    confirmMessage: `Delete this ${categoryLabel(expense.category).toLowerCase()} expense from ${humanDate(expense.date, { withYear: true })}?`,
  });
  return (
    <div className="flex flex-col items-end">
      <div className="flex">
        <button type="button" onClick={onEdit} className={btnGhost}>Edit</button>
        <form method="post" onSubmit={del.onSubmit}>
          <input type="hidden" name="id" value={expense.id} />
          <button type="submit" disabled={del.pending} className={btnDanger}>
            {del.pending ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>
      <FormError message={!del.state.ok ? del.state.error : null} />
    </div>
  );
}

/** "View receipt" link (opens the R2 image in a new tab), or nothing. */
function ReceiptLink({ expense }: { expense: ExpenseRowType }) {
  if (!expense.receiptKey) return null;
  return (
    <a
      href={`/receipt/${expense.receiptKey}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline"
    >
      Receipt
    </a>
  );
}

/**
 * One expense, as a phone card (`variant="card"`, an `<li>`) or a desktop table
 * row (`variant="row"`). Edit swaps in the stacked edit form in place.
 */
export function ExpenseRow({ expense, variant }: { expense: ExpenseRowType; variant: "card" | "row" }) {
  const [editing, setEditing] = useState(false);
  const done = () => setEditing(false);
  const edit = () => setEditing(true);

  if (variant === "card") {
    return (
      <li className="border-b border-rule">
        {editing ? (
          <ExpenseEditForm expense={expense} onDone={done} />
        ) : (
          <div className="flex items-start gap-3 pt-3 pb-1">
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="truncate text-[15px]">{expense.vendor || categoryLabel(expense.category)}</span>
              <span className="text-xs text-muted">
                {humanDate(expense.date, { withYear: true })} · {categoryLabel(expense.category)}
              </span>
              <ReceiptLink expense={expense} />
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-[15px] font-medium">{formatMoney(expense.amountInclCents)}</span>
              <span className="font-mono text-xs text-muted">GST {formatMoney(expense.gstCents)}</span>
              <ExpenseActions expense={expense} onEdit={edit} />
            </div>
          </div>
        )}
      </li>
    );
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={7} className="border-b border-rule px-5">
          <ExpenseEditForm expense={expense} onDone={done} />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="border-b border-rule px-5 py-1.5 whitespace-nowrap text-nav-ink">{humanDate(expense.date, { withYear: true })}</td>
      <td className="border-b border-rule px-3 py-1.5">{categoryLabel(expense.category)}</td>
      <td className="border-b border-rule px-3 py-1.5">{expense.vendor ?? ""}</td>
      <td className="border-b border-rule px-3 py-1.5 text-right font-mono">{formatMoney(expense.amountInclCents)}</td>
      <td className="border-b border-rule px-3 py-1.5 text-right font-mono text-muted">{formatMoney(expense.gstCents)}</td>
      <td className="border-b border-rule px-3 py-1.5"><ReceiptLink expense={expense} /></td>
      <td className="border-b border-rule px-3 py-1.5"><ExpenseActions expense={expense} onEdit={edit} /></td>
    </tr>
  );
}
