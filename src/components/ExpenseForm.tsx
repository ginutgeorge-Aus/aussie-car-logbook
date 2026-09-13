"use client";

import { useActionState, useState } from "react";
import { createExpenseAction } from "@/lib/actions";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import { FieldError } from "@/components/FieldError";
import { todayIso } from "@/lib/today";
import type { ActionResult } from "@/lib/logbook/types";

const initial: ActionResult = { ok: true };

export function ExpenseForm() {
  const [state, action, pending] = useActionState(createExpenseAction, initial);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const [amount, setAmount] = useState("");
  const [gstFree, setGstFree] = useState(false);
  const autoGst = gstFree ? "0.00" : (Number(amount) > 0 ? (Number(amount) / 11).toFixed(2) : "");

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border rounded p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Date</span>
        <input name="date" type="date" defaultValue={todayIso()} className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Category</span>
        <select name="category" className="border rounded px-2 py-1">
          {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <FieldError message={errs.category} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Amount (incl GST)</span>
        <input name="amountIncl" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="border rounded px-2 py-1 w-32" />
        <FieldError message={errs.amountIncl} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">GST</span>
        <input name="gst" type="number" step="0.01" min="0" defaultValue="" placeholder={autoGst} disabled={gstFree} className="border rounded px-2 py-1 w-28" />
        <FieldError message={errs.gst} />
      </label>
      <label className="flex items-center gap-2">
        <input name="gstFree" type="checkbox" checked={gstFree} onChange={(e) => setGstFree(e.target.checked)} />
        <span className="text-sm">GST-free</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Vendor</span>
        <input name="vendor" className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Receipt</span>
        <input name="receipt" type="file" accept="image/*" capture="environment" className="text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Notes</span>
        <input name="notes" className="border rounded px-2 py-1" />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Adding…" : "Add expense"}
      </button>
      {!state.ok && state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
