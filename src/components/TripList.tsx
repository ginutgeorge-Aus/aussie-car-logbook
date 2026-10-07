import { tripKm } from "@/lib/logbook/compute";
import { formatKm, humanDate } from "@/lib/format";
import { TripType } from "@/components/ui";
import type { TripRow } from "@/lib/logbook/types";

/** Read-only recent trips: compact cards on phones, a table with odometer readings on desktop. */
export function RecentTrips({ trips }: { trips: TripRow[] }) {
  return (
    <>
      <ul className="md:hidden">
        {trips.map((t) => (
          <li key={t.id} className="flex min-h-13 items-center gap-3 border-b border-rule">
            <span aria-hidden="true" className={`h-7 w-1 rounded-sm ${t.isBusiness ? "bg-accent" : "bg-private"}`} />
            <div className="flex min-w-0 grow flex-col gap-0.5 py-2">
              <span className="truncate text-[15px]">{t.purpose || (t.isBusiness ? "Business trip" : "Private trip")}</span>
              <span className="text-xs text-muted">
                {humanDate(t.date)} · {t.isBusiness ? "Business" : "Private"}
              </span>
            </div>
            <span className="font-mono text-[15px] font-medium whitespace-nowrap">{formatKm(tripKm(t))} km</span>
          </li>
        ))}
      </ul>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-155 border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.05em] text-muted">
              <th className="border-b border-line px-5 py-2.5 font-medium">Date</th>
              <th className="border-b border-line px-3 py-2.5 font-medium">Purpose</th>
              <th className="border-b border-line px-3 py-2.5 font-medium">Odometer</th>
              <th className="border-b border-line px-3 py-2.5 font-medium text-right">km</th>
              <th className="border-b border-line px-5 py-2.5 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id}>
                <td className="border-b border-rule px-5 py-3 whitespace-nowrap text-nav-ink">{humanDate(t.date)}</td>
                <td className="border-b border-rule px-3 py-3">{t.purpose ?? ""}</td>
                <td className="border-b border-rule px-3 py-3 font-mono text-sm text-muted whitespace-nowrap">
                  {formatKm(t.odoStart)} → {formatKm(t.odoEnd)}
                </td>
                <td className="border-b border-rule px-3 py-3 text-right font-mono">{formatKm(tripKm(t))}</td>
                <td className="border-b border-rule px-5 py-3"><TripType isBusiness={t.isBusiness} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
