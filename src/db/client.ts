import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";

export async function getDb(): Promise<DrizzleD1Database<typeof schema>> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}
