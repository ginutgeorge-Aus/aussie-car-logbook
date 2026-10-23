import Link from "next/link";
import { notFound } from "next/navigation";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listLogbookPeriods } from "@/lib/data/logbookPeriod";
import { logbookPeriodBusinessPctBps, logbookPeriodUse, tripKm, tripsInPeriod } from "@/lib/logbook/compute";
import { formatBusinessPct, logbookFirstFy, logbookNominableFys } from "@/lib/tax";
import { formatKm, humanDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { NeedsVehicle, PageHeader, TripType, cardCls, eyebrowCls, pageCls } from "@/components/ui";

export const dynamic = "force-dynamic";

const ATO_URL =
  "https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses";

/** Printable summary of one logbook period: dates, odometers, km, business-use % and every journey. */
export default async function LogbookSummaryPage({ params }: PageProps<"/trips/logbook/[id]">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const vehicle = await getVehicle();
  if (!vehicle) return <NeedsVehicle />;

  const [trips, periods] = await Promise.all([listTrips(), listLogbookPeriods()]);
  const period = periods.find((p) => p.id === Number(id));
  if (!period) notFound();

  const use = logbookPeriodUse(trips, period);
  const bps = logbookPeriodBusinessPctBps(trips, period);
  const periodTrips = tripsInPeriod(trips, period).sort((a, b) => a.odoStart - b.odoStart);
  const crossesJune = logbookNominableFys(period).length > 1;
  const { odoStart, odoEnd } = period;
  const totalKm = odoStart != null && odoEnd != null ? odoEnd - odoStart : null;
  const notRecorded = <span className="text-muted">not recorded</span>;
  const cell = "border-b border-line px-3 py-2.5";

  const facts: [string, React.ReactNode][] = [
    ["Period", `${period.startDate} to ${period.endDate}`],
    ...(crossesJune ? [["Logbook is for", `FY ${logbookFirstFy(period)}`] as [string, React.ReactNode]] : []),
    ["Odometer at start", odoStart != null ? `${formatKm(odoStart)} km` : notRecorded],
    ["Odometer at end", odoEnd != null ? `${formatKm(odoEnd)} km` : notRecorded],
    ["Total km", totalKm !== null ? `${formatKm(totalKm)} km` : notRecorded],
    ["Business km", use.ok ? `${formatKm(use.businessKm)} km` : notRecorded],
    ["Business use", bps !== null ? `${formatBusinessPct(bps)}%` : notRecorded],
  ];

  return (
    <main className={`${pageCls} flex flex-col gap-5`}>
      <Link href="/trips" className="no-print text-sm text-accent-ink underline underline-offset-2">Back to Trips</Link>
      <PageHeader title="Logbook summary">
        <PrintButton />
      </PageHeader>

      <p className="text-[15px]">
        {vehicle.make} {vehicle.model}
        {vehicle.rego ? <span className="font-mono"> · {vehicle.rego}</span> : null}
      </p>

      {!use.ok && use.kind === "invalid" ? (
        <p role="alert" className="font-medium text-danger">Logbook not valid: {use.reason}.</p>
      ) : null}
      {!use.ok && use.kind === "no-trips" ? <p className="text-sm text-muted">No trips recorded in this period.</p> : null}

      <dl className={`${cardCls} grid grid-cols-1 gap-x-8 gap-y-2 p-4 sm:grid-cols-2`}>
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-[15px]">
            <dt className="text-muted">{label}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Journeys" className="flex flex-col gap-2">
        <h2 className={eyebrowCls}>Journeys</h2>
        {periodTrips.length === 0 ? (
          <p className="text-sm text-muted">No journeys recorded.</p>
        ) : (
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="text-xs uppercase tracking-[0.05em] text-muted">
                <th scope="col" className={`${cell} font-medium`}>Date</th>
                <th scope="col" className={`${cell} text-right font-medium`}>Start odometer</th>
                <th scope="col" className={`${cell} text-right font-medium`}>End odometer</th>
                <th scope="col" className={`${cell} text-right font-medium`}>km</th>
                <th scope="col" className={`${cell} font-medium`}>Type</th>
                <th scope="col" className={`${cell} font-medium`}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {periodTrips.map((t) => (
                <tr key={t.id}>
                  <th scope="row" className={`${cell} font-normal`}>
                    {t.endDate ? `${humanDate(t.date)} – ${humanDate(t.endDate, { withYear: true })}` : humanDate(t.date, { withYear: true })}
                  </th>
                  <td className={`${cell} text-right font-mono`}>{formatKm(t.odoStart)}</td>
                  <td className={`${cell} text-right font-mono`}>{formatKm(t.odoEnd)}</td>
                  <td className={`${cell} text-right font-mono`}>{formatKm(tripKm(t))}</td>
                  <td className={cell}><TripType isBusiness={t.isBusiness} /></td>
                  <td className={cell}>{t.purpose || <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="pb-8 text-xs text-muted">
        Prepared under the ATO logbook method: <a href={ATO_URL} className="break-all underline">{ATO_URL}</a>
      </p>
    </main>
  );
}
