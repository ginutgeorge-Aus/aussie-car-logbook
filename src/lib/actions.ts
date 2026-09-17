"use server";

import { revalidatePath } from "next/cache";
import { parseVehicleForm, parseTripForm } from "@/lib/logbook/parse";
import { upsertVehicle } from "@/lib/data/vehicle";
import { createTrip, updateTrip, deleteTrip } from "@/lib/data/trip";
import type { ActionResult } from "@/lib/logbook/types";
import { parseExpenseForm } from "@/lib/expenses/parse";
import { putReceipt, assertReceiptFile } from "@/lib/data/receipts";
import { createExpense, updateExpense, deleteExpense } from "@/lib/data/expense";
import { getVehicle } from "@/lib/data/vehicle";
import { runReceiptOcr } from "@/lib/data/ocr";
import { parseOcrResult } from "@/lib/ocr/parse";
import type { OcrActionResult } from "@/lib/ocr/types";

export async function saveVehicleAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseVehicleForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  await upsertVehicle(parsed.value);
  revalidatePath("/");
  revalidatePath("/vehicle");
  return { ok: true, saved: true };
}

export async function createTripAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    await createTrip(parsed.value);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/trips");
  revalidatePath("/");
  return { ok: true };
}

export async function updateTripAction(id: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    await updateTrip(id, parsed.value);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/trips");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTripAction(fd: FormData): Promise<void> {
  const id = Number(fd.get("id"));
  if (Number.isInteger(id)) {
    await deleteTrip(id);
    revalidatePath("/trips");
    revalidatePath("/");
  }
}

function fileFrom(fd: FormData): File | null {
  const f = fd.get("receipt");
  return f instanceof File && f.size > 0 ? f : null;
}

export async function createExpenseAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseExpenseForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    const file = fileFrom(fd);
    let receiptKey: string | null = null;
    if (file) {
      const vehicle = await getVehicle();
      if (!vehicle) return { ok: false, error: "No vehicle set up yet." };
      receiptKey = await putReceipt(vehicle.id, file, {
        date: parsed.value.date,
        category: parsed.value.category,
        amountInclCents: parsed.value.amountInclCents,
      });
    }
    await createExpense(parsed.value, receiptKey);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/expenses");
  revalidatePath("/");
  return { ok: true };
}

export async function updateExpenseAction(id: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseExpenseForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    const file = fileFrom(fd);
    let receiptKey: string | undefined = undefined; // undefined = keep existing
    if (file) {
      const vehicle = await getVehicle();
      if (!vehicle) return { ok: false, error: "No vehicle set up yet." };
      receiptKey = await putReceipt(vehicle.id, file, {
        date: parsed.value.date,
        category: parsed.value.category,
        amountInclCents: parsed.value.amountInclCents,
      });
    }
    await updateExpense(id, parsed.value, receiptKey);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/expenses");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteExpenseAction(fd: FormData): Promise<void> {
  const id = Number(fd.get("id"));
  if (Number.isInteger(id)) {
    await deleteExpense(id);
    revalidatePath("/expenses");
    revalidatePath("/");
  }
}

export async function scanReceiptAction(
  _prev: OcrActionResult,
  fd: FormData,
): Promise<OcrActionResult> {
  const file = fileFrom(fd);
  if (!file) return { ok: false, error: "Pick a receipt first." };
  try {
    assertReceiptFile(file);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const raw = await runReceiptOcr(file);
    return { ok: true, value: parseOcrResult(raw) };
  } catch {
    return { ok: false, error: "Couldn't read the receipt. Enter details manually." };
  }
}
