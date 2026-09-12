import Link from "next/link";

export function FySwitcher({ fyLabels, active }: { fyLabels: string[]; active: string }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {fyLabels.map((label) => (
        <Link
          key={label}
          href={`/trips?fy=${label}`}
          className={`rounded px-3 py-1 text-sm border ${label === active ? "bg-black text-white" : ""}`}
        >
          FY {label}
        </Link>
      ))}
    </div>
  );
}
