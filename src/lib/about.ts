/**
 * About-card helpers: version/build constants inlined at build by next.config.ts,
 * plus pure URL and date formatters. No I/O.
 */

/** Upstream repo that releases and issues live in. */
export const REPO_URL = "https://github.com/ginutgeorge-Aus/aussie-car-logbook";

/** App version from package.json, inlined at build ("dev" if unset). */
export const APP_VERSION = process.env.APP_VERSION ?? "dev";

/** ISO timestamp of the `next build` run (the deploy time of this copy). */
export const BUILD_TIME = process.env.BUILD_TIME;

/** Releases page (the changelog). */
export function changelogUrl(): string {
  return `${REPO_URL}/releases`;
}

/** New-issue URL that pre-fills the bug form's `version` field. */
export function issueUrl(version: string): string {
  return `${REPO_URL}/issues/new?template=bug_report.yml&version=${encodeURIComponent(`v${version}`)}`;
}

/** Formats an ISO timestamp as "24 Oct 2026" in Sydney time; "unknown" if missing/invalid. */
export function formatUpdated(iso: string | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(d);
}
