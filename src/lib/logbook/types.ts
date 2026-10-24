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

/** Odometer readings at the start (1 July) and end (30 June) of one income year. Null = not recorded. */
export type VehicleFyOdometerRow = {
  id: number;
  vehicleId: number;
  /** Income year label, e.g. "2025-26". */
  fyLabel: string;
  odoOpen: number | null;
  odoClose: number | null;
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
  /** Self-assessed effective life in whole years; null = the ATO default (8). */
  effectiveLifeYears: number | null;
  /** Engine capacity in whole cc (the ATO logbook records it); null = not recorded, e.g. an EV. */
  engineCapacityCc: number | null;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: Record<string, string> };

export type ActionResult =
  | { ok: true; saved?: boolean }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export type { TripLeg };
