const R = 96;
const ARC = Math.PI * R;

/**
 * Semicircle business-use gauge (Odometer mockup). `pct` is a whole percentage
 * 0–100; the amber arc length is proportional to it. Purely presentational —
 * the number comes from the tax engine.
 */
export function BusinessGauge({ pct, caption }: { pct: number; caption: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const filled = (clamped / 100) * ARC;
  return (
    <figure className="flex flex-col items-center gap-1">
      <div className="relative w-60 md:w-70 aspect-[240/130]">
        <svg viewBox="0 0 240 130" className="size-full" aria-hidden="true">
          <path d="M24 114 A96 96 0 0 1 216 114" fill="none" stroke="var(--line)" strokeWidth="14" strokeLinecap="round" />
          {clamped > 0 ? (
            <path
              d="M24 114 A96 96 0 0 1 216 114"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${ARC}`}
            />
          ) : null}
        </svg>
        <p className="absolute inset-x-0 bottom-1 text-center font-mono text-[52px] md:text-[60px] font-semibold leading-none tracking-[-0.03em]">
          {clamped}
          <span className="text-[26px] md:text-[28px] text-muted">%</span>
        </p>
      </div>
      <figcaption className="text-sm text-muted text-center">{caption}</figcaption>
    </figure>
  );
}
