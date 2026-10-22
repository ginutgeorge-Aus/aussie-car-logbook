import { FieldError, useFieldErrors } from "@/components/FieldError";
import { inputCls, labelCls } from "@/components/ui";
import type { TripRow } from "@/lib/logbook/types";

/**
 * The trip form fields, shared by the add form and the edit form. Field names
 * are the `parseTripForm` contract — keep them stable. Uncontrolled: the
 * parent form keeps values on error (see `useFormSubmit`).
 */
export function TripFields({
  trip,
  defaultDate,
  errs,
}: {
  trip?: TripRow;
  defaultDate?: string;
  errs: Record<string, string>;
}) {
  const fe = useFieldErrors(errs);
  return (
    <div className="grid grid-cols-2 md:grid-cols-[repeat(4,minmax(0,1fr))] gap-3">
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Date</span>
        <input {...fe("date").input} name="date" type="date" defaultValue={trip?.date ?? defaultDate} className={inputCls} />
        <FieldError {...fe("date").error} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>End date (optional)</span>
        <input {...fe("endDate").input} name="endDate" type="date" defaultValue={trip?.endDate ?? ""} className={inputCls} />
        <FieldError {...fe("endDate").error} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Odo start (km)</span>
        <input {...fe("odoStart").input} name="odoStart" type="number" min="0" inputMode="numeric" defaultValue={trip?.odoStart} className={`${inputCls} font-mono`} />
        <FieldError {...fe("odoStart").error} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Odo end (km)</span>
        <input {...fe("odoEnd").input} name="odoEnd" type="number" min="0" inputMode="numeric" defaultValue={trip?.odoEnd} className={`${inputCls} font-mono`} />
        <FieldError {...fe("odoEnd").error} />
      </label>
      <label className="col-span-2 md:col-span-4 flex flex-col gap-1.5">
        <span className={labelCls}>Reason for the trip</span>
        <input {...fe("purpose").input} name="purpose" defaultValue={trip?.purpose ?? ""} placeholder="e.g. Client site — Cardiff" className={inputCls} />
        <FieldError {...fe("purpose").error} />
        <span className="text-xs text-muted">Required for business trips (ATO). Leave the end date blank if the trip ends the same day.</span>
      </label>
      <label className="col-span-2 md:col-span-4 flex min-h-11 w-fit cursor-pointer items-center gap-3">
        <input name="isBusiness" type="checkbox" defaultChecked={trip?.isBusiness ?? false} className="size-5 accent-[var(--accent)]" />
        <span className="text-[15px]">Business trip</span>
      </label>
    </div>
  );
}
