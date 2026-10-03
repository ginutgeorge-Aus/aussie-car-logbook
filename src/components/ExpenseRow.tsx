"use client";

import { useState } from "react";
import { deleteExpenseAction, updateExpenseAction } from "@/lib/actions";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import { centsToDollars } from "@/lib/logbook/parse";
import { FieldError } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import type { ExpenseRow as ExpenseRowType } from "@/lib/data/expense";

function label(code: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.code === code)?.label ?? code;
}

export function ExpenseRow({ expense }: { expense: ExpenseRowType }) {
  const [editing, setEditing] = useState(false);
  const { state, pending, onSubmit } = useFormSubmit(updateExpenseAction.bind(null, expense.id), {
    onSuccess: () => setEditing(false),
  });
  const del = useFormSubmit(deleteExpenseAction, {
    confirmMessage: `Delete this ${label(expense.category).toLowerCase()} expense from ${expense.date}?`,
  });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fid = `edit-exp-${expense.id}`;

  if (!editing) {
    return (
      <tr className="border-b">
        <td className="py-2 pr-4">{expense.date}</td>
        <td className="py-2 pr-4">{label(expense.category)}</td>
        <td className="py-2 pr-4">${centsToDollars(expense.amountInclCents)}</td>
        <td className="py-2 pr-4">${centsToDollars(expense.gstCents)}</td>
        <td className="py-2 pr-4">{expense.vendor ?? ""}</td>
        <td className="py-2 pr-4">
          {expense.receiptKey ? (
            <a href={`/receipt/${expense.receiptKey}`} target="_blank" rel="noreferrer" className="text-sm underline">View</a>
          ) : ""}
        </td>
        <td className="py-2 flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-sm underline">Edit</button>
          <form onSubmit={del.onSubmit}>
            <input type="hidden" name="id" value={expense.id} />
            <button type="submit" disabled={del.pending} className="text-sm text-red-600 underline disabled:opacity-50">
              {del.pending ? "Deleting…" : "Delete"}
            </button>
          </form>
          {!del.state.ok && del.state.error ? <p className="text-sm text-red-600">{del.state.error}</p> : null}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-4">
        <input name="date" type="date" form={fid} defaultValue={expense.date} className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </td>
      <td className="py-2 pr-4">
        <select name="category" form={fid} defaultValue={expense.category} className="border rounded px-2 py-1">
          {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <FieldError message={errs.category} />
      </td>
      <td className="py-2 pr-4">
        <input name="amountIncl" type="number" step="0.01" min="0" form={fid} defaultValue={centsToDollars(expense.amountInclCents)} className="border rounded px-1 py-1 w-24" />
        <FieldError message={errs.amountIncl} />
      </td>
      <td className="py-2 pr-4">
        <input name="gst" type="number" step="0.01" min="0" form={fid} defaultValue={centsToDollars(expense.gstCents)} className="border rounded px-1 py-1 w-20" />
        <FieldError message={errs.gst} />
      </td>
      <td className="py-2 pr-4">
        <input name="vendor" form={fid} defaultValue={expense.vendor ?? ""} className="border rounded px-2 py-1 w-28" />
      </td>
      <td className="py-2 pr-4">
        <input name="receipt" type="file" accept="image/*" form={fid} className="text-xs w-28" />
      </td>
      <td className="py-2">
        <form id={fid} onSubmit={onSubmit} className="flex gap-3">
          <input type="hidden" name="notes" value={expense.notes ?? ""} />
          <button type="submit" disabled={pending} className="text-sm underline disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm underline">Cancel</button>
        </form>
        {!state.ok && state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      </td>
    </tr>
  );
}
