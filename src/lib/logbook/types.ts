import type { TripLeg } from "@/lib/tax/types";

export type TripRow = {
  id: number;
  vehicleId: number;
  periodId: number | null;
  date: string;
  /** Date the journey ended; null = same day as `date`. */
  endDate: string | null;
  odoStart: number;
  odoEnd: number;
  purpose: string | null;
  isBusiness: boolean;
};

/** A logbook period (the ≥12-week window the ATO logbook method is based on). */
export type LogbookPeriodRow = {
  id: number;
  vehicleId: number;
  startDate: string;
  endDate: string;
  /** Income year the logbook is for when the period crosses 30 June; null = the FY it starts in. */
  nominatedFy?: string | null;
  /** Odometer (km) at the start / end of the period; total km = end − start. Null until recorded. */
  odoStart?: number | null;
  odoEnd?: number | null;
};

export type VehicleRow = {
  id: number;
  make: string;
  model: string;
  rego: string | null;
  odoOpen: number | null;
  odoClose: number | null;
  purchaseDate: string | null;
  purchaseCostCents: number | null;
  /** GST on the purchase tax invoice; 0 = private sale, null = not recorded (no credit claimed). */
  purchaseGstCents: number | null;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: Record<string, string> };

export type ActionResult =
  | { ok: true; saved?: boolean }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export type { TripLeg };
