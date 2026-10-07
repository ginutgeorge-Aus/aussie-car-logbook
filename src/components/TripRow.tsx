"use client";

import { useState } from "react";
import { deleteTripAction, updateTripAction } from "@/lib/actions";
import { tripKm } from "@/lib/logbook/compute";
import { formatKm, humanDate } from "@/lib/format";
import { FormError } from "@/components/FieldError";
import { TripFields } from "@/components/TripFields";
import { useFormSubmit } from "@/components/useFormSubmit";
import { TripType, btnDanger, btnGhost, btnPrimary, btnSecondary } from "@/components/ui";
import type { TripRow as TripRowType } from "@/lib/logbook/types";

/** Stacked edit form for one trip; `onDone` leaves edit mode (after save or cancel). */
function TripEditForm({ trip, onDone }: { trip: TripRowType; onDone: () => void }) {
  const { state, pending, onSubmit } = useFormSubmit(updateTripAction.bind(null, trip.id), { onSuccess: onDone });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form method="post" onSubmit={onSubmit} aria-label={`Edit trip on ${humanDate(trip.date)}`} className="flex flex-col gap-3 py-3">
      <TripFields trip={trip} errs={errs} />
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onDone} className={btnSecondary}>Cancel</button>
      </div>
      <FormError message={!state.ok ? state.error : null} />
    </form>
  );
}

/** Edit + Delete (with confirm) buttons for one trip. */
function TripActions({ trip, onEdit }: { trip: TripRowType; onEdit: () => void }) {
  const del = useFormSubmit(deleteTripAction, { confirmMessage: `Delete the trip on ${humanDate(trip.date, { withYear: true })}?` });
  return (
    <div className="flex flex-col items-end">
      <div className="flex">
        <button type="button" onClick={onEdit} className={btnGhost}>Edit</button>
        <form method="post" onSubmit={del.onSubmit}>
          <input type="hidden" name="id" value={trip.id} />
          <button type="submit" disabled={del.pending} className={btnDanger}>
            {del.pending ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>
      <FormError message={!del.state.ok ? del.state.error : null} />
    </div>
  );
}

/**
 * One trip, as a phone card (`variant="card"`, an `<li>`) or a desktop table
 * row (`variant="row"`). Edit swaps in the stacked edit form in place.
 */
export function TripRow({ trip, variant }: { trip: TripRowType; variant: "card" | "row" }) {
  const [editing, setEditing] = useState(false);
  const done = () => setEditing(false);
  const edit = () => setEditing(true);

  if (variant === "card") {
    return (
      <li className="border-b border-rule">
        {editing ? (
          <TripEditForm trip={trip} onDone={done} />
        ) : (
          <div className="flex items-center gap-3 py-2">
            <span aria-hidden="true" className={`h-10 w-1 shrink-0 rounded-sm ${trip.isBusiness ? "bg-accent" : "bg-private"}`} />
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="truncate text-[15px]">{trip.purpose || (trip.isBusiness ? "Business trip" : "Private trip")}</span>
              <span className="text-xs text-muted">
                {humanDate(trip.date)} · {trip.isBusiness ? "Business" : "Private"} ·{" "}
                <span className="font-mono">{formatKm(trip.odoStart)} → {formatKm(trip.odoEnd)}</span>
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-[15px] font-medium whitespace-nowrap">{formatKm(tripKm(trip))} km</span>
              <TripActions trip={trip} onEdit={edit} />
            </div>
          </div>
        )}
      </li>
    );
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="border-b border-rule px-5">
          <TripEditForm trip={trip} onDone={done} />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="border-b border-rule px-5 py-1.5 whitespace-nowrap text-nav-ink">{humanDate(trip.date)}</td>
      <td className="border-b border-rule px-3 py-1.5">{trip.purpose ?? ""}</td>
      <td className="border-b border-rule px-3 py-1.5 font-mono text-sm text-muted whitespace-nowrap">
        {formatKm(trip.odoStart)} → {formatKm(trip.odoEnd)}
      </td>
      <td className="border-b border-rule px-3 py-1.5 text-right font-mono">{formatKm(tripKm(trip))}</td>
      <td className="border-b border-rule px-3 py-1.5"><TripType isBusiness={trip.isBusiness} /></td>
      <td className="border-b border-rule px-3 py-1.5"><TripActions trip={trip} onEdit={edit} /></td>
    </tr>
  );
}
