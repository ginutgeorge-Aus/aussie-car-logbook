import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { filterTripsByFy, fyBusinessPct } from "@/lib/logbook/compute";
import { financialYear } from "@/lib/tax";
import { todayIso } from "@/lib/today";
import { FySwitcher } from "@/components/FySwitcher";
import { TripForm } from "@/components/TripForm";
import { TripRow } from "@/components/TripRow";

export const dynamic = "force-dynamic";

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

  const trips = await listTrips();
  const currentFy = financialYear(todayIso()).label;
  const sp = await searchParams;
  const activeFy = typeof sp.fy === "string" ? sp.fy : currentFy;

  const fyLabels = Array.from(new Set([currentFy, ...trips.map((t) => financialYear(t.date).label)])).sort().reverse();
  const fyTrips = filterTripsByFy(trips, activeFy);
  const pct = fyBusinessPct(trips, activeFy);

  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <Link href="/" className="text-sm underline">Dashboard</Link>
      </div>
      <FySwitcher fyLabels={fyLabels} active={activeFy} basePath="/trips" />
      <p className="my-4 text-sm text-zinc-600">Business use — FY {activeFy}: <span className="font-semibold">{pct}%</span></p>
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
