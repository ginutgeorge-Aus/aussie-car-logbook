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

/** Revalidates every page that reads trips, expenses or the vehicle. */
function revalidateAll(listPath: string): void {
  revalidatePath(listPath);
  revalidatePath("/");
  revalidatePath("/reports");
}

/** Normalises a thrown error into a failed ActionResult. */
function failure(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

/** Reads the row id posted by a delete form, or null if it is not an integer. */
function idFrom(fd: FormData): number | null {
  const id = Number(fd.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function saveVehicleAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseVehicleForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    await upsertVehicle(parsed.value);
  } catch (e) {
    return failure(e);
  }
  revalidateAll("/vehicle");
  return { ok: true, saved: true };
}

export async function createTripAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    await createTrip(parsed.value);
  } catch (e) {
    return failure(e);
  }
  revalidateAll("/trips");
  return { ok: true };
}

export async function updateTripAction(id: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    await updateTrip(id, parsed.value);
  } catch (e) {
    return failure(e);
  }
  revalidateAll("/trips");
  return { ok: true };
}

export async function deleteTripAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = idFrom(fd);
  if (id === null) return { ok: false, error: "Invalid trip." };
  try {
    await deleteTrip(id);
  } catch (e) {
    return failure(e);
  }
  revalidateAll("/trips");
  return { ok: true };
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
    return failure(e);
  }
  revalidateAll("/expenses");
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
    return failure(e);
  }
  revalidateAll("/expenses");
  return { ok: true };
}

export async function deleteExpenseAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = idFrom(fd);
  if (id === null) return { ok: false, error: "Invalid expense." };
  try {
    await deleteExpense(id);
  } catch (e) {
    return failure(e);
  }
  revalidateAll("/expenses");
  return { ok: true };
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
