// @ts-check
import coreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const eslintConfig = [
  {
    ignores: [
      "next-env.d.ts",
      "cloudflare-env.d.ts",
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      ".worktrees/**",
      "node_modules/**",
      // Claude Code local tooling (gitignored) — not part of the app.
      ".claude/**",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
]

export default eslintConfig
