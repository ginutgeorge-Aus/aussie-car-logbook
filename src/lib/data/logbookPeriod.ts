import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { logbookPeriod, trip, vehicle } from "@/db/schema";
import { logbookValidity } from "@/lib/tax";
import type { LogbookPeriodRow } from "@/lib/logbook/types";

/** Lists every logbook period, oldest first. */
export async function listLogbookPeriods(): Promise<LogbookPeriodRow[]> {
  const db = await getDb();
  return db
    .select({
      id: logbookPeriod.id,
      vehicleId: logbookPeriod.vehicleId,
      startDate: logbookPeriod.startDate,
      endDate: logbookPeriod.endDate,
      nominatedFy: logbookPeriod.nominatedFy,
    })
    .from(logbookPeriod)
    .orderBy(asc(logbookPeriod.startDate));
}

/**
 * Creates a logbook period for the current vehicle. `valid_until` is stored as
 * an informational cache (30 June of the last valid FY); reports recompute
 * validity from the dates and never read it.
 */
export async function createLogbookPeriod(input: {
  startDate: string;
  endDate: string;
  nominatedFy: string | null;
}): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ id: vehicle.id }).from(vehicle).limit(1);
  const vehicleId = rows[0]?.id;
  if (vehicleId === undefined) throw new Error("No vehicle set up yet.");
  const { lastFy } = logbookValidity(input);
  const validUntil = `${Number(lastFy.slice(0, 4)) + 1}-06-30`;
  await db.insert(logbookPeriod).values({ ...input, vehicleId, validUntil });
}

/** Deletes a logbook period, first unlinking any trips that reference it (FK). */
export async function deleteLogbookPeriod(id: number): Promise<void> {
  const db = await getDb();
  await db.batch([
    db.update(trip).set({ periodId: null }).where(eq(trip.periodId, id)),
    db.delete(logbookPeriod).where(eq(logbookPeriod.id, id)),
  ]);
}
