import { getVehicle } from "@/lib/data/vehicle";
import { listVehicleFyOdometers } from "@/lib/data/vehicleFyOdometer";
import { VehicleForm } from "@/components/VehicleForm";
import { VehicleFyOdometers } from "@/components/VehicleFyOdometers";
import { PageHeader, cardCls, pageBase } from "@/components/ui";
import { financialYear } from "@/lib/tax";
import { todayIso } from "@/lib/today";

export const dynamic = "force-dynamic";

/** How many income years (current + previous) the yearly-odometer picker offers. */
const FY_OPTION_COUNT = 5;

/** Vehicle: set up or edit the single car this log book tracks, plus its yearly odometer readings. */
export default async function VehiclePage() {
  const vehicle = await getVehicle();
  const rows = vehicle ? await listVehicleFyOdometers() : [];
  const currentFy = financialYear(todayIso()).label;
  const currentStart = Number(currentFy.slice(0, 4));
  const fyOptions = Array.from(
    new Set([
      ...Array.from({ length: FY_OPTION_COUNT }, (_, i) => financialYear(`${currentStart - i}-07-01`).label),
      ...rows.map((r) => r.fyLabel),
    ]),
  ).sort((a, b) => b.localeCompare(a));
  return (
    <main className={`${pageBase} max-w-xl flex flex-col gap-5`}>
      <PageHeader title={vehicle ? "Vehicle" : "Set up your car"} />
      <div className={`${cardCls} p-4 md:p-6`}>
        <VehicleForm vehicle={vehicle} />
      </div>
      {vehicle && (
        <div className={`${cardCls} p-4 md:p-6`}>
          <VehicleFyOdometers rows={rows} fyOptions={fyOptions} defaultFy={currentFy} />
        </div>
      )}
    </main>
  );
}
