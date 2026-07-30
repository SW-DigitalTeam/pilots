#!/usr/bin/env node
/**
 * Generate AI music tracks for the three shows via Replicate MusicGen.
 *
 * Usage:
 *   REPLICATE_API_TOKEN=r8_... node scripts/generate-music.mjs
 *
 * Writes one mp3 per show into apps/standard/public/audio/music/, matching the
 * trackUrl in each show config. Re-runs are cheap: existing files are skipped
 * unless --force is passed.
 *
 * Track prompts are tuned per show: the right BPM and energy so the game can
 * time-stretch each loop over a whole number of bars (see audio/trackBed.ts).
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps", "standard", "public", "audio", "music");
const VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";
const FORCE = process.argv.includes("--force");

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("Set REPLICATE_API_TOKEN first.");
  process.exit(1);
}

const TRACKS = [
  {
    file: "tarapi.mp3",
    prompt:
      "Upbeat kids dance party instrumental, 128 BPM, energetic synth pop, bright catchy melody, bouncy bass, four on the floor kick, no vocals, fun and playful for children",
    duration: 15,
  },
  {
    file: "baseline.mp3",
    prompt:
      "Half-time electronic groove instrumental, 100 BPM, deep sub bass, minimalist hip hop beat, moody synth pads, punchy drums, no vocals, cool and confident",
    duration: 15,
  },
  {
    file: "grid.mp3",
    prompt:
      "Minimalist geometric electronic instrumental, 120 BPM, clean precise beats, modern arpeggios, crisp percussion, ambient synth texture, no vocals, focused and rhythmic",
    duration: 15,
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = async (path, options = {}, retries = 5) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.replicate.com/v1${path}`, {
      ...options,
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (res.status === 429 && attempt < retries) {
      let wait = 8000;
      try {
        const body = await res.json();
        if (body.retry_after) wait = Math.ceil(body.retry_after * 1000) + 1000;
      } catch {
        /* keep default */
      }
      console.log(`  rate limited; waiting ${Math.round(wait / 1000)}s ...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }
};

async function generate({ file, prompt, duration }) {
  const outPath = join(OUT_DIR, file);
  if (!FORCE && (await access(outPath).then(() => true, () => false))) {
    console.log(`skip ${file} (exists)`);
    return;
  }
  console.log(`generating ${file} ...`);
  const pred = await api("/predictions", {
    method: "POST",
    body: JSON.stringify({
      version: VERSION,
      input: {
        prompt,
        model_version: "stereo-melody-large",
        duration,
        output_format: "mp3",
        normalization_strategy: "loudness",
      },
    }),
  });

  let cur = pred;
  while (cur.status !== "succeeded" && cur.status !== "failed" && cur.status !== "canceled") {
    await sleep(3000);
    cur = await api(`/predictions/${pred.id}`);
    process.stdout.write(`  ${cur.status}\r`);
  }
  if (cur.status !== "succeeded") throw new Error(`${file}: ${cur.status} ${cur.error ?? ""}`);

  const audioRes = await fetch(cur.output);
  if (!audioRes.ok) throw new Error(`${file}: download failed ${audioRes.status}`);
  await writeFile(outPath, Buffer.from(await audioRes.arrayBuffer()));
  console.log(`  wrote ${outPath}`);
}

await mkdir(OUT_DIR, { recursive: true });
for (const t of TRACKS) {
  await generate(t);
}
console.log("done.");
