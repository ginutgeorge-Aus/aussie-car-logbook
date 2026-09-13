"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-black text-white px-4 py-2 no-print"
    >
      Print / Save PDF
    </button>
  );
}
