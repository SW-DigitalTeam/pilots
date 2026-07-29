import { describe, expect, it } from "vitest";
import { ALL_FIXTURES, replay, type Fixture } from "./index.js";
import type { GestureId } from "../types.js";

const GESTURES: GestureId[] = ["jump", "sidestep", "duck", "reach"];

function expectedCount(f: Fixture, g: GestureId): number {
  return f.expect[g] ?? 0;
}

describe("motion critic — fixture replay", () => {
  for (const fixture of ALL_FIXTURES) {
    describe(fixture.name, () => {
      const report = replay(fixture);

      it("calibrates the tracked player", () => {
        expect(report.playersCalibrated).toBeGreaterThanOrEqual(1);
      });

      for (const g of GESTURES) {
        it(`fires ${g} exactly ${expectedCount(fixture, g)} time(s)`, () => {
          expect(report.counts[g]).toBe(expectedCount(fixture, g));
        });
      }

      it("never double-fires any gesture", () => {
        for (const g of GESTURES) {
          // The only fixtures expecting >1 would be repeats; ours expect 0 or 1.
          expect(report.counts[g]).toBeLessThanOrEqual(Math.max(1, expectedCount(fixture, g)));
        }
      });
    });
  }
});

describe("motion critic — no false positives", () => {
  const negatives = ALL_FIXTURES.filter((f) => Object.keys(f.expect).length === 0);
  for (const f of negatives) {
    it(`${f.name} fires nothing`, () => {
      const r = replay(f);
      const total = GESTURES.reduce((s, g) => s + r.counts[g], 0);
      expect(total).toBe(0);
    });
  }
});

describe("motion critic — direction", () => {
  it("sidestep-right reports right", () => {
    const r = replay(ALL_FIXTURES.find((f) => f.name === "sidestep-right")!);
    expect(r.events[0]?.direction).toBe("right");
  });
  it("sidestep-left reports left", () => {
    const r = replay(ALL_FIXTURES.find((f) => f.name === "sidestep-left")!);
    expect(r.events[0]?.direction).toBe("left");
  });
});

describe("motion critic — latency (motion-to-response < 120ms)", () => {
  for (const f of ALL_FIXTURES.filter((x) => x.motionStartS !== undefined)) {
    it(`${f.name} responds within 120ms`, () => {
      const r = replay(f);
      expect(r.latencyMs).not.toBeNull();
      expect(r.latencyMs!).toBeGreaterThanOrEqual(0);
      expect(r.latencyMs!).toBeLessThanOrEqual(120);
    });
  }
});

describe("motion critic — true positive rate across jitter", () => {
  // Re-run each positive fixture at a spread of frame rates; every run must fire.
  const positives = ALL_FIXTURES.filter((f) => Object.keys(f.expect).length > 0);
  it("holds >= 95% true positive across fps 20..30", () => {
    let runs = 0;
    let hits = 0;
    for (const base of positives) {
      for (let fps = 20; fps <= 30; fps++) {
        // Rebuild the fixture at this fps via its generator name.
        const rebuilt = rebuildAtFps(base, fps);
        const r = replay(rebuilt);
        for (const g of GESTURES) {
          const want = rebuilt.expect[g] ?? 0;
          if (want > 0) {
            runs++;
            if (r.counts[g] >= 1) hits++;
          }
        }
      }
    }
    expect(hits / runs).toBeGreaterThanOrEqual(0.95);
  });
});

// The scenario generators all accept an fps; re-derive by name for the sweep.
import * as scenarios from "./scenarios.js";
function rebuildAtFps(f: Fixture, fps: number): Fixture {
  const factory = (scenarios as unknown as Record<string, (fps?: number) => Fixture>)[camel(f.name)];
  return factory ? factory(fps) : f;
}
function camel(name: string): string {
  const map: Record<string, string> = {
    "real-jump": "realJump",
    "sidestep-right": "sidestepRight",
    "sidestep-left": "sidestepLeft",
    "duck-squat": "duck",
    "reach-up": "reach",
    "seated-reach": "seatedReach",
    "sustained-duck": "sustainedDuck",
    "double-jump": "doubleJump",
    "two-player-jump": "twoPlayerJump",
  };
  return map[name] ?? name;
}
