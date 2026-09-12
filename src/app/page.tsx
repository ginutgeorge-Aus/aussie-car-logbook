import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { fyBusinessPct } from "@/lib/logbook/compute";
import { financialYear } from "@/lib/tax";

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

  const trips = await listTrips();
  const fyLabel = financialYear(new Date().toISOString().slice(0, 10)).label;
  const pct = fyBusinessPct(trips, fyLabel);

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
      <Link href="/trips" className="rounded bg-black text-white px-4 py-2">Manage trips</Link>
    </main>
  );
}
