"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

/** App-wide error boundary: shows a friendly message instead of a blank page. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="w-full max-w-3xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
      <p className="mb-6 text-zinc-600">Your data is safe. Try again, or go back to the dashboard.</p>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={() => retry()} className="rounded bg-black text-white px-4 py-2">
          Try again
        </button>
        <Link href="/" className="rounded border px-4 py-2">Dashboard</Link>
      </div>
    </main>
  );
}
