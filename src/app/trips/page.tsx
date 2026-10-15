import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { filterTripsByFy, fyBusinessPct, fyKmTotals } from "@/lib/logbook/compute";
import { financialYear } from "@/lib/tax";
import { todayIso } from "@/lib/today";
import { formatKm } from "@/lib/format";
import { FySwitcher } from "@/components/FySwitcher";
import { TripForm } from "@/components/TripForm";
import { TripRow } from "@/components/TripRow";
import { EmptyState, NeedsVehicle, PageHeader, cardCls, pageCls } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Trips: FY switcher, business-use summary, add form, and trips as cards (phone) / table (desktop). */
export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  const vehicle = await getVehicle();
  if (!vehicle) return <NeedsVehicle />;

  const trips = await listTrips();
  const currentFy = financialYear(todayIso()).label;
  const sp = await searchParams;
  const activeFy = typeof sp.fy === "string" ? sp.fy : currentFy;

  const fyLabels = Array.from(new Set([currentFy, ...trips.map((t) => financialYear(t.date).label)])).sort().reverse();
  const fyTrips = filterTripsByFy(trips, activeFy);
  const pct = fyBusinessPct(trips, activeFy);
  const km = fyKmTotals(trips, activeFy);

  return (
    <main className={`${pageCls} flex flex-col gap-5`}>
      <div>
        <PageHeader title="Trips" />
        <FySwitcher fyLabels={fyLabels} active={activeFy} basePath="/trips" />
      </div>

      <p className="text-[15px] text-muted">
        Business use FY {activeFy}:{" "}
        <span className="font-mono text-lg font-semibold text-accent-ink">{pct}%</span>
        <span className="font-mono text-sm"> · {formatKm(km.businessKm)} of {formatKm(km.totalKm)} km</span>
      </p>

      <TripForm />

      {fyTrips.length === 0 ? (
        <EmptyState title={`No trips in FY ${activeFy} yet`} body="Log a trip above — start and end odometer, and whether it was for work." />
      ) : (
        <section aria-label={`Trips FY ${activeFy}`}>
          <ul className="md:hidden">
            {fyTrips.map((t) => <TripRow key={t.id} trip={t} variant="card" />)}
          </ul>
          <div className={`${cardCls} hidden md:block overflow-x-auto py-2`}>
            <table className="w-full min-w-170 border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.05em] text-muted">
                  <th className="border-b border-line px-5 py-2.5 font-medium">Date</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium">Purpose</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium">Odometer</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium text-right">km</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium">Type</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {fyTrips.map((t) => <TripRow key={t.id} trip={t} variant="row" />)}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
