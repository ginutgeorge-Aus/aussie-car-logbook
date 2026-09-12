#!/usr/bin/env node
// PreToolUse(Bash) guard: block destructive/protected ops.
// Converted from hookify.block-prod-destructive.local.md (hookify plugin was never enabled).
// Fail-safe: any error exits 0 (allows the command) — a guard bug must not wedge the shell.
const fs = require("fs");
try {
  const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const cmd = input?.tool_input?.command || "";
  const rx =
    /(prisma\s+migrate\s+reset|prisma\s+db\s+push\s+.*--accept-data-loss|git\s+push\s+(--force\s+)?origin\s+main\b)/;
  if (rx.test(cmd)) {
    const reason = [
      "BLOCKED — destructive/protected operation.",
      "- `prisma migrate reset` wipes the DB. Dev: confirm with user first. Prod: never.",
      "- `db push --accept-data-loss` dropped prod data before. Schema changes go via `prisma migrate dev` + PR + tag (CI runs `migrate deploy`).",
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
