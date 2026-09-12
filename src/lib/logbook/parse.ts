import type { ParseResult } from "@/lib/logbook/types";

export function dollarsToCents(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`Invalid dollar amount: ${input}`);
  return Math.round(n * 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}

function optInt(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

export function parseVehicleForm(
  fd: FormData,
): ParseResult<{
  make: string;
  model: string;
  rego: string | null;
  odoOpen: number | null;
  purchaseDate: string | null;
  purchaseCostCents: number | null;
}> {
  const errors: Record<string, string> = {};
  const make = str(fd, "make");
  const model = str(fd, "model");
  const rego = str(fd, "rego") || null;
  if (!make) errors.make = "Make is required.";
  if (!model) errors.model = "Model is required.";

  const odoOpenRaw = str(fd, "odoOpen");
  const odoOpen = optInt(odoOpenRaw);
  if (Number.isNaN(odoOpen) || (odoOpen !== null && odoOpen < 0)) errors.odoOpen = "Odometer must be a whole number ≥ 0.";

  const purchaseDate = str(fd, "purchaseDate") || null;
  const costRaw = str(fd, "purchaseCost");
  let purchaseCostCents: number | null = null;
  if (costRaw !== "") {
    try {
      purchaseCostCents = dollarsToCents(costRaw);
    } catch {
      errors.purchaseCost = "Enter a valid dollar amount.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { make, model, rego, odoOpen: odoOpen ?? null, purchaseDate, purchaseCostCents },
  };
}

export function parseTripForm(
  fd: FormData,
): ParseResult<{ date: string; odoStart: number; odoEnd: number; purpose: string | null; isBusiness: boolean }> {
  const errors: Record<string, string> = {};
  const date = str(fd, "date");
  if (!date) errors.date = "Date is required.";

  const odoStart = optInt(str(fd, "odoStart"));
  const odoEnd = optInt(str(fd, "odoEnd"));
  if (odoStart === null || Number.isNaN(odoStart) || odoStart < 0) errors.odoStart = "Start odometer must be a whole number ≥ 0.";
  if (odoEnd === null || Number.isNaN(odoEnd) || odoEnd < 0) errors.odoEnd = "End odometer must be a whole number ≥ 0.";
  if (!errors.odoStart && !errors.odoEnd && (odoEnd as number) <= (odoStart as number)) {
    errors.odoEnd = "End odometer must be greater than start.";
  }

  const purpose = str(fd, "purpose") || null;
  const isBusiness = str(fd, "isBusiness") === "on";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { date, odoStart: odoStart as number, odoEnd: odoEnd as number, purpose, isBusiness } };
}
