"use client";

import { btnPrimary } from "@/components/ui";

/** Opens the browser print dialog (which also offers "Save as PDF"). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${btnPrimary} no-print`}>
      Print / save as PDF
    </button>
  );
}
