import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vehicle } from "@/db/schema";
import type { VehicleRow } from "@/lib/logbook/types";

export async function getVehicle(): Promise<VehicleRow | null> {
  const db = await getDb();
  const rows = await db.select().from(vehicle).limit(1);
  return rows[0] ?? null;
}

export async function upsertVehicle(input: {
  make: string;
  model: string;
  rego: string | null;
  odoOpen: number | null;
  purchaseDate: string | null;
  purchaseCostCents: number | null;
}): Promise<void> {
  const db = await getDb();
  const existing = await getVehicle();
  if (existing) {
    await db.update(vehicle).set(input).where(eq(vehicle.id, existing.id));
  } else {
    await db.insert(vehicle).values(input);
  }
}
