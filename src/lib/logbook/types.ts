import type { TripLeg } from "@/lib/tax/types";

export type TripRow = {
  id: number;
  vehicleId: number;
  periodId: number | null;
  date: string;
  odoStart: number;
  odoEnd: number;
  purpose: string | null;
  isBusiness: boolean;
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
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: Record<string, string> };

export type ActionResult =
  | { ok: true; saved?: boolean }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export type { TripLeg };
