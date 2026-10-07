"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { btnPrimary, btnSecondary, cardCls, pageCls } from "@/components/ui";

/** App-wide error boundary: shows a friendly message instead of a blank page. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={pageCls}>
      <div className={`${cardCls} px-6 py-10 text-center`}>
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="mb-6 text-muted">Your data is safe. Try again, or go back to the dashboard.</p>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={() => retry()} className={btnPrimary}>
            Try again
          </button>
          <Link href="/" className={btnSecondary}>Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
