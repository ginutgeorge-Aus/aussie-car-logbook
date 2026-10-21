"use client";

import { btnSecondary } from "@/components/ui";

/** Opens the browser print dialog (print CSS switches to the light palette and hides nav). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${btnSecondary} no-print`}>
      Print / Save PDF
    </button>
  );
}
