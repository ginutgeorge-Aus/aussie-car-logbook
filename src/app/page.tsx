import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listExpenses } from "@/lib/data/expense";
import { getSettings } from "@/lib/data/settings";
import { listLogbookPeriods } from "@/lib/data/logbookPeriod";
import { filterTripsByFy } from "@/lib/logbook/compute";
import { financialYear, formatBusinessPct } from "@/lib/tax";
import { buildFyReport } from "@/lib/reports/build";
import { centsToDollars } from "@/lib/logbook/parse";
import { todayIso } from "@/lib/today";

export const dynamic = "force-dynamic";

/** Dashboard: vehicle, current-FY business use (logbook-based) and running estimates. */
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

  const [trips, expenses, settings, periods] = await Promise.all([
    listTrips(),
    listExpenses(),
    getSettings(),
    listLogbookPeriods(),
  ]);
  const today = todayIso();
  const fyLabel = financialYear(today).label;
  // Same figures as /reports: one rounding, GST credit only when registered, depreciation included.
  const report = buildFyReport({ trips, expenses, vehicle, settings, logbookPeriods: periods, fyLabel, today });
  const source = report.businessUseSource;
  const pct = formatBusinessPct(report.businessPctBps);
  const fyTotalCents = filterTripsByFy(expenses, fyLabel).reduce((s, e) => s + e.amountInclCents, 0);
  const gstCreditCents = report.bas.totalGstCreditCents;
  const deductionCents = report.annual.totalDeductionCents;

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
        <p className="text-xs text-zinc-500">
          {source.kind === "logbook"
            ? `From logbook period ${source.startDate} to ${source.endDate}`
            : "No valid logbook yet — estimated from this FY's trips"}
        </p>
      </section>
      <section className="rounded border p-4 mb-6">
        <p className="text-sm text-zinc-600 mb-2">Estimates — FY {fyLabel}</p>
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs text-zinc-500">Total expenses</p>
            <p className="text-2xl font-semibold">${centsToDollars(fyTotalCents)}</p>
          </div>
          {settings.gstRegistered ? (
            <div>
              <p className="text-xs text-zinc-500">GST credit (BAS)</p>
              <p className="text-2xl font-semibold">${centsToDollars(gstCreditCents)}</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 self-center">Not GST-registered — no BAS credits</p>
          )}
          <div>
            <p className="text-xs text-zinc-500">Income-tax deduction</p>
            <p className="text-2xl font-semibold">${centsToDollars(deductionCents)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Estimate only — same figures as Reports, which has the breakdown.</p>
      </section>
      <div className="flex gap-3 flex-wrap">
        <Link href="/trips" className="rounded bg-black text-white px-4 py-2">Manage trips</Link>
        <Link href="/expenses" className="rounded bg-black text-white px-4 py-2">Manage expenses</Link>
        <Link href="/reports" className="rounded bg-black text-white px-4 py-2">Reports</Link>
        <Link href="/settings" className="rounded border px-4 py-2">Settings</Link>
      </div>
    </main>
  );
}
