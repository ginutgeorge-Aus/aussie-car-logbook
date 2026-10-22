import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listLogbookPeriods } from "@/lib/data/logbookPeriod";
import { filterTripsByFy, fyKmTotals, logbookFyLabels, logbookPeriodBusinessPctBps, resolveBusinessUse } from "@/lib/logbook/compute";
import { businessPctBps, financialYear, formatBusinessPct, fyLabelOr, logbookValidity } from "@/lib/tax";
import { todayIso } from "@/lib/today";
import { formatKm } from "@/lib/format";
import { FySwitcher } from "@/components/FySwitcher";
import { TripForm } from "@/components/TripForm";
import { TripRow } from "@/components/TripRow";
import { LogbookPeriodForm, LogbookPeriodItem } from "@/components/LogbookPeriods";
import { EmptyState, NeedsVehicle, PageHeader, cardCls, eyebrowCls, pageCls } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Trips: FY switcher, business use (logbook-based), logbook periods, add form, and trips as cards (phone) / table (desktop). */
export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  const vehicle = await getVehicle();
  if (!vehicle) return <NeedsVehicle />;

  const [trips, periods] = await Promise.all([listTrips(), listLogbookPeriods()]);
  const today = todayIso();
  const currentFy = financialYear(today).label;
  const sp = await searchParams;
  const activeFy = fyLabelOr(sp.fy, currentFy);

  const fyLabels = Array.from(new Set([currentFy, ...trips.map((t) => financialYear(t.date).label), ...logbookFyLabels(periods, currentFy)])).sort((a, b) => b.localeCompare(a));
  const fyTrips = filterTripsByFy(trips, activeFy);
  const km = fyKmTotals(trips, activeFy);
  const businessUse = resolveBusinessUse({ trips, periods, fyLabel: activeFy, today });
  const pct = formatBusinessPct(businessPctBps(businessUse.ratio));
  const periodViews = periods.map((p) => {
    const { firstFy, lastFy } = logbookValidity(p);
    return {
      id: p.id,
      startDate: p.startDate,
      endDate: p.endDate,
      validity: `FY ${firstFy} to ${lastFy}`,
      businessPct: (() => {
        const bps = logbookPeriodBusinessPctBps(trips, p);
        return bps === null ? null : formatBusinessPct(bps);
      })(),
    };
  });

  return (
    <main className={`${pageCls} flex flex-col gap-5`}>
      <div>
        <PageHeader title="Trips" />
        <FySwitcher fyLabels={fyLabels} active={activeFy} basePath="/trips" />
      </div>

      <div>
        <p className="text-[15px] text-muted">
          Business use FY {activeFy}:{" "}
          <span className="font-mono text-lg font-semibold text-accent-ink">{pct}%</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {businessUse.source.kind === "logbook"
            ? `From logbook period ${businessUse.source.startDate} to ${businessUse.source.endDate}.`
            : `No valid logbook period covers FY ${activeFy} — estimated from this FY's trips.`}
          <span className="font-mono"> · FY trips {formatKm(km.businessKm)} of {formatKm(km.totalKm)} km business</span>
        </p>
      </div>

      <section aria-label="Logbook periods" className="flex flex-col gap-2">
        <h2 className={eyebrowCls}>Logbook periods</h2>
        <p className="text-sm text-muted">
          Keep a logbook for at least 12 continuous weeks. It sets your business-use % for the FY it&apos;s for and the
          next 4 FYs. A logbook that crosses 30 June can be for either FY — you choose.
        </p>
        <LogbookPeriodForm />
        {periodViews.length > 0 && (
          <ul className={`${cardCls} px-4`}>
            {periodViews.map((p) => <LogbookPeriodItem key={p.id} period={p} />)}
          </ul>
        )}
      </section>

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
