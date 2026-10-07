import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import type { SettingsInput } from "@/lib/settings/parse";

/** Current app settings; defaults (GST-registered, July FY, no ABN) when no row exists. */
export async function getSettings(): Promise<{ gstRegistered: boolean; fyStartMonth: number; abn: string | null }> {
  const db = await getDb();
  const rows = await db.select().from(settings).orderBy(asc(settings.id)).limit(1);
  const row = rows[0];
  // Default to GST-registered (the locked project decision) when unset.
  return {
    gstRegistered: row?.gstRegistered ?? true,
    fyStartMonth: row?.fyStartMonth ?? 7,
    abn: row?.abn ?? null,
  };
}

/**
 * Upserts the single settings row atomically in one D1 batch: updates the
 * lowest-id row (the one getSettings reads), then inserts a row only if the
 * table is still empty. fyStartMonth keeps its schema default — it is not
 * user-editable.
 */
export async function updateSettings(input: SettingsInput): Promise<void> {
  const db = await getDb();
  await db.batch([
    db
      .update(settings)
      .set(input)
      .where(eq(settings.id, sql`(SELECT MIN(${settings.id}) FROM ${settings})`)),
    db.run(
      sql`INSERT INTO ${settings} (${sql.identifier("gst_registered")}, ${sql.identifier("abn")})
          SELECT ${input.gstRegistered ? 1 : 0}, ${input.abn}
          WHERE NOT EXISTS (SELECT 1 FROM ${settings})`,
    ),
  ]);
}
