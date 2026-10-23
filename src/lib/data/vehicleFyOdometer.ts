import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vehicle, vehicleFyOdometer } from "@/db/schema";
import type { VehicleFyOdometerRow } from "@/lib/logbook/types";

/** Lists the current vehicle's yearly odometer readings, oldest FY first. */
export async function listVehicleFyOdometers(): Promise<VehicleFyOdometerRow[]> {
  const db = await getDb();
  return db.select().from(vehicleFyOdometer).orderBy(asc(vehicleFyOdometer.fyLabel));
}

/** Sets the readings for one FY of the current vehicle, replacing any saved for that FY. */
export async function upsertVehicleFyOdometer(input: {
  fyLabel: string;
  odoOpen: number | null;
  odoClose: number | null;
}): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ id: vehicle.id }).from(vehicle).limit(1);
  const vehicleId = rows[0]?.id;
  if (vehicleId === undefined) throw new Error("No vehicle set up yet.");
  await db
    .insert(vehicleFyOdometer)
    .values({ ...input, vehicleId })
    .onConflictDoUpdate({
      target: [vehicleFyOdometer.vehicleId, vehicleFyOdometer.fyLabel],
      set: { odoOpen: input.odoOpen, odoClose: input.odoClose },
    });
}
