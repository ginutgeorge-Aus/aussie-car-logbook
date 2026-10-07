import Link from "next/link";

/**
 * Shared Odometer UI primitives: class strings for controls (so client forms
 * and server pages style identically) plus small layout components.
 */

/** Primary amber button / link, ≥44px tall. */
export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none";

/** Secondary outlined button / link, ≥44px tall. */
export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-[15px] font-medium text-ink transition-colors hover:border-muted disabled:opacity-50 disabled:pointer-events-none";

/** Compact text button for row actions (still a 44px hit area). */
export const btnGhost =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-accent-ink hover:bg-rule disabled:opacity-50";

/** Destructive text button for row actions. */
export const btnDanger =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-danger hover:bg-rule disabled:opacity-50";

/** Text input / select, 44px tall, 16px text (stops iOS zoom-on-focus). */
export const inputCls =
  "min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60";

/** Field label text. */
export const labelCls = "text-sm font-medium text-muted";

/** Card surface. */
export const cardCls = "rounded-2xl border border-line bg-surface";

/** Uppercase section eyebrow, as in the mockups ("RECENT"). */
export const eyebrowCls = "text-[13px] font-medium uppercase tracking-[0.06em] text-muted";

/** Page container: phone gutter 20px, desktop 32px, 1200px max. */
export const pageCls = "w-full max-w-[1200px] mx-auto px-5 md:px-8 pt-5 md:pt-7";

/** Page title row: heading on the left, optional actions on the right. */
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

/** Friendly empty/onboarding state with an optional call-to-action link. */
export function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className={`${cardCls} border-dashed px-6 py-10 text-center`}>
      <p className="text-lg font-medium">{title}</p>
      {body ? <p className="mt-1 text-sm text-muted">{body}</p> : null}
      {href && cta ? (
        <Link href={href} className={`${btnPrimary} mt-5`}>
          {cta}
        </Link>
      ) : null}
    </div>
  );
}

/** Business/Private marker dot + label (amber = business, slate = private). */
export function TripType({ isBusiness }: { isBusiness: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <span aria-hidden="true" className={`size-2 rounded-full ${isBusiness ? "bg-accent" : "bg-private"}`} />
      {isBusiness ? "Business" : "Private"}
    </span>
  );
}

/** "Set up your car first" gate shown on pages that need a vehicle. */
export function NeedsVehicle() {
  return (
    <main className={pageCls}>
      <EmptyState
        title="Set up your car first"
        body="Add your car and its opening odometer, then you can log trips and expenses."
        href="/vehicle"
        cta="Set up your car"
      />
    </main>
  );
}
