#!/usr/bin/env node
/**
 * Materialises the landmark fixture library to JSON on disk.
 *
 * The generators in src/replay/scenarios.ts are the source of truth; this
 * script bundles them and writes each fixture to fixtures/<name>.json so the
 * recorded landmark sequences exist as inspectable artifacts (and can be diffed
 * or hand-edited). Run: node scripts/generate-fixtures.mjs
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = join(ROOT, "packages", "arcade-engine");
const OUT_DIR = join(ENGINE, "fixtures");
const TMP = join(ENGINE, ".fixtures.tmp.mjs");

await build({
  entryPoints: [join(ENGINE, "src", "replay", "index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: TMP,
  logLevel: "silent",
});

const mod = await import(pathToFileURL(TMP).href);
rmSync(TMP, { force: true });

mkdirSync(OUT_DIR, { recursive: true });
const index = [];
for (const fixture of mod.ALL_FIXTURES) {
  const file = `${fixture.name}.json`;
  writeFileSync(join(OUT_DIR, file), mod.fixtureToJSON(fixture) + "\n");
  index.push({ name: fixture.name, file, profile: fixture.profile, expect: fixture.expect, note: fixture.note });
}
writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n");

console.log(`Wrote ${index.length} landmark fixtures + index.json to ${OUT_DIR}`);
