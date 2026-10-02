#!/usr/bin/env node
// PreToolUse(Bash) guard: block destructive/protected ops.
// Fail-safe: any error exits 0 (allows the command) — a guard bug must not wedge the shell.
const fs = require("fs");
try {
  const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const cmd = input?.tool_input?.command || "";
  const rx =
    /(wrangler\s+d1\s+execute\b(?=.*--remote)(?=.*(\b(drop|delete|truncate)\b|--file\b))|wrangler\s+d1\s+delete\b|wrangler\s+r2\s+(bucket\s+delete|object\s+delete)\b|git\s+push\s+(--force\s+)?origin\s+main\b)/i;
  if (rx.test(cmd)) {
    const reason = [
      "BLOCKED — destructive/protected operation.",
      "- Destructive or file-based (`--file`, contents unchecked) SQL against the REMOTE D1, or deleting the D1 database / R2 receipts, destroys real tax records. Confirm with the user first; schema changes go via `drizzle-kit generate` + PR (forward-only migrations).",
      "- Direct push to `main` violates branch+PR workflow. Open a PR instead.",
    ].join("\n");
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      })
    );
  }
  process.exit(0);
} catch {
  process.exit(0);
}
