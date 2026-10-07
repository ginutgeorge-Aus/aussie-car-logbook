import { FieldError } from "@/components/FieldError";
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
  return (
    <div className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-3">
      <label className="col-span-2 md:col-span-1 flex flex-col gap-1.5">
        <span className={labelCls}>Date</span>
        <input name="date" type="date" defaultValue={trip?.date ?? defaultDate} className={inputCls} />
        <FieldError message={errs.date} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Odo start (km)</span>
        <input name="odoStart" type="number" min="0" inputMode="numeric" defaultValue={trip?.odoStart} className={`${inputCls} font-mono`} />
        <FieldError message={errs.odoStart} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Odo end (km)</span>
        <input name="odoEnd" type="number" min="0" inputMode="numeric" defaultValue={trip?.odoEnd} className={`${inputCls} font-mono`} />
        <FieldError message={errs.odoEnd} />
      </label>
      <label className="col-span-2 md:col-span-1 flex flex-col gap-1.5">
        <span className={labelCls}>Purpose</span>
        <input name="purpose" defaultValue={trip?.purpose ?? ""} placeholder="e.g. Client site — Cardiff" className={inputCls} />
      </label>
      <label className="col-span-2 md:col-span-4 flex min-h-11 w-fit cursor-pointer items-center gap-3">
        <input name="isBusiness" type="checkbox" defaultChecked={trip?.isBusiness ?? false} className="size-5 accent-[var(--accent)]" />
        <span className="text-[15px]">Business trip</span>
      </label>
    </div>
  );
}
