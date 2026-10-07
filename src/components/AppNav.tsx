"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExpensesIcon, HomeIcon, PlusIcon, ReportsIcon, SettingsIcon, TripsIcon } from "@/components/icons";

/** Desktop top-nav items (the phone tab bar folds Vehicle under Settings). */
const DESKTOP_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/trips", label: "Trips" },
  { href: "/expenses", label: "Expenses" },
  { href: "/reports", label: "Reports" },
  { href: "/vehicle", label: "Vehicle" },
  { href: "/settings", label: "Settings" },
] as const;

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon, also: [] as string[] },
  { href: "/trips", label: "Trips", Icon: TripsIcon, also: [] },
  { href: "/expenses", label: "Expenses", Icon: ExpensesIcon, also: [] },
  { href: "/reports", label: "Reports", Icon: ReportsIcon, also: [] },
  { href: "/settings", label: "Settings", Icon: SettingsIcon, also: ["/vehicle"] },
] as const;

/** True when `pathname` is `href` or a sub-route of it ("/" only matches exactly). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * App shell navigation: a top bar with text links on desktop (≥md) and a fixed,
 * safe-area-aware 5-tab bar on phones. Hidden when printing.
 */
export function AppNav() {
  const pathname = usePathname() ?? "/";

  return (
    <>
      <header className="no-print hidden md:flex flex-wrap items-center gap-x-6 gap-y-2 px-8 min-h-16 border-b border-line bg-nav">
        <Link href="/" className="font-mono text-base font-semibold tracking-wide pr-4 text-ink">
          GINOO / LOGBOOK
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-1 grow">
          {DESKTOP_ITEMS.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`min-h-11 flex items-center px-3.5 text-[15px] transition-colors ${
                  active
                    ? "font-medium text-accent-ink shadow-[inset_0_-2px_0_var(--accent)]"
                    : "text-nav-ink hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/trips#add-trip"
          className="min-h-11 flex items-center gap-2 px-4.5 rounded-[10px] bg-accent text-on-accent text-[15px] font-semibold hover:bg-accent-hover transition-colors"
        >
          <PlusIcon size={18} />
          Log a trip
        </Link>
      </header>

      <nav
        aria-label="Main"
        className="no-print md:hidden fixed inset-x-0 bottom-0 z-40 bg-nav border-t border-line pb-safe"
      >
        <ul className="grid grid-cols-5 h-(--tabbar-h) px-1 pt-1.5">
          {TABS.map(({ href, label, Icon, also }) => {
            const active = isActive(pathname, href) || also.some((p) => isActive(pathname, p));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 min-h-11 text-[11px] font-medium ${
                    active ? "text-accent-ink" : "text-muted"
                  }`}
                >
                  <Icon size={26} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
