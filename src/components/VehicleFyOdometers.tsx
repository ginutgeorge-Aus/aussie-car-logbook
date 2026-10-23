"use client";

import { useState } from "react";
import { saveVehicleFyOdometerAction } from "@/lib/actions";
import { FieldError, FormError, useFieldErrors } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";
import { btnPrimary, inputCls, labelCls } from "@/components/ui";
import { formatKm, fyShort } from "@/lib/format";

export type FyOdometerView = { fyLabel: string; odoOpen: number | null; odoClose: number | null };

/**
 * "Yearly odometer readings": lists the saved start/end-of-year readings and a
 * form to add or update one FY's pair. The ATO wants both readings for each
 * income year a logbook is relied on. Picking an FY pre-fills its saved values.
 *
 * @param rows saved readings, oldest first.
 * @param fyOptions FY labels offered in the picker (recent years, newest first).
 * @param defaultFy FY selected initially (the current one).
 */
export function VehicleFyOdometers({ rows, fyOptions, defaultFy }: { rows: FyOdometerView[]; fyOptions: string[]; defaultFy: string }) {
  const [fy, setFy] = useState(defaultFy);
  const { state, pending, onSubmit } = useFormSubmit(saveVehicleFyOdometerAction);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});
  const fe = useFieldErrors(errs);
  const saved = rows.find((r) => r.fyLabel === fy);

  return (
    <section aria-labelledby="fy-odo-h" className="flex flex-col gap-4">
      <div>
        <h2 id="fy-odo-h" className="text-lg font-semibold">Yearly odometer readings</h2>
        <p className="mt-1 text-sm text-muted">
          For every income year you use a logbook, the ATO needs the odometer reading at the start (1 July) and end (30 June) of the year.
        </p>
      </div>
      {rows.length > 0 ? (
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-sm text-muted">
              <th scope="col" className="py-1 pr-3 font-medium">Year</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">1 July (km)</th>
              <th scope="col" className="py-1 text-right font-medium">30 June (km)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.fyLabel} className="border-t border-rule">
                <th scope="row" className="py-2 pr-3 text-left font-mono font-normal">FY {fyShort(r.fyLabel)}</th>
                <td className="py-2 pr-3 text-right font-mono">{r.odoOpen != null ? formatKm(r.odoOpen) : "—"}</td>
                <td className="py-2 text-right font-mono">{r.odoClose != null ? formatKm(r.odoClose) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted">No yearly readings saved yet.</p>
      )}
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Year</span>
            <select {...fe("fyLabel").input} name="fyLabel" value={fy} onChange={(e) => setFy(e.target.value)} className={inputCls}>
              {fyOptions.map((l) => <option key={l} value={l}>FY {fyShort(l)}</option>)}
            </select>
            <FieldError {...fe("fyLabel").error} />
          </label>
          <label key={`open-${fy}`} className="flex flex-col gap-1.5">
            <span className={labelCls}>At 1 July (km)</span>
            <input {...fe("odoOpen").input} name="odoOpen" type="number" min="0" step="1" inputMode="numeric" defaultValue={saved?.odoOpen ?? ""} className={`${inputCls} font-mono`} />
            <FieldError {...fe("odoOpen").error} />
          </label>
          <label key={`close-${fy}`} className="flex flex-col gap-1.5">
            <span className={labelCls}>At 30 June (km)</span>
            <input {...fe("odoClose").input} name="odoClose" type="number" min="0" step="1" inputMode="numeric" defaultValue={saved?.odoClose ?? ""} className={`${inputCls} font-mono`} />
            <FieldError {...fe("odoClose").error} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={`${btnPrimary} w-full md:w-auto`}>
            {pending ? "Saving…" : "Save readings"}
          </button>
          <p role="status" className="text-sm text-success">{state.ok && state.saved && !pending ? "Saved." : ""}</p>
        </div>
        <FormError message={!state.ok ? state.error : null} />
      </form>
    </section>
  );
}
