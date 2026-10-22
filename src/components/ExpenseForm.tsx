"use client";

import { useRef, useState, useTransition } from "react";
import { createExpenseAction } from "@/lib/actions";
import { compressReceipt } from "@/lib/image/compress";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import { FieldError, FormError, useFieldErrors } from "@/components/FieldError";
import { CameraIcon, PlusIcon } from "@/components/icons";
import { btnPrimary, btnSecondary, cardCls, eyebrowCls, inputCls, labelCls } from "@/components/ui";
import { useFormSubmit } from "@/components/useFormSubmit";
import { todayIso } from "@/lib/today";
import { isValidAbn } from "@/lib/tax/abn";
import { TAX_INVOICE_BUYER_ID_THRESHOLD_CENTS } from "@/lib/tax/gst";

/** "Add an expense" card: receipt photo, fields, and add confirmation. */
export function ExpenseForm() {
  const [added, setAdded] = useState(false);
  const { state, pending, onSubmit } = useFormSubmit(createExpenseAction, { onSuccess: resetForm });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fe = useFieldErrors(errs);

  // Controlled fields.
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].code);
  const [amount, setAmount] = useState("");
  const [gst, setGst] = useState("");
  const [vendor, setVendor] = useState("");
  const [gstFree, setGstFree] = useState(false);
  const [abn, setAbn] = useState("");
  const [taxInvoice, setTaxInvoice] = useState(false);

  // nosemgrep: glb-no-float-gst -- dollar-string preview only; saved GST is re-derived in cents server-side
  const autoGst = gstFree ? "0.00" : (Number(amount) > 0 ? (Number(amount) / 11).toFixed(2) : "");

  // Receipt photo state.
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [preparing, startPrepare] = useTransition();
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);

  /** Clears every field after a successful add so the next save can't duplicate it. */
  function resetForm(form: HTMLFormElement) {
    form.reset(); // uncontrolled fields: notes, receipt file
    setDate(todayIso());
    setCategory(EXPENSE_CATEGORIES[0].code);
    setAmount("");
    setGst("");
    setVendor("");
    setGstFree(false);
    setAbn("");
    setTaxInvoice(false);
    setHasFile(false);
    setPhotoMsg(null);
    setAdded(true);
  }

  /** Compresses the picked photo and swaps it into the form's file input. */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    setPhotoMsg(null);
    if (!original) {
      setHasFile(false);
      return;
    }
    startPrepare(async () => {
      let file: File;
      try {
        file = await compressReceipt(original);
      } catch {
        if (original.type === "image/heic") {
          // Chrome/Firefox can't decode HEIC; the server still accepts it, so keep the original.
          setHasFile(true);
          return;
        }
        // Clear the real input too, or submit would still upload the bad file.
        if (fileRef.current) fileRef.current.value = "";
        setHasFile(false);
        setPhotoMsg("Couldn't read that image — pick another receipt.");
        return;
      }
      // Store the small JPEG in R2, not the multi-MB camera original.
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileRef.current) fileRef.current.files = dt.files;
      setHasFile(true);
    });
  }

  let photoLabel = "Add receipt photo";
  if (preparing) photoLabel = "Preparing photo…";
  else if (hasFile) photoLabel = "Replace receipt photo";

  return (
    <section id="add-expense" aria-labelledby="add-expense-h" className={`${cardCls} scroll-mt-24 p-4 md:p-5`}>
      <h2 id="add-expense-h" className={`${eyebrowCls} mb-3`}>Add an expense</h2>
      <form method="post" onSubmit={onSubmit} onInput={() => setAdded(false)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <input ref={fileRef} name="receipt" type="file" accept="image/*" onChange={onFileChange} className="sr-only" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={preparing} className={`${btnSecondary} w-full md:w-auto md:self-start min-h-12`}>
            <CameraIcon size={20} />
            {photoLabel}
          </button>
          {hasFile && !preparing ? <output className="text-sm text-success">Receipt photo attached.</output> : null}
          {photoMsg ? <output className="text-sm text-muted">{photoMsg}</output> : null}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Date</span>
            <input {...fe("date").input} name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <FieldError {...fe("date").error} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Category</span>
            <select {...fe("category").input} name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <FieldError {...fe("category").error} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Amount incl GST ($)</span>
            <input {...fe("amountIncl").input} name="amountIncl" type="number" step="0.01" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} font-mono`} />
            <FieldError {...fe("amountIncl").error} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>GST ($)</span>
            <input {...fe("gst").input} name="gst" type="number" step="0.01" min="0" inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} placeholder={autoGst} disabled={gstFree} className={`${inputCls} font-mono`} />
            <FieldError {...fe("gst").error} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Vendor</span>
            <input name="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Seller ABN</span>
            <input
              {...fe("abn").input}
              name="abn"
              inputMode="numeric"
              value={abn}
              onChange={(e) => {
                // A printed ABN usually means a tax invoice: tick once when it first becomes
                // valid, so later edits don't undo a deliberate untick.
                if (isValidAbn(e.target.value) && !isValidAbn(abn)) setTaxInvoice(true);
                setAbn(e.target.value);
              }}
              placeholder="11 digits"
              className={`${inputCls} font-mono`}
            />
            <FieldError {...fe("abn").error} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Notes</span>
            <input name="notes" className={inputCls} />
          </label>
          <label className="col-span-2 flex min-h-11 w-fit cursor-pointer items-center gap-3 md:self-end">
            <input name="gstFree" type="checkbox" checked={gstFree} onChange={(e) => setGstFree(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            <span className="text-[15px]">GST-free</span>
          </label>
          <label className="col-span-2 flex min-h-11 w-fit cursor-pointer items-center gap-3 md:self-end">
            <input name="taxInvoice" type="checkbox" checked={taxInvoice} onChange={(e) => setTaxInvoice(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            <span className="text-[15px]">Receipt is a tax invoice (shows seller ABN + GST)</span>
          </label>
          {Math.round(Number(amount) * 100) >= TAX_INVOICE_BUYER_ID_THRESHOLD_CENTS ? (
            <p className="col-span-2 md:col-span-4 text-sm text-muted">Tax invoice must also show your name or ABN.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || preparing} className={`${btnPrimary} w-full md:w-auto`}>
            <PlusIcon size={18} />
            {pending ? "Adding…" : "Add expense"}
          </button>
          <p role="status" className="text-sm text-success">{added && state.ok && !pending ? "Expense added." : ""}</p>
        </div>
        <FormError message={!state.ok ? state.error : null} />
      </form>
    </section>
  );
}
