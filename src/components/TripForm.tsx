"use client";

import { useState } from "react";
import { createTripAction } from "@/lib/actions";
import { FormError } from "@/components/FieldError";
import { TripFields } from "@/components/TripFields";
import { useFormSubmit } from "@/components/useFormSubmit";
import { PlusIcon } from "@/components/icons";
import { btnPrimary, cardCls, eyebrowCls } from "@/components/ui";
import { todayIso } from "@/lib/today";

/** "Log a trip" card. Resets after a successful add and confirms with a status line. */
export function TripForm() {
  const [added, setAdded] = useState(false);
  const { state, pending, onSubmit } = useFormSubmit(createTripAction, {
    onSuccess: (form) => {
      form.reset();
      setAdded(true);
    },
  });
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <section id="add-trip" aria-labelledby="add-trip-h" className={`${cardCls} scroll-mt-24 p-4 md:p-5`}>
      <h2 id="add-trip-h" className={`${eyebrowCls} mb-3`}>Log a trip</h2>
      <form method="post" onSubmit={onSubmit} onInput={() => setAdded(false)} className="flex flex-col gap-3">
        <TripFields defaultDate={todayIso()} errs={errs} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={`${btnPrimary} w-full md:w-auto`}>
            <PlusIcon size={18} />
            {pending ? "Adding…" : "Add trip"}
          </button>
          <p role="status" className="text-sm text-success">{added && !pending ? "Trip added." : ""}</p>
        </div>
        <FormError message={!state.ok ? state.error : null} />
      </form>
    </section>
  );
}
