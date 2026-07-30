#!/usr/bin/env node
/**
 * Generate AI background art for the three shows via Replicate Flux (schnell).
 *
 * Usage:
 *   REPLICATE_API_TOKEN=r8_... node scripts/generate-backgrounds.mjs
 *
 * Writes one 1280x720 png per show into apps/standard/public/assets/bg/,
 * matching the backgroundUrl in each show config. Existing files are skipped
 * unless --force is passed. The renderer falls back to the procedural
 * background whenever the image is missing, so this is purely additive.
 *
 * Prompts avoid text/logos (Flux renders them poorly) and keep the centre
 * clear, since the character and gesture shapes draw on top.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps", "standard", "public", "assets", "bg");
const VERSION = "c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e"; // flux-schnell
const FORCE = process.argv.includes("--force");

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("Set REPLICATE_API_TOKEN first.");
  process.exit(1);
}

const BACKGROUNDS = [
  {
    file: "tarapi.png",
    prompt:
      "Vibrant cartoon gym hall stage background for a kids' dance game, saturated comic-book pop style, thick outlines, flat vivid purple and pink fills, confetti and lightning-bolt shapes floating near the edges, spotlights from above, empty clear centre, no text, no characters, wide 16:9 composition",
  },
  {
    file: "baseline.png",
    prompt:
      "Sleek dark neon concert stage background, deep black with electric green and cyan neon light strips, glowing horizontal grid floor receding to a vanishing point, atmospheric haze and spotlights, minimalist hip-hop club aesthetic, empty clear centre, no text, no characters, wide 16:9 composition",
  },
  {
    file: "grid.png",
    prompt:
      "Minimalist Bauhaus geometric stage background, off-white warm paper texture, bold flat primary shapes in red blue yellow black arranged around the edges, clean precise composition, generous negative space in the centre, no text, no characters, wide 16:9 composition",
  },
];

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate({ file, prompt }) {
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
        aspect_ratio: "16:9",
        output_format: "png",
        num_outputs: 1,
        go_fast: true,
      },
    }),
  });

  let cur = pred;
  while (cur.status !== "succeeded" && cur.status !== "failed" && cur.status !== "canceled") {
    await sleep(2000);
    cur = await api(`/predictions/${pred.id}`);
    process.stdout.write(`  ${cur.status}\r`);
  }
  if (cur.status !== "succeeded") throw new Error(`${file}: ${cur.status} ${cur.error ?? ""}`);

  const url = Array.isArray(cur.output) ? cur.output[0] : cur.output;
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`${file}: download failed ${imgRes.status}`);
  await writeFile(outPath, Buffer.from(await imgRes.arrayBuffer()));
  console.log(`  wrote ${outPath}`);
}

await mkdir(OUT_DIR, { recursive: true });
for (const b of BACKGROUNDS) {
  await generate(b);
}
console.log("done.");
