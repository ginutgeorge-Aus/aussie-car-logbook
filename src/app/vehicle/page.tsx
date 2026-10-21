import { getVehicle } from "@/lib/data/vehicle";
import { VehicleForm } from "@/components/VehicleForm";
import { PageHeader, cardCls, pageBase } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Vehicle: set up or edit the single car this log book tracks. */
export default async function VehiclePage() {
  const vehicle = await getVehicle();
  return (
    <main className={`${pageBase} max-w-xl`}>
      <PageHeader title={vehicle ? "Vehicle" : "Set up your car"} />
      <div className={`${cardCls} p-4 md:p-6`}>
        <VehicleForm vehicle={vehicle} />
      </div>
    </main>
  );
}
