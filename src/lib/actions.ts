"use server";

import { revalidatePath } from "next/cache";
import { parseVehicleForm, parseTripForm } from "@/lib/logbook/parse";
import { upsertVehicle } from "@/lib/data/vehicle";
import { createTrip, updateTrip, deleteTrip } from "@/lib/data/trip";
import type { ActionResult } from "@/lib/logbook/types";

export async function saveVehicleAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseVehicleForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  await upsertVehicle(parsed.value);
  revalidatePath("/");
  revalidatePath("/vehicle");
  return { ok: true };
}

export async function createTripAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  await createTrip(parsed.value);
  revalidatePath("/trips");
  revalidatePath("/");
  return { ok: true };
}

export async function updateTripAction(id: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = parseTripForm(fd);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  await updateTrip(id, parsed.value);
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
