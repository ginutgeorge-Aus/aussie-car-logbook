import { APP_VERSION, BUILD_TIME, changelogUrl, formatUpdated, issueUrl } from "@/lib/about";

const linkCls = "text-sm underline text-accent-ink";

/** Settings "About" card: build version, last-updated date, changelog and issue links. */
export function AboutCard() {
  return (
    <section id="about" className="mt-10 border-t border-line pt-6">
      <h2 className="text-lg font-semibold mb-3">About</h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted">Version</dt>
        <dd>v{APP_VERSION}</dd>
        <dt className="text-muted">Updated</dt>
        <dd>{formatUpdated(BUILD_TIME)}</dd>
      </dl>
      <div className="mt-3 flex gap-6">
        <a href={changelogUrl()} target="_blank" rel="noopener noreferrer" className={linkCls}>
          Changelog
        </a>
        <a href={issueUrl(APP_VERSION)} target="_blank" rel="noopener noreferrer" className={linkCls}>
          Report an issue
        </a>
      </div>
    </section>
  );
}
