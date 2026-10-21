import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listLogbookPeriods } from "@/lib/data/logbookPeriod";
import { filterTripsByFy, logbookFyLabels, logbookPeriodBusinessPct, resolveBusinessUse } from "@/lib/logbook/compute";
import { financialYear, logbookValidity } from "@/lib/tax";
import { todayIso } from "@/lib/today";
import { FySwitcher } from "@/components/FySwitcher";
import { TripForm } from "@/components/TripForm";
import { TripRow } from "@/components/TripRow";
import { LogbookPeriodForm, LogbookPeriodItem } from "@/components/LogbookPeriods";

export const dynamic = "force-dynamic";

/** Trips page: FY business use (logbook-based), logbook periods, and the FY trip list. */
export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  const vehicle = await getVehicle();
  if (!vehicle) {
    return (
      <main className="w-full max-w-3xl mx-auto p-8 text-center">
        <p className="mb-4 text-zinc-600">Set up your car first.</p>
        <Link href="/vehicle" className="rounded bg-black text-white px-4 py-2">Set up your car</Link>
      </main>
    );
  }

  const [trips, periods] = await Promise.all([listTrips(), listLogbookPeriods()]);
  const today = todayIso();
  const currentFy = financialYear(today).label;
  const sp = await searchParams;
  const activeFy = typeof sp.fy === "string" ? sp.fy : currentFy;

  const fyLabels = Array.from(new Set([currentFy, ...trips.map((t) => financialYear(t.date).label), ...logbookFyLabels(periods, currentFy)])).sort((a, b) => b.localeCompare(a));
  const fyTrips = filterTripsByFy(trips, activeFy);
  const businessUse = resolveBusinessUse({ trips, periods, fyLabel: activeFy, today });
  const pct = Math.round(businessUse.ratio * 100);
  const periodViews = periods.map((p) => {
    const { firstFy, lastFy } = logbookValidity(p.startDate);
    return {
      id: p.id,
      startDate: p.startDate,
      endDate: p.endDate,
      validity: `FY ${firstFy} to ${lastFy}`,
      businessPct: logbookPeriodBusinessPct(trips, p),
    };
  });

  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <Link href="/" className="text-sm underline">Dashboard</Link>
      </div>
      <FySwitcher fyLabels={fyLabels} active={activeFy} basePath="/trips" />
      <p className="mt-4 text-sm text-zinc-600">Business use — FY {activeFy}: <span className="font-semibold">{pct}%</span></p>
      <p className="mb-4 text-xs text-zinc-500">
        {businessUse.source.kind === "logbook"
          ? `From logbook period ${businessUse.source.startDate} to ${businessUse.source.endDate}.`
          : `No valid logbook period covers FY ${activeFy} — estimated from this FY's trips.`}
      </p>

      <section className="mb-6">
        <h2 className="font-medium mb-1">Logbook periods</h2>
        <p className="mb-2 text-xs text-zinc-500">
          Keep a logbook for at least 12 continuous weeks. It sets your business-use % for the FY it starts in and the
          next 4 FYs.
        </p>
        <LogbookPeriodForm />
        {periodViews.length > 0 && (
          <ul className="mt-2">
            {periodViews.map((p) => <LogbookPeriodItem key={p.id} period={p} />)}
          </ul>
        )}
      </section>

      <TripForm />
      {fyTrips.length === 0 ? (
        <p className="mt-6 text-zinc-600">No trips in FY {activeFy} yet.</p>
      ) : (
        <table className="mt-6 w-full text-left">
          <thead>
            <tr className="border-b text-sm text-zinc-500">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Distance</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Purpose</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fyTrips.map((t) => <TripRow key={t.id} trip={t} />)}
          </tbody>
        </table>
      )}
    </main>
  );
}
