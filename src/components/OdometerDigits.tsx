import { formatKm, odometerDigits } from "@/lib/format";

/** Boxed odometer digits ("0 8 4 3 1 2 km"), read out as a single number. */
export function OdometerDigits({ km }: { km: number }) {
  return (
    <div className="flex items-end gap-1" role="img" aria-label={`Odometer ${formatKm(km)} km`}>
      {odometerDigits(km).map((d, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="flex h-9 w-6.5 md:h-10.5 md:w-7.5 items-center justify-center rounded border border-line bg-bg font-mono text-xl md:text-[22px] font-semibold"
        >
          {d}
        </span>
      ))}
      <span aria-hidden="true" className="pl-1.5 text-[13px] text-muted">km</span>
    </div>
  );
}
