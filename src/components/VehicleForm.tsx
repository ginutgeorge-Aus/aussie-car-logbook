"use client";

import { saveVehicleAction } from "@/lib/actions";
import { FieldError, FormError } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import { btnPrimary, inputCls, labelCls } from "@/components/ui";
import { centsToDollars } from "@/lib/logbook/parse";
import type { VehicleRow } from "@/lib/logbook/types";

/** Vehicle details form (make, model, rego, opening odometer, purchase). Keeps input on error. */
export function VehicleForm({ vehicle }: { vehicle: VehicleRow | null }) {
  const { state, pending, onSubmit } = useFormSubmit(saveVehicleAction);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Make</span>
          <input name="make" defaultValue={vehicle?.make ?? ""} autoComplete="off" className={inputCls} />
          <FieldError message={errs.make} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Model</span>
          <input name="model" defaultValue={vehicle?.model ?? ""} autoComplete="off" className={inputCls} />
          <FieldError message={errs.model} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Rego</span>
          <input name="rego" defaultValue={vehicle?.rego ?? ""} autoComplete="off" autoCapitalize="characters" className={`${inputCls} font-mono`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Opening odometer (km)</span>
          <input name="odoOpen" type="number" min="0" inputMode="numeric" defaultValue={vehicle?.odoOpen ?? ""} className={`${inputCls} font-mono`} />
          <FieldError message={errs.odoOpen} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Purchase date (optional)</span>
          <input name="purchaseDate" type="date" defaultValue={vehicle?.purchaseDate ?? ""} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Purchase cost $ (optional)</span>
          <input
            name="purchaseCost"
            type="text"
            inputMode="decimal"
            defaultValue={vehicle?.purchaseCostCents != null ? centsToDollars(vehicle.purchaseCostCents) : ""}
            className={`${inputCls} font-mono`}
          />
          <FieldError message={errs.purchaseCost} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} w-full md:w-auto`}>
          {pending ? "Saving…" : "Save vehicle"}
        </button>
        <p role="status" className="text-sm text-success">{state.ok && state.saved && !pending ? "Saved." : ""}</p>
      </div>
      <FormError message={!state.ok ? state.error : null} />
    </form>
  );
}
