import { getDb } from "@/db/client";
import { settings } from "@/db/schema";

export async function getSettings(): Promise<{ gstRegistered: boolean; fyStartMonth: number }> {
  const db = await getDb();
  const rows = await db.select().from(settings).limit(1);
  const row = rows[0];
  // Default to GST-registered (the locked project decision) when unset.
  return { gstRegistered: row?.gstRegistered ?? true, fyStartMonth: row?.fyStartMonth ?? 7 };
}
