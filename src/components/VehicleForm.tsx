"use client";

import { useState } from "react";
import { saveVehicleAction } from "@/lib/actions";
import { FieldError, FormError, useFieldErrors } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import { btnPrimary, inputCls, labelCls } from "@/components/ui";
import { centsToDollars, dollarsToCents } from "@/lib/logbook/parse";
import { gstFromInclusive } from "@/lib/tax";
import type { VehicleRow } from "@/lib/logbook/types";

/** 1/11 of a dollar string as dollars ("4000.00"), or null when it isn't a valid amount. */
function elevenths(dollars: string): string | null {
  try {
    return dollars.trim() === "" ? null : centsToDollars(gstFromInclusive(dollarsToCents(dollars)));
  } catch {
    return null;
  }
}

/** Vehicle details form (make, model, rego, opening odometer, purchase cost + GST). Keeps input on error. */
export function VehicleForm({ vehicle }: { vehicle: VehicleRow | null }) {
  const { state, pending, onSubmit } = useFormSubmit(saveVehicleAction);
  const [cost, setCost] = useState(vehicle?.purchaseCostCents != null ? centsToDollars(vehicle.purchaseCostCents) : "");
  const maxGst = elevenths(cost);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fe = useFieldErrors(errs);

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Make</span>
          <input {...fe("make").input} name="make" defaultValue={vehicle?.make ?? ""} autoComplete="off" className={inputCls} />
          <FieldError {...fe("make").error} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Model</span>
          <input {...fe("model").input} name="model" defaultValue={vehicle?.model ?? ""} autoComplete="off" className={inputCls} />
          <FieldError {...fe("model").error} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Engine capacity (cc)</span>
        <input
          {...fe("engineCapacityCc").input}
          name="engineCapacityCc"
          type="number"
          inputMode="numeric"
          min={50}
          max={10000}
          step={1}
          defaultValue={vehicle?.engineCapacityCc ?? ""}
          className={`${inputCls} font-mono`}
        />
        <span className="text-sm text-muted">Required in the ATO logbook for a petrol, diesel or hybrid car. Leave blank only for an electric car.</span>
        <FieldError {...fe("engineCapacityCc").error} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Rego</span>
          <input name="rego" defaultValue={vehicle?.rego ?? ""} autoComplete="off" autoCapitalize="characters" className={`${inputCls} font-mono`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Opening odometer (km)</span>
          <input {...fe("odoOpen").input} name="odoOpen" type="number" min="0" inputMode="numeric" defaultValue={vehicle?.odoOpen ?? ""} className={`${inputCls} font-mono`} />
          <FieldError {...fe("odoOpen").error} />
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
            {...fe("purchaseCost").input}
            name="purchaseCost"
            type="text"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className={`${inputCls} font-mono`}
          />
          <FieldError {...fe("purchaseCost").error} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>GST on the purchase tax invoice $ (optional)</span>
        <input
          {...fe("purchaseGst").input}
          name="purchaseGst"
          type="text"
          inputMode="decimal"
          defaultValue={vehicle?.purchaseGstCents != null ? centsToDollars(vehicle.purchaseGstCents) : ""}
          className={`${inputCls} font-mono`}
        />
        <span className="text-sm text-muted">
          From the dealer&apos;s tax invoice{maxGst ? ` — usually 1/11 of the price ($${maxGst})` : ""}. Enter 0 for a private
          sale. Left blank, no GST credit is claimed for the car.
        </span>
        <FieldError {...fe("purchaseGst").error} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Effective life (years, optional)</span>
        <input
          {...fe("effectiveLifeYears").input}
          name="effectiveLifeYears"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          step={1}
          defaultValue={vehicle?.effectiveLifeYears ?? ""}
          className={`${inputCls} font-mono`}
        />
        <span className="text-sm text-muted">
          Leave blank to use the ATO&apos;s 8 years. Only change it if you self-assess, or you bought the car from an associate who
          used a different life.
        </span>
        <FieldError {...fe("effectiveLifeYears").error} />
      </label>
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
