import Link from "next/link";

/** Financial-year chips (scrolls sideways on narrow phones). Active FY is amber. */
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
    <nav aria-label="Financial year" className="fy-switcher -mx-5 px-5 md:mx-0 md:px-0 overflow-x-auto">
      <ul className="flex gap-2 w-max">
        {fyLabels.map((label) => {
          const isActive = label === active;
          return (
            <li key={label}>
              <Link
                href={`${basePath}?fy=${label}`}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg border px-3.5 font-mono text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-accent bg-accent text-on-accent font-semibold"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                FY {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
