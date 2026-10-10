"use client";

import { createLogbookPeriodAction, deleteLogbookPeriodAction } from "@/lib/actions";
import { FieldError } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";

export type LogbookPeriodView = {
  id: number;
  startDate: string;
  endDate: string;
  /** e.g. "FY 2024-25 to 2028-29". */
  validity: string;
  /** Business-use % from trips inside the period, or null when it has none. */
  businessPct: number | null;
};

/** Form to add a logbook period (start/end date, validated as ≥12 weeks on the server). */
export function LogbookPeriodForm() {
  const { state, pending, onSubmit } = useFormSubmit(createLogbookPeriodAction, { onSuccess: (form) => form.reset() });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 border rounded p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Logbook start</span>
        <input name="startDate" type="date" className="border rounded px-2 py-1" />
        <FieldError message={errs.startDate} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Logbook end</span>
        <input name="endDate" type="date" className="border rounded px-2 py-1" />
        <FieldError message={errs.endDate} />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Adding…" : "Add logbook period"}
      </button>
      {!state.ok && state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}

/** One logbook period with its validity window, business % and a delete button. */
export function LogbookPeriodItem({ period }: { period: LogbookPeriodView }) {
  const del = useFormSubmit(deleteLogbookPeriodAction, {
    confirmMessage: `Delete the logbook period ${period.startDate} to ${period.endDate}?`,
  });

  return (
    <li className="flex flex-wrap items-center gap-3 border-b py-2 text-sm">
      <span>{period.startDate} to {period.endDate}</span>
      <span className="text-zinc-600">Valid {period.validity}</span>
      <span className="text-zinc-600">
        {period.businessPct === null ? "No trips recorded yet" : `Business use ${period.businessPct}%`}
      </span>
      <form method="post" onSubmit={del.onSubmit}>
        <input type="hidden" name="id" value={period.id} />
        <button type="submit" disabled={del.pending} className="text-red-600 underline disabled:opacity-50">
          {del.pending ? "Deleting…" : "Delete"}
        </button>
      </form>
      {!del.state.ok && del.state.error ? <p className="w-full text-red-600">{del.state.error}</p> : null}
    </li>
  );
}
