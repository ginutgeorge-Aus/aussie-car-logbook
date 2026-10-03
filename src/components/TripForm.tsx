"use client";

import { createTripAction } from "@/lib/actions";
import { FieldError } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";

export function TripForm() {
  const { state, pending, onSubmit } = useFormSubmit(createTripAction, { onSuccess: (form) => form.reset() });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 border rounded p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Date</span>
        <input name="date" type="date" className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Odo start</span>
        <input name="odoStart" type="number" min="0" className="border rounded px-2 py-1 w-28" />
        <FieldError message={errs.odoStart} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Odo end</span>
        <input name="odoEnd" type="number" min="0" className="border rounded px-2 py-1 w-28" />
        <FieldError message={errs.odoEnd} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Purpose</span>
        <input name="purpose" className="border rounded px-2 py-1" />
      </label>
      <label className="flex items-center gap-2">
        <input name="isBusiness" type="checkbox" />
        <span className="text-sm">Business</span>
      </label>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Adding…" : "Add trip"}
      </button>
      {!state.ok && state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
