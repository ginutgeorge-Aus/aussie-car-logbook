import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import type { SettingsInput } from "@/lib/settings/parse";

/** Current app settings; defaults (GST-registered, July FY, no ABN) when no row exists. */
export async function getSettings(): Promise<{ gstRegistered: boolean; fyStartMonth: number; abn: string | null }> {
  const db = await getDb();
  const rows = await db.select().from(settings).limit(1);
  const row = rows[0];
  // Default to GST-registered (the locked project decision) when unset.
  return {
    gstRegistered: row?.gstRegistered ?? true,
    fyStartMonth: row?.fyStartMonth ?? 7,
    abn: row?.abn ?? null,
  };
}

/**
 * Upserts the single settings row: updates the first row if present, else inserts
 * one (fyStartMonth keeps its schema default — it is not user-editable).
 */
export async function updateSettings(input: SettingsInput): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ id: settings.id }).from(settings).limit(1);
  const existing = rows[0];
  if (existing) {
    await db.update(settings).set(input).where(eq(settings.id, existing.id));
  } else {
    await db.insert(settings).values(input);
  }
}
