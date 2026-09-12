"use client";

import { useActionState } from "react";
import { saveVehicleAction } from "@/lib/actions";
import { FieldError } from "@/components/FieldError";
import { centsToDollars } from "@/lib/logbook/parse";
import type { ActionResult, VehicleRow } from "@/lib/logbook/types";

const initial: ActionResult = { ok: true };

export function VehicleForm({ vehicle }: { vehicle: VehicleRow | null }) {
  const [state, action, pending] = useActionState(saveVehicleAction, initial);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form action={action} className="flex flex-col gap-4 max-w-md">
      <label className="flex flex-col gap-1">
        <span>Make</span>
        <input name="make" defaultValue={vehicle?.make ?? ""} className="border rounded px-2 py-1" />
        <FieldError message={errs.make} />
      </label>
      <label className="flex flex-col gap-1">
        <span>Model</span>
        <input name="model" defaultValue={vehicle?.model ?? ""} className="border rounded px-2 py-1" />
        <FieldError message={errs.model} />
      </label>
      <label className="flex flex-col gap-1">
        <span>Rego</span>
        <input name="rego" defaultValue={vehicle?.rego ?? ""} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span>Opening odometer (km)</span>
        <input name="odoOpen" type="number" min="0" defaultValue={vehicle?.odoOpen ?? ""} className="border rounded px-2 py-1" />
        <FieldError message={errs.odoOpen} />
      </label>
      <label className="flex flex-col gap-1">
        <span>Purchase date (optional)</span>
        <input name="purchaseDate" type="date" defaultValue={vehicle?.purchaseDate ?? ""} className="border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        <span>Purchase cost $ (optional)</span>
        <input
          name="purchaseCost"
          type="text"
          inputMode="decimal"
          defaultValue={vehicle?.purchaseCostCents != null ? centsToDollars(vehicle.purchaseCostCents) : ""}
          className="border rounded px-2 py-1"
        />
        <FieldError message={errs.purchaseCost} />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Saving…" : "Save vehicle"}
      </button>
      {state.ok && state.saved && !pending ? <p className="text-sm text-green-600">Saved.</p> : null}
    </form>
  );
}
