import { getVehicle } from "@/lib/data/vehicle";
import { VehicleForm } from "@/components/VehicleForm";

export const dynamic = "force-dynamic";

export default async function VehiclePage() {
  const vehicle = await getVehicle();
  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">{vehicle ? "Edit vehicle" : "Set up your car"}</h1>
      <VehicleForm vehicle={vehicle} />
    </main>
  );
}
