"use client";

import { useState } from "react";
import { createLogbookPeriodAction, deleteLogbookPeriodAction, updateLogbookPeriodOdometerAction } from "@/lib/actions";
import { FieldError, useFieldErrors } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import { btnDanger, btnPrimary, cardCls, inputCls, labelCls } from "@/components/ui";
import { logbookNominableFys } from "@/lib/tax";
import { isIsoDate } from "@/lib/logbook/parse";
import { formatKm } from "@/lib/format";

export type LogbookPeriodView = {
  id: number;
  startDate: string;
  endDate: string;
  /** e.g. "FY 2024-25 to 2028-29". */
  validity: string;
  /** Business-use % (2 dp, e.g. "66.67") from trips inside the period, or null when it has none. */
  businessPct: string | null;
  /** Odometer (km) at the period's start / end; null until recorded. */
  odoStart: number | null;
  odoEnd: number | null;
  /** Why the period can't set business use (shown as a warning), or null when it is usable. */
  problem: string | null;
};

/**
 * Form to add a logbook period (start/end date, validated as ≥12 weeks on the
 * server). A period crossing 30 June gets a picker for the FY it is for.
 */
export function LogbookPeriodForm() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { state, pending, onSubmit } = useFormSubmit(createLogbookPeriodAction, {
    onSuccess: (form) => {
      form.reset();
      setStartDate("");
      setEndDate("");
    },
  });
  const fyOptions = isIsoDate(startDate) && isIsoDate(endDate) && endDate >= startDate ? logbookNominableFys({ startDate, endDate }) : [];
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fe = useFieldErrors(errs);

  return (
    <form method="post" onSubmit={onSubmit} className={`${cardCls} flex flex-wrap items-end gap-3 p-4`}>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Logbook start</span>
        <input {...fe("startDate").input} name="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        <FieldError {...fe("startDate").error} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Logbook end</span>
        <input {...fe("endDate").input} name="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
        <FieldError {...fe("endDate").error} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Odometer at start (km)</span>
        <input {...fe("odoStart").input} name="odoStart" type="number" inputMode="numeric" min={0} step={1} className={inputCls} />
        <FieldError {...fe("odoStart").error} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Odometer at end (km)</span>
        <input {...fe("odoEnd").input} name="odoEnd" type="number" inputMode="numeric" min={0} step={1} className={inputCls} />
        <FieldError {...fe("odoEnd").error} />
      </label>
      {fyOptions.length > 1 ? (
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Logbook is for</span>
          <select {...fe("nominatedFy").input} name="nominatedFy" defaultValue={fyOptions[0]} className={inputCls}>
            {fyOptions.map((fy) => <option key={fy} value={fy}>FY {fy}</option>)}
          </select>
          <FieldError {...fe("nominatedFy").error} />
        </label>
      ) : null}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Adding…" : "Add logbook period"}
      </button>
      {!state.ok && state.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

/** Inline form to set or change a period's start/end odometer readings. */
function PeriodOdometerForm({ period }: { period: LogbookPeriodView }) {
  const { state, pending, onSubmit } = useFormSubmit(updateLogbookPeriodOdometerAction);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fe = useFieldErrors(errs);

  return (
    <form method="post" onSubmit={onSubmit} className="flex w-full flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={period.id} />
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Odometer at start (km)</span>
        <input {...fe("odoStart").input} name="odoStart" type="number" inputMode="numeric" min={0} step={1} defaultValue={period.odoStart ?? ""} className={inputCls} />
        <FieldError {...fe("odoStart").error} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Odometer at end (km)</span>
        <input {...fe("odoEnd").input} name="odoEnd" type="number" inputMode="numeric" min={0} step={1} defaultValue={period.odoEnd ?? ""} className={inputCls} />
        <FieldError {...fe("odoEnd").error} />
      </label>
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save odometers"}</button>
      {state.ok && state.saved ? <p role="status" className="text-sm text-muted">Saved.</p> : null}
      {!state.ok && state.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

/** One logbook period with its validity window, odometers, business %, an odometer edit form and a delete button. */
export function LogbookPeriodItem({ period }: { period: LogbookPeriodView }) {
  const del = useFormSubmit(deleteLogbookPeriodAction, {
    confirmMessage: `Delete the logbook period ${period.startDate} to ${period.endDate}?`,
  });

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span className="font-mono">{period.startDate} to {period.endDate}</span>
      <span className="text-muted">Valid {period.validity}</span>
      {period.odoStart !== null && period.odoEnd !== null ? (
        <span className="font-mono text-muted">
          Odometer {formatKm(period.odoStart)} to {formatKm(period.odoEnd)} · {formatKm(period.odoEnd - period.odoStart)} km total
        </span>
      ) : null}
      <span className="text-muted">
        {period.businessPct === null ? "No business use calculated" : `Business use ${period.businessPct}%`}
      </span>
      {period.problem ? <p role="alert" className="w-full font-medium text-danger">Logbook not valid: {period.problem}.</p> : null}
      <PeriodOdometerForm period={period} />
      <form method="post" onSubmit={del.onSubmit}>
        <input type="hidden" name="id" value={period.id} />
        <button type="submit" disabled={del.pending} className={btnDanger}>
          {del.pending ? "Deleting…" : "Delete"}
        </button>
      </form>
      {!del.state.ok && del.state.error ? <p className="w-full text-danger">{del.state.error}</p> : null}
    </li>
  );
}
