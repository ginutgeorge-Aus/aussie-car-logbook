import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listExpenses } from "@/lib/data/expense";
import { getSettings } from "@/lib/data/settings";
import { currentOdometer, fyBusinessPct, fyKmTotals, filterTripsByFy, tripsToLegs } from "@/lib/logbook/compute";
import { businessPct, gstCredit, annualDeduction, financialYear } from "@/lib/tax";
import { formatKm, formatMoney, formatMoneyWhole, fyShort } from "@/lib/format";
import { todayIso } from "@/lib/today";
import type { ExpenseCategory } from "@/lib/tax/types";
import { BusinessGauge } from "@/components/BusinessGauge";
import { OdometerDigits } from "@/components/OdometerDigits";
import { RecentTrips } from "@/components/TripList";
import { CameraIcon, PlusIcon } from "@/components/icons";
import { EmptyState, btnPrimary, btnSecondary, cardCls, eyebrowCls, pageCls } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Stat tile: whole dollars on phones, cents on desktop. `highlight` = amber deduction tile. */
function Stat({ label, cents, highlight = false, className = "" }: { label: string; cents: number; highlight?: boolean; className?: string }) {
  return (
    <div
      className={`flex flex-col gap-1.5 md:gap-2 rounded-xl md:rounded-[14px] border bg-surface p-3 md:p-4.5 ${
        highlight ? "md:border-accent border-line" : "border-line"
      } ${className}`}
    >
      <span className="text-xs md:text-[13px] text-muted">{label}</span>
      <span
        className={`font-mono font-semibold text-[17px] ${highlight ? "text-accent-ink md:text-[40px]" : "md:text-[28px]"} leading-tight`}
      >
        <span className="md:hidden">{formatMoneyWhole(cents)}</span>
        <span className="hidden md:inline">{formatMoney(cents)}</span>
      </span>
    </div>
  );
}

/** Dashboard: business-use gauge, odometer, FY estimates and recent trips (Odometer design). */
export default async function Home() {
  const vehicle = await getVehicle();

  if (!vehicle) {
    return (
      <main className={pageCls}>
        <h1 className="sr-only">Dashboard</h1>
        <p className="mb-6 font-mono text-sm font-semibold tracking-wide text-muted md:hidden">GINOO / LOGBOOK</p>
        <EmptyState
          title="Welcome to your log book"
          body="Add your car and its opening odometer to start logging trips and expenses."
          href="/vehicle"
          cta="Set up your car"
        />
      </main>
    );
  }

  const [trips, expenses, settings] = await Promise.all([listTrips(), listExpenses(), getSettings()]);
  const fyLabel = financialYear(todayIso()).label;
  const pct = fyBusinessPct(trips, fyLabel);
  const km = fyKmTotals(trips, fyLabel);
  const odo = currentOdometer(trips, vehicle.odoOpen);

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
  const recent = trips.slice(0, 5);
  const carName = `${vehicle.make} ${vehicle.model}${vehicle.rego ? ` · ${vehicle.rego}` : ""}`;
  const fyChip = `FY ${fyShort(fyLabel)}`;

  return (
    <main className={`${pageCls} grid gap-4.5 md:gap-5 md:grid-cols-2 content-start`}>
      <h1 className="sr-only">Dashboard</h1>
      {/* Phone-only top row: car + FY chip. */}
      <div className="flex items-center justify-between md:hidden">
        <Link href="/vehicle" className="flex min-h-11 items-center gap-2 text-[15px] font-medium text-ink">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
          {carName}
        </Link>
        <span className="rounded-md border border-line px-2 py-1.5 font-mono text-[13px] text-muted">{fyChip}</span>
      </div>

      <section aria-label="Business use" className={`${cardCls} flex flex-col items-center gap-1.5 px-5 pt-5 pb-4.5 md:p-6`}>
        <div className="hidden md:flex self-stretch items-center justify-between text-[13px] text-muted">
          <Link href="/vehicle" className="-my-3 flex min-h-11 items-center hover:text-ink">{carName}</Link>
          <span className="font-mono">{fyChip}</span>
        </div>
        <div className="md:mt-2">
          <BusinessGauge
            pct={pct}
            caption={
              km.totalKm > 0
                ? `business use · ${formatKm(km.businessKm)} of ${formatKm(km.totalKm)} km`
                : "business use this year · no trips yet"
            }
          />
        </div>
        {odo != null ? (
          <div className="mt-2.5 md:mt-3.5">
            <OdometerDigits km={odo} />
          </div>
        ) : null}
      </section>

      <section aria-label={`Estimates FY ${fyLabel}`} className="grid grid-cols-3 md:grid-cols-2 gap-2.5 md:gap-3 content-start">
        <Stat label="Expenses" cents={fyTotalCents} />
        <Stat label="GST credit" cents={gstCreditCents} />
        <Stat label="Deduction" cents={deductionCents} highlight className="md:col-span-2" />
        <p className="col-span-3 md:col-span-2 text-xs text-muted">
          Estimates for FY {fyLabel}. See Reports for the full breakdown.
        </p>
        <div className="hidden md:block md:col-span-2">
          <Link href="/expenses#add-expense" className={`${btnSecondary} w-full min-h-12`}>
            <CameraIcon size={18} />
            Scan a receipt
          </Link>
        </div>
      </section>

      <div className="md:hidden">
        <Link href="/trips#add-trip" className={`${btnPrimary} w-full min-h-14 rounded-[14px] text-[17px]`}>
          <PlusIcon size={22} />
          Log a trip
        </Link>
      </div>

      <section aria-labelledby="recent-h" className="md:col-span-full md:rounded-2xl md:border md:border-line md:bg-surface md:py-2">
        <div className="flex items-center justify-between md:px-5">
          <h2 id="recent-h" className={eyebrowCls}>Recent trips</h2>
          <Link href="/trips" className="flex min-h-11 items-center text-[15px] text-accent-ink hover:underline">
            All trips
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-6 text-sm text-muted md:px-5">No trips yet — log your first one to start the 12-week logbook.</p>
        ) : (
          <RecentTrips trips={recent} />
        )}
      </section>
    </main>
  );
}
