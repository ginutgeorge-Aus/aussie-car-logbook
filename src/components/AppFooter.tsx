import Link from "next/link";
import { APP_VERSION } from "@/lib/about";

/** Slim footer on every page: version + link to the About card in Settings. */
export function AppFooter() {
  return (
    <footer className="mt-auto px-8 py-4 text-center text-xs text-muted">
      v{APP_VERSION} ·{" "}
      <Link href="/settings#about" className="underline">
        About
      </Link>
    </footer>
  );
}
