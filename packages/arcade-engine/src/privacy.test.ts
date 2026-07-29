import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join } from "node:path";
import { validateCameraPoseClaim } from "@sw/shell";
import { summaryToClaim } from "./evidence.js";
import type { SessionSummary } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");

function shippedSources(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (
        [".ts", ".tsx"].includes(extname(p)) &&
        !/\.test\.|\.spec\./.test(p)
      ) {
        out.push(p);
      }
    }
  };
  walk(root);
  return out;
}

const FORBIDDEN = ["MediaRecorder", "toDataURL", "toBlob", "putImageData", "captureStream"];

describe("privacy critic — no pixel data can leave the device", () => {
  const files = shippedSources(join(REPO, "packages"));

  it("scans a non-trivial number of shipped files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const token of FORBIDDEN) {
    it(`no shipped source uses ${token}`, () => {
      const hits = files.filter((f) => readFileSync(f, "utf8").includes(token));
      expect(hits).toEqual([]);
    });
  }

  it("the engine imports no React (framework-agnostic)", () => {
    const engineFiles = files.filter((f) => f.includes(`${join("packages", "arcade-engine")}`));
    const offenders = engineFiles.filter((f) => /from\s+["']react["']/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
    expect(engineFiles.length).toBeGreaterThan(10);
  });
});

describe("privacy critic — evidence is derived numbers only", () => {
  const summary: SessionSummary = {
    team: { id: "room-12", label: "Room 12" },
    show: "s",
    mode: "follow",
    inputProfile: "standing",
    startedAt: 1000,
    endedAt: 2000,
    activeSeconds: 42.4,
    movementMagnitude: 1.234,
    teamScore: 999,
    gestureCounts: { jump: 3, sidestep: 1, duck: 2, reach: 5 },
    playersTracked: 2,
  };

  it("the claim validates and carries no forbidden fields", () => {
    const claim = summaryToClaim(summary);
    const result = validateCameraPoseClaim(claim);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(claim)).not.toMatch(/landmark|frame|image|pixel|student|dataUrl|blob/i);
  });

  it("a claim smuggling raw landmarks is rejected by the shell schema", () => {
    const bad = { ...summaryToClaim(summary), landmarks: [[0.1, 0.2]] };
    const result = validateCameraPoseClaim(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/forbidden key/);
  });

  it("a claim with a per-student field is rejected", () => {
    const bad = { ...summaryToClaim(summary), team: { id: "x", label: "y", studentName: "Ada" } };
    const result = validateCameraPoseClaim(bad);
    expect(result.ok).toBe(false);
  });
});
