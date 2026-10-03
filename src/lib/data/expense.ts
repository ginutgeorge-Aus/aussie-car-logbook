import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { expense, vehicle } from "@/db/schema";
import { deleteReceipt } from "@/lib/data/receipts";
import type { ExpenseInput } from "@/lib/expenses/parse";

export type ExpenseRow = typeof expense.$inferSelect;

async function currentVehicleId(): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select({ id: vehicle.id }).from(vehicle).limit(1);
  return rows[0]?.id ?? null;
}

export async function listExpenses(): Promise<ExpenseRow[]> {
  const db = await getDb();
  return db.select().from(expense).orderBy(desc(expense.date));
}

/** Deletes a just-uploaded receipt when its DB write failed, then rethrows. */
async function discardUpload(receiptKey: string | null | undefined, e: unknown): Promise<never> {
  if (receiptKey) await deleteReceipt(receiptKey).catch(() => {});
  throw e;
}

export async function createExpense(input: ExpenseInput, receiptKey: string | null): Promise<void> {
  try {
    const vehicleId = await currentVehicleId();
    if (vehicleId === null) throw new Error("No vehicle set up yet.");
    const db = await getDb();
    await db.insert(expense).values({ ...input, vehicleId, receiptKey });
  } catch (e) {
    await discardUpload(receiptKey, e);
  }
}

export async function updateExpense(
  id: number,
  input: ExpenseInput,
  receiptKey?: string | null,
): Promise<void> {
  let oldKey: string | null = null;
  try {
    const db = await getDb();
    if (receiptKey !== undefined) {
      const rows = await db.select({ receiptKey: expense.receiptKey }).from(expense).where(eq(expense.id, id)).limit(1);
      oldKey = rows[0]?.receiptKey ?? null;
    }
    // Only overwrite receiptKey when a value is passed (undefined = keep existing).
    const values = receiptKey === undefined ? input : { ...input, receiptKey };
    await db.update(expense).set(values).where(eq(expense.id, id));
  } catch (e) {
    await discardUpload(receiptKey, e);
  }
  // The row now points at the new receipt; the replaced object is unreachable.
  if (oldKey && oldKey !== receiptKey) await deleteReceipt(oldKey).catch(() => {});
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  const rows = await db.select({ receiptKey: expense.receiptKey }).from(expense).where(eq(expense.id, id)).limit(1);
  await db.delete(expense).where(eq(expense.id, id));
  const key = rows[0]?.receiptKey;
  // Best-effort: the row is already gone, so a failed R2 delete must not report failure.
  if (key) await deleteReceipt(key).catch(() => {});
}
