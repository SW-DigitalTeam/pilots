#!/usr/bin/env node
/**
 * Generates docs/VOICE_SCRIPT.md from the real ShowConfig cue banks, so the
 * recording script always matches the ids and durations the engine loads.
 * Run: node scripts/generate-voice-script.mjs
 */
import { build } from "esbuild";
import { writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOWS = join(ROOT, "packages", "shows");
const TMP = join(SHOWS, ".voice.tmp.mjs");

await build({
  entryPoints: [join(SHOWS, "src", "index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: TMP,
  logLevel: "silent",
});
const mod = await import(pathToFileURL(TMP).href);
rmSync(TMP, { force: true });

const CATEGORY_ORDER = ["count-in", "call", "praise", "encourage", "transition", "idle"];

let out = `# Arcade Arena — Voice Recording Script (with timing marks)

> Auto-generated from the show cue banks (\`node scripts/generate-voice-script.mjs\`).
> **Do not machine-generate the audio.** Prototype timing with the built-in
> synthetic voice, then re-record every line with a real person — ideally a
> local kaiako or rangatahi voicing the character. That is cheaper than a
> licence, sounds better, gets te reo right, and gives the school ownership.

## How to record

- **File name = cue id.** Save each take as \`<id>.(webm|m4a|ogg)\`. Keep the id
  and the length **stable** so a re-record is a drop-in replacement — the engine
  loads by id and expects the same duration in beats.
- **Record to a click at the show's BPM** (listed per show). Start each line on
  beat 1. Finish **within** its allotted beats (the "≈ seconds" column is that
  many beats at this BPM). Leave ~50 ms of silence head and tail so nothing
  clicks.
- **Calls are anticipatory.** The engine fires a \`call\` one bar before the move's
  scoring window, so deliver calls crisp and slightly ahead of the beat, not
  lazy. Count-ins land on the bar before the first move.
- **Rotation matters.** Praise/encourage lines rotate and never repeat back to
  back, so give each take its own energy — flat repeats are what make these
  games feel cheap.
- **Two languages, one grid.** Record the English and the te reo Māori takes to
  the **same** length so a show can switch language without retiming.

## te reo Māori

The te reo below is limited to correct core phrases as a placeholder. Before any
school sees this, a **kaiako must review, correct, and voice** the te reo lines —
expand them for variety if they wish, keeping ids and durations stable.

`;

for (const show of mod.ALL_SHOWS) {
  const bpm = show.music.bpm;
  const spb = 60 / bpm;
  out += `\n## ${show.title}  \`${show.id}\`\n\n`;
  out += `- **Tempo:** ${bpm} BPM (1 beat ≈ ${spb.toFixed(3)} s), ${show.music.beatsPerBar}/4\n`;
  out += `- **Character voice:** ${show.character ? show.character.name : "— (no character; neutral count)"}\n`;
  out += `- **Lines:** ${show.cues.length}\n\n`;
  out += `| id | category | move | English | te reo Māori | beats | ≈ seconds |\n`;
  out += `| --- | --- | --- | --- | --- | --- | --- |\n`;
  const sorted = [...show.cues].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
  for (const c of sorted) {
    const secs = (c.durationBeats * spb).toFixed(2);
    out += `| \`${c.id}\` | ${c.category} | ${c.gesture ?? ""} | ${c.textEn} | ${c.textMi} | ${c.durationBeats} | ${secs} |\n`;
  }
}

writeFileSync(join(ROOT, "docs", "VOICE_SCRIPT.md"), out);
console.log("Wrote docs/VOICE_SCRIPT.md");
