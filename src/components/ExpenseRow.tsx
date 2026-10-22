"use client";

import { useState } from "react";
import { deleteExpenseAction, updateExpenseAction } from "@/lib/actions";
import { EXPENSE_CATEGORIES, categoryLabel } from "@/lib/expenses/categories";
import { centsToDollars } from "@/lib/logbook/parse";
import { formatMoney, humanDate } from "@/lib/format";
import { FieldError, FormError, useFieldErrors } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui";
import type { ExpenseRow as ExpenseRowType } from "@/lib/data/expense";
import { isValidAbn } from "@/lib/tax/abn";
import { TAX_INVOICE_BUYER_ID_THRESHOLD_CENTS } from "@/lib/tax/gst";

/** Stacked edit form for one expense; `onDone` leaves edit mode (after save or cancel). */
function ExpenseEditForm({ expense, onDone }: { expense: ExpenseRowType; onDone: () => void }) {
  const { state, pending, onSubmit } = useFormSubmit(updateExpenseAction.bind(null, expense.id), { onSuccess: onDone });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fe = useFieldErrors(errs);
  // Controlled only where the add form's helpers need them: ABN auto-tick and the $1,000 hint.
  const [abn, setAbn] = useState(expense.abn ?? "");
  const [taxInvoice, setTaxInvoice] = useState(expense.taxInvoice);
  const [invoiceTouched, setInvoiceTouched] = useState(false);
  const [amount, setAmount] = useState(centsToDollars(expense.amountInclCents));
  return (
    <form method="post" onSubmit={onSubmit} aria-label={`Edit ${categoryLabel(expense.category)} expense`} className="flex flex-col gap-3 py-3">
      <input type="hidden" name="notes" value={expense.notes ?? ""} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Date</span>
          <input {...fe("date").input} name="date" type="date" defaultValue={expense.date} className={inputCls} />
          <FieldError {...fe("date").error} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Category</span>
          <select {...fe("category").input} name="category" defaultValue={expense.category} className={inputCls}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <FieldError {...fe("category").error} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Vendor</span>
          <input name="vendor" defaultValue={expense.vendor ?? ""} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Seller ABN</span>
          <input
            {...fe("abn").input}
            name="abn"
            inputMode="numeric"
            value={abn}
            onChange={(e) => {
              // Same as the add form: tick when the ABN becomes valid, unless the box was set by hand.
              if (!invoiceTouched && isValidAbn(e.target.value) && !isValidAbn(abn)) setTaxInvoice(true);
              setAbn(e.target.value);
            }}
            className={`${inputCls} font-mono`}
          />
          <FieldError {...fe("abn").error} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Amount incl GST ($)</span>
          <input {...fe("amountIncl").input} name="amountIncl" type="number" step="0.01" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} font-mono`} />
          <FieldError {...fe("amountIncl").error} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>GST ($)</span>
          <input {...fe("gst").input} name="gst" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={centsToDollars(expense.gstCents)} className={`${inputCls} font-mono`} />
          <FieldError {...fe("gst").error} />
        </label>
        <label className="col-span-2 md:col-span-1 flex min-h-11 cursor-pointer items-center gap-3">
          <input name="taxInvoice" type="checkbox" checked={taxInvoice} onChange={(e) => { setTaxInvoice(e.target.checked); setInvoiceTouched(true); }} className="size-5 accent-[var(--accent)]" />
          <span className="text-[15px]">Tax invoice held</span>
        </label>
        {Math.round(Number(amount) * 100) >= TAX_INVOICE_BUYER_ID_THRESHOLD_CENTS ? (
          <p className="col-span-2 md:col-span-3 text-sm text-muted">Tax invoice must also show your name or ABN.</p>
        ) : null}
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
