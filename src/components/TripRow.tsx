"use client";

import { useActionState, useState } from "react";
import { deleteTripAction, updateTripAction } from "@/lib/actions";
import { tripKm } from "@/lib/logbook/compute";
import { FieldError } from "@/components/FieldError";
import type { ActionResult, TripRow as TripRowType } from "@/lib/logbook/types";

const initial: ActionResult = { ok: true };

export function TripRow({ trip }: { trip: TripRowType }) {
  const [editing, setEditing] = useState(false);
  const updateForId = updateTripAction.bind(null, trip.id);
  const [state, action, pending] = useActionState(updateForId, initial);
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
          <form action={deleteTripAction}>
            <input type="hidden" name="id" value={trip.id} />
            <button type="submit" className="text-sm text-red-600 underline">Delete</button>
          </form>
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
        <form id={`edit-${trip.id}`} action={action} className="flex gap-3">
          <button type="submit" disabled={pending} className="text-sm underline disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm underline">Cancel</button>
        </form>
      </td>
    </tr>
  );
}
