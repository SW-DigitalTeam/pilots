import { describe, expect, it } from "vitest";
import { Scorer } from "./scoring.js";
import type { GestureEvent } from "./types.js";

const fire = (gesture: GestureEvent["gesture"]): GestureEvent => ({
  gesture,
  playerId: 0,
  atSeconds: 0,
  frameTimestampMs: 0,
});

describe("scoring — effort, not skill", () => {
  it("accrues points from time and movement magnitude only", () => {
    const s = new Scorer();
    for (let i = 0; i < 100; i++) s.update(0.04, 1.0, []);
    expect(s.activeSecondsTotal).toBeCloseTo(4, 1);
    expect(s.teamScore).toBeGreaterThan(0);
  });

  it("does not count at-rest frames as active", () => {
    const s = new Scorer();
    for (let i = 0; i < 100; i++) s.update(0.04, 0.05, []); // below activeThreshold
    expect(s.activeSecondsTotal).toBe(0);
    expect(s.teamScore).toBe(0);
  });

  it("rewards a hard-working uncoordinated player like a natural athlete", () => {
    // Same time, same magnitude, but one lands gestures and the other doesn't.
    const withGestures = new Scorer();
    const withoutGestures = new Scorer();
    const events = [fire("jump"), fire("duck"), fire("reach")];
    for (let i = 0; i < 100; i++) {
      withGestures.update(0.04, 1.5, i % 10 === 0 ? events : []);
      withoutGestures.update(0.04, 1.5, []);
    }
    // Gestures never touch the score — effort is identical, so scores match.
    expect(withGestures.teamScore).toBe(withoutGestures.teamScore);
    // But gesture counts are still tallied for evidence.
    expect(withGestures.gestureCounts.jump).toBe(10);
  });

  it("higher magnitude yields a higher multiplier, capped", () => {
    const s = new Scorer();
    expect(s.multiplier(0)).toBe(1);
    expect(s.multiplier(2)).toBeGreaterThan(s.multiplier(0.5));
    expect(s.multiplier(100)).toBeLessThanOrEqual(2.5);
  });
});
