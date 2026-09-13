"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { createExpenseAction, scanReceiptAction } from "@/lib/actions";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import { FieldError } from "@/components/FieldError";
import { todayIso } from "@/lib/today";
import type { ActionResult } from "@/lib/logbook/types";

const initial: ActionResult = { ok: true };

export function ExpenseForm() {
  const [state, action, pending] = useActionState(createExpenseAction, initial);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  // Controlled OCR-target fields.
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].code);
  const [amount, setAmount] = useState("");
  const [gst, setGst] = useState("");
  const [vendor, setVendor] = useState("");
  const [gstFree, setGstFree] = useState(false);

  const autoGst = gstFree ? "0.00" : (Number(amount) > 0 ? (Number(amount) / 11).toFixed(2) : "");

  // Scan state.
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [scanning, startScan] = useTransition();
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  function onScan() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("receipt", f);
    setScanMsg(null);
    startScan(async () => {
      const res = await scanReceiptAction({ ok: false, error: "" }, fd);
      if (res.ok) {
        const v = res.value;
        if (v.dateISO) setDate(v.dateISO);
        if (v.amountInclCents != null) setAmount((v.amountInclCents / 100).toFixed(2));
        if (v.gstCents != null) {
          setGstFree(false);
          setGst((v.gstCents / 100).toFixed(2));
        }
        if (v.vendor) setVendor(v.vendor);
        if (v.category) setCategory(v.category);
        setScanMsg("AI-filled — check every field before saving.");
      } else {
        setScanMsg(res.error);
      }
    });
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border rounded p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Date</span>
        <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Category</span>
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded px-2 py-1">
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
        <input name="gst" type="number" step="0.01" min="0" value={gst} onChange={(e) => setGst(e.target.value)} placeholder={autoGst} disabled={gstFree} className="border rounded px-2 py-1 w-28" />
        <FieldError message={errs.gst} />
      </label>
      <label className="flex items-center gap-2">
        <input name="gstFree" type="checkbox" checked={gstFree} onChange={(e) => setGstFree(e.target.checked)} />
        <span className="text-sm">GST-free</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Vendor</span>
        <input name="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Notes</span>
        <input name="notes" className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Receipt</span>
        <input ref={fileRef} name="receipt" type="file" accept="image/*" capture="environment" onChange={(e) => setHasFile(!!e.target.files?.length)} className="text-sm" />
      </label>
      <button type="button" onClick={onScan} disabled={!hasFile || scanning} className="rounded border px-3 py-2 disabled:opacity-50">
        {scanning ? "Scanning…" : "Scan receipt"}
      </button>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Adding…" : "Add expense"}
      </button>
      {scanMsg ? <p className="w-full text-sm text-gray-600">{scanMsg}</p> : null}
      {!state.ok && state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
