import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listExpenses } from "@/lib/data/expense";
import { getSettings } from "@/lib/data/settings";
import { fyBusinessPct, filterTripsByFy, tripsToLegs } from "@/lib/logbook/compute";
import { businessPct, gstCredit, annualDeduction, financialYear } from "@/lib/tax";
import { centsToDollars } from "@/lib/logbook/parse";
import { todayIso } from "@/lib/today";
import type { ExpenseCategory } from "@/lib/tax/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const vehicle = await getVehicle();

  if (!vehicle) {
    return (
      <main className="w-full max-w-3xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-semibold mb-4">Ginoo&apos;s Log Book</h1>
        <p className="mb-6 text-zinc-600">No car set up yet.</p>
        <Link href="/vehicle" className="rounded bg-black text-white px-4 py-2">Set up your car</Link>
      </main>
    );
  }

  const [trips, expenses, settings] = await Promise.all([listTrips(), listExpenses(), getSettings()]);
  const fyLabel = financialYear(todayIso()).label;
  const pct = fyBusinessPct(trips, fyLabel);

  const ratio = businessPct(tripsToLegs(filterTripsByFy(trips, fyLabel)));
  const fyExpenses = filterTripsByFy(expenses, fyLabel).map((e) => ({
    amountInclCents: e.amountInclCents,
    gstCents: e.gstCents,
    dateISO: e.date,
    category: e.category as ExpenseCategory,
  }));
  const fyTotalCents = fyExpenses.reduce((s, e) => s + e.amountInclCents, 0);
  const gstCreditCents = gstCredit(fyExpenses, ratio);
  const deductionCents = annualDeduction(fyExpenses, ratio, settings.gstRegistered);

  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-semibold mb-6">Ginoo&apos;s Log Book</h1>
      <section className="rounded border p-4 mb-6">
        <h2 className="font-medium">{vehicle.make} {vehicle.model} {vehicle.rego ? `· ${vehicle.rego}` : ""}</h2>
        <p className="text-sm text-zinc-600">Opening odometer: {vehicle.odoOpen ?? "—"} km</p>
        <Link href="/vehicle" className="text-sm underline">Edit vehicle</Link>
      </section>
      <section className="rounded border p-4 mb-6">
        <p className="text-sm text-zinc-600">Business use — FY {fyLabel}</p>
        <p className="text-4xl font-semibold">{pct}%</p>
      </section>
      <section className="rounded border p-4 mb-6">
        <p className="text-sm text-zinc-600 mb-2">Estimates — FY {fyLabel}</p>
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs text-zinc-500">Total expenses</p>
            <p className="text-2xl font-semibold">${centsToDollars(fyTotalCents)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">GST credit (BAS)</p>
            <p className="text-2xl font-semibold">${centsToDollars(gstCreditCents)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Income-tax deduction</p>
            <p className="text-2xl font-semibold">${centsToDollars(deductionCents)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Estimate only — full reports come later.</p>
      </section>
      <div className="flex gap-3">
        <Link href="/trips" className="rounded bg-black text-white px-4 py-2">Manage trips</Link>
        <Link href="/expenses" className="rounded bg-black text-white px-4 py-2">Manage expenses</Link>
      </div>
    </main>
  );
}
