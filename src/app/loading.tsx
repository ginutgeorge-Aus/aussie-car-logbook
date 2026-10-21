import { cardCls, pageCls } from "@/components/ui";

/** Route-level loading skeleton shown while a page's D1 queries resolve. */
export default function Loading() {
  return (
    <main className={`${pageCls} flex flex-col gap-4`} aria-busy="true">
      <p className="sr-only" role="status">Loading…</p>
      <div className="h-8 w-40 rounded-lg bg-surface animate-pulse" />
      <div className={`${cardCls} h-56 animate-pulse`} />
      <div className="grid grid-cols-3 gap-2.5">
        <div className={`${cardCls} h-18 animate-pulse`} />
        <div className={`${cardCls} h-18 animate-pulse`} />
        <div className={`${cardCls} h-18 animate-pulse`} />
      </div>
      <div className={`${cardCls} h-40 animate-pulse`} />
    </main>
  );
}
