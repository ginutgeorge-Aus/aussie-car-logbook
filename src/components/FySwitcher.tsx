import Link from "next/link";

export function FySwitcher({
  fyLabels,
  active,
  basePath = "/trips",
}: {
  fyLabels: string[];
  active: string;
  basePath?: string;
}) {
  return (
    <div className="flex gap-2 flex-wrap fy-switcher">
      {fyLabels.map((label) => (
        <Link
          key={label}
          href={`${basePath}?fy=${label}`}
          className={`rounded px-3 py-1 text-sm border ${label === active ? "bg-black text-white" : ""}`}
        >
          FY {label}
        </Link>
      ))}
    </div>
  );
}
