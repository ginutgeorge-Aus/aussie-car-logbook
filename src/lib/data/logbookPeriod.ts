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
      odoStart: logbookPeriod.odoStart,
      odoEnd: logbookPeriod.odoEnd,
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
  odoStart: number;
  odoEnd: number;
}): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ id: vehicle.id }).from(vehicle).limit(1);
  const vehicleId = rows[0]?.id;
  if (vehicleId === undefined) throw new Error("No vehicle set up yet.");
  const { lastFy } = logbookValidity(input);
  const validUntil = `${Number(lastFy.slice(0, 4)) + 1}-06-30`;
  await db.insert(logbookPeriod).values({ ...input, vehicleId, validUntil });
}

/** Sets the start/end odometer readings of an existing logbook period (fixes periods saved without them). */
export async function updateLogbookPeriodOdometer(id: number, odoStart: number, odoEnd: number): Promise<void> {
  const db = await getDb();
  await db.update(logbookPeriod).set({ odoStart, odoEnd }).where(eq(logbookPeriod.id, id));
}

/** Loads one logbook period's dates and nominated FY, or null when it doesn't exist. */
export async function getLogbookPeriod(id: number): Promise<{ startDate: string; endDate: string; nominatedFy: string | null } | null> {
  const db = await getDb();
  const rows = await db
    .select({ startDate: logbookPeriod.startDate, endDate: logbookPeriod.endDate, nominatedFy: logbookPeriod.nominatedFy })
    .from(logbookPeriod)
    .where(eq(logbookPeriod.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** Sets the nominated FY of an existing logbook period and refreshes its informational `valid_until` cache. */
export async function updateLogbookPeriodNominatedFy(id: number, nominatedFy: string): Promise<void> {
  const existing = await getLogbookPeriod(id);
  if (!existing) throw new Error("Logbook period not found.");
  const { lastFy } = logbookValidity({ ...existing, nominatedFy });
  const validUntil = `${Number(lastFy.slice(0, 4)) + 1}-06-30`;
  const db = await getDb();
  await db.update(logbookPeriod).set({ nominatedFy, validUntil }).where(eq(logbookPeriod.id, id));
}

/** Deletes a logbook period, first unlinking any trips that reference it (FK). */
export async function deleteLogbookPeriod(id: number): Promise<void> {
  const db = await getDb();
  await db.batch([
    db.update(trip).set({ periodId: null }).where(eq(trip.periodId, id)),
    db.delete(logbookPeriod).where(eq(logbookPeriod.id, id)),
  ]);
}
