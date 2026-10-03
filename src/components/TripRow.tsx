"use client";

import { useState } from "react";
import { deleteTripAction, updateTripAction } from "@/lib/actions";
import { tripKm } from "@/lib/logbook/compute";
import { FieldError } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import type { TripRow as TripRowType } from "@/lib/logbook/types";

export function TripRow({ trip }: { trip: TripRowType }) {
  const [editing, setEditing] = useState(false);
  const { state, pending, onSubmit } = useFormSubmit(updateTripAction.bind(null, trip.id), {
    onSuccess: () => setEditing(false),
  });
  const del = useFormSubmit(deleteTripAction, { confirmMessage: `Delete the trip on ${trip.date}?` });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  if (!editing) {
    return (
      <tr className="border-b">
        <td className="py-2 pr-4">{trip.date}</td>
        <td className="py-2 pr-4">{tripKm(trip)} km</td>
        <td className="py-2 pr-4">{trip.isBusiness ? "Business" : "Private"}</td>
        <td className="py-2 pr-4">{trip.purpose ?? ""}</td>
        <td className="py-2 flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-sm underline">Edit</button>
          <form method="post" onSubmit={del.onSubmit}>
            <input type="hidden" name="id" value={trip.id} />
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
        <input name="date" type="date" form={`edit-${trip.id}`} defaultValue={trip.date} className="border rounded px-2 py-1" />
        <FieldError message={errs.date} />
      </td>
      <td className="py-2 pr-4">
        <div className="flex gap-1">
          <input name="odoStart" type="number" min="0" form={`edit-${trip.id}`} defaultValue={trip.odoStart} className="border rounded px-1 py-1 w-24" />
          <input name="odoEnd" type="number" min="0" form={`edit-${trip.id}`} defaultValue={trip.odoEnd} className="border rounded px-1 py-1 w-24" />
        </div>
        <FieldError message={errs.odoStart} />
        <FieldError message={errs.odoEnd} />
      </td>
      <td className="py-2 pr-4">
        <label className="flex items-center gap-1 text-sm">
          <input name="isBusiness" type="checkbox" form={`edit-${trip.id}`} defaultChecked={trip.isBusiness} /> Business
        </label>
      </td>
      <td className="py-2 pr-4">
        <input name="purpose" form={`edit-${trip.id}`} defaultValue={trip.purpose ?? ""} className="border rounded px-2 py-1" />
      </td>
      <td className="py-2">
        <form id={`edit-${trip.id}`} method="post" onSubmit={onSubmit} className="flex gap-3">
          <button type="submit" disabled={pending} className="text-sm underline disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm underline">Cancel</button>
        </form>
        {!state.ok && state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      </td>
    </tr>
  );
}
