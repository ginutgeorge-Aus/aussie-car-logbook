"use client";

import { useRef, useState, useTransition } from "react";
import { createExpenseAction, scanReceiptAction } from "@/lib/actions";
import { compressReceipt } from "@/lib/image/compress";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import { FieldError, FormError } from "@/components/FieldError";
import { CameraIcon, PlusIcon } from "@/components/icons";
import { btnPrimary, btnSecondary, cardCls, eyebrowCls, inputCls, labelCls } from "@/components/ui";
import { useFormSubmit } from "@/components/useFormSubmit";
import { todayIso } from "@/lib/today";

/** "Add an expense" card: one-tap receipt scan (OCR pre-fill), fields, and add confirmation. */
export function ExpenseForm() {
  const [added, setAdded] = useState(false);
  const { state, pending, onSubmit } = useFormSubmit(createExpenseAction, { onSuccess: resetForm });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  // Controlled OCR-target fields.
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].code);
  const [amount, setAmount] = useState("");
  const [gst, setGst] = useState("");
  const [vendor, setVendor] = useState("");
  const [gstFree, setGstFree] = useState(false);

  // nosemgrep: glb-no-float-gst -- dollar-string preview only; saved GST is re-derived in cents server-side
  const autoGst = gstFree ? "0.00" : (Number(amount) > 0 ? (Number(amount) / 11).toFixed(2) : "");

  // Scan state.
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [scanning, startScan] = useTransition();
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  /** Clears every field after a successful add so the next save can't duplicate it. */
  function resetForm(form: HTMLFormElement) {
    form.reset(); // uncontrolled fields: notes, receipt file
    setDate(todayIso());
    setCategory(EXPENSE_CATEGORIES[0].code);
    setAmount("");
    setGst("");
    setVendor("");
    setGstFree(false);
    setHasFile(false);
    setScanMsg(null);
    setAdded(true);
  }

  /** Starts compress + scan as soon as a photo is picked. */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setHasFile(false);
      return;
    }
    scanFile(f);
  }

  /** Compresses the photo, attaches it to the form, and pre-fills fields from OCR. */
  function scanFile(original: File) {
    setScanMsg(null);
    startScan(async () => {
      let file: File;
      try {
        file = await compressReceipt(original);
      } catch {
        if (original.type === "image/heic") {
          // Chrome/Firefox can't decode HEIC; the server still accepts it, so
          // keep the original for saving and fall back to manual entry.
          setHasFile(true);
          setScanMsg("This browser can't scan HEIC photos — enter details manually; the photo will still be saved.");
          return;
        }
        // Clear the real input too, or submit would still upload the bad file.
        if (fileRef.current) fileRef.current.value = "";
        setHasFile(false);
        setScanMsg("Couldn't read that image — pick another receipt.");
        return;
      }
      // Swap the input's file for the compressed JPEG so the form submit stores
      // the tiny version in R2, not the multi-MB camera original.
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileRef.current) fileRef.current.files = dt.files;
      setHasFile(true);

      const fd = new FormData();
      fd.set("receipt", file);
      let res: Awaited<ReturnType<typeof scanReceiptAction>>;
      try {
        res = await scanReceiptAction({ ok: false, error: "" }, fd);
      } catch {
        // Network drop or server throw: the photo is still attached, so the
        // user can enter details by hand and save.
        setScanMsg("Scan failed — enter details manually; the photo will still be saved.");
        return;
      }
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
        const filledAny =
          !!v.dateISO || v.amountInclCents != null || v.gstCents != null || !!v.vendor || !!v.category;
        setScanMsg(
          filledAny
            ? "AI-filled — check every field before saving."
            : "Couldn't read any fields — enter details manually.",
        );
      } else {
        setScanMsg(res.error);
      }
    });
  }

  return (
    <section id="add-expense" aria-labelledby="add-expense-h" className={`${cardCls} scroll-mt-24 p-4 md:p-5`}>
      <h2 id="add-expense-h" className={`${eyebrowCls} mb-3`}>Add an expense</h2>
      <form method="post" onSubmit={onSubmit} onInput={() => setAdded(false)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <input ref={fileRef} name="receipt" type="file" accept="image/*" onChange={onFileChange} className="sr-only" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={scanning} className={`${btnSecondary} w-full md:w-auto md:self-start min-h-12`}>
            <CameraIcon size={20} />
            {scanning ? "Scanning…" : hasFile ? "Rescan receipt" : "Scan receipt"}
          </button>
          {scanMsg ? <p role="status" className="text-sm text-muted">{scanMsg}</p> : null}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Date</span>
            <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <FieldError message={errs.date} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Category</span>
            <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <FieldError message={errs.category} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Amount incl GST ($)</span>
            <input name="amountIncl" type="number" step="0.01" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} font-mono`} />
            <FieldError message={errs.amountIncl} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>GST ($)</span>
            <input name="gst" type="number" step="0.01" min="0" inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} placeholder={autoGst} disabled={gstFree} className={`${inputCls} font-mono`} />
            <FieldError message={errs.gst} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Vendor</span>
            <input name="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Notes</span>
            <input name="notes" className={inputCls} />
          </label>
          <label className="col-span-2 flex min-h-11 w-fit cursor-pointer items-center gap-3 md:self-end">
            <input name="gstFree" type="checkbox" checked={gstFree} onChange={(e) => setGstFree(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            <span className="text-[15px]">GST-free</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || scanning} className={`${btnPrimary} w-full md:w-auto`}>
            <PlusIcon size={18} />
            {pending ? "Adding…" : "Add expense"}
          </button>
          <p role="status" className="text-sm text-success">{added && !pending ? "Expense added." : ""}</p>
        </div>
        <FormError message={!state.ok ? state.error : null} />
      </form>
    </section>
  );
}
