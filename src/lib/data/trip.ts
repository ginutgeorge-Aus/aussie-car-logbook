import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { trip, vehicle } from "@/db/schema";
import type { TripRow } from "@/lib/logbook/types";

type TripInput = {
  date: string;
  odoStart: number;
  odoEnd: number;
  purpose: string | null;
  isBusiness: boolean;
};

async function currentVehicleId(): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select({ id: vehicle.id }).from(vehicle).limit(1);
  return rows[0]?.id ?? null;
}

export async function listTrips(): Promise<TripRow[]> {
  const db = await getDb();
  return db.select().from(trip).orderBy(desc(trip.date));
}

export async function createTrip(input: TripInput): Promise<void> {
  const vehicleId = await currentVehicleId();
  if (vehicleId === null) throw new Error("No vehicle set up yet.");
  const db = await getDb();
  await db.insert(trip).values({ ...input, vehicleId });
}

export async function updateTrip(id: number, input: TripInput): Promise<void> {
  const db = await getDb();
  await db.update(trip).set(input).where(eq(trip.id, id));
}

export async function deleteTrip(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(trip).where(eq(trip.id, id));
}
