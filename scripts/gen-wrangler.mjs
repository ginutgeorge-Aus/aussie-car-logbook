// Generates wrangler.toml from wrangler.toml.example for CI (Cloudflare Workers
// Builds), injecting the D1 database id from the D1_DATABASE_ID build secret.
// Keeps the id out of the repo — the committed file only has a placeholder.
//
// Local dev is unaffected: developers keep their own gitignored wrangler.toml
// and never run this. The guard below refuses to run without D1_DATABASE_ID so
// it can't clobber a real local file.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PLACEHOLDER = "REPLACE_WITH_YOUR_D1_ID";
const EXAMPLE = "wrangler.toml.example";
const OUT = "wrangler.toml";

const id = process.env.D1_DATABASE_ID;
if (!id) {
  console.error(
    "gen-wrangler: D1_DATABASE_ID is not set. This script is for CI only.\n" +
      "In Workers Builds, add it under Settings > Build > Variables and Secrets.",
  );
  process.exit(1);
}

if (!existsSync(EXAMPLE)) {
  console.error(`gen-wrangler: ${EXAMPLE} not found.`);
  process.exit(1);
}

const src = readFileSync(EXAMPLE, "utf8");
if (!src.includes(PLACEHOLDER)) {
  console.error(`gen-wrangler: placeholder "${PLACEHOLDER}" not found in ${EXAMPLE}.`);
  process.exit(1);
}

writeFileSync(OUT, src.replaceAll(PLACEHOLDER, id));
console.log(`gen-wrangler: wrote ${OUT} with D1 id from D1_DATABASE_ID.`);
