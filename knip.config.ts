import type { KnipConfig } from "knip"

const config: KnipConfig = {
  // Loaded by the @opennextjs/cloudflare CLI, not imported.
  entry: ["open-next.config.ts"],
  // Next.js, Vitest and Drizzle plugins auto-discover their own entries.
  // Exports used inside their own file (e.g. CAR_LIMIT_CENTS) are public tax-engine
  // surface, not dead code.
  ignoreExportsUsedInFile: true,
  ignore: [
    // Static service worker, served from /public — never imported.
    "public/sw.js",
    // Fictional seed data kept as a TS mirror of seed.sql (referenced by .claude/rules/data-model.md).
    "src/db/seed.ts",
    // Claude Code local tooling (hooks, settings) — not part of the app build graph.
    ".claude/**",
  ],
}

export default config
