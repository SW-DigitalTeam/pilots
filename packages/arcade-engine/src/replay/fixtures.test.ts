import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { replay, type Fixture } from "./index.js";
import type { GestureId } from "../types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, "..", "..", "fixtures");
const GESTURES: GestureId[] = ["jump", "sidestep", "duck", "reach"];

interface IndexEntry {
  name: string;
  file: string;
}

const hasFixtures = existsSync(join(FIXTURE_DIR, "index.json"));

describe.runIf(hasFixtures)("replay rig — recorded JSON fixtures feed the engine", () => {
  const index: IndexEntry[] = JSON.parse(readFileSync(join(FIXTURE_DIR, "index.json"), "utf8"));

  it("index lists all recorded fixtures", () => {
    expect(index.length).toBeGreaterThanOrEqual(11);
  });

  for (const entry of index) {
    it(`${entry.name}.json replays to its expectation`, () => {
      const fixture: Fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, entry.file), "utf8"));
      const report = replay(fixture);
      for (const g of GESTURES) {
        expect(report.counts[g]).toBe(fixture.expect[g] ?? 0);
      }
    });
  }
});
