"use client";

import { createLogbookPeriodAction, deleteLogbookPeriodAction } from "@/lib/actions";
import { FieldError, useFieldErrors } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import { btnDanger, btnPrimary, cardCls, inputCls, labelCls } from "@/components/ui";

export type LogbookPeriodView = {
  id: number;
  startDate: string;
  endDate: string;
  /** e.g. "FY 2024-25 to 2028-29". */
  validity: string;
  /** Business-use % (2 dp, e.g. "66.67") from trips inside the period, or null when it has none. */
  businessPct: string | null;
};

/** Form to add a logbook period (start/end date, validated as ≥12 weeks on the server). */
export function LogbookPeriodForm() {
  const { state, pending, onSubmit } = useFormSubmit(createLogbookPeriodAction, { onSuccess: (form) => form.reset() });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fe = useFieldErrors(errs);

  return (
    <form method="post" onSubmit={onSubmit} className={`${cardCls} flex flex-wrap items-end gap-3 p-4`}>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Logbook start</span>
        <input {...fe("startDate").input} name="startDate" type="date" className={inputCls} />
        <FieldError {...fe("startDate").error} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Logbook end</span>
        <input {...fe("endDate").input} name="endDate" type="date" className={inputCls} />
        <FieldError {...fe("endDate").error} />
      </label>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Adding…" : "Add logbook period"}
      </button>
      {!state.ok && state.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

/** One logbook period with its validity window, business % and a delete button. */
export function LogbookPeriodItem({ period }: { period: LogbookPeriodView }) {
  const del = useFormSubmit(deleteLogbookPeriodAction, {
    confirmMessage: `Delete the logbook period ${period.startDate} to ${period.endDate}?`,
  });

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span className="font-mono">{period.startDate} to {period.endDate}</span>
      <span className="text-muted">Valid {period.validity}</span>
      <span className="text-muted">
        {period.businessPct === null ? "No trips recorded yet" : `Business use ${period.businessPct}%`}
      </span>
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
