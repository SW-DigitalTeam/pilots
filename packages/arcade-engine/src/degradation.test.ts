import { describe, expect, it } from "vitest";
import { DegradationController } from "./degradation.js";

describe("degradation — graceful ladder, never an error", () => {
  it("steps down one rung after sustained low fps", () => {
    const d = new DegradationController(15, 25, 2, 5);
    let now = 0;
    // Feed sustained 10fps.
    for (let i = 0; i < 100; i++) {
      now += 0.1;
      d.update(10, now);
    }
    expect(d.currentLevel).toBeGreaterThanOrEqual(1);
    // Capture resolution drops before players are dropped.
    expect(d.action.captureScale).toBeLessThan(1);
  });

  it("does not step down on a brief dip", () => {
    const d = new DegradationController(15, 25, 2, 5);
    let now = 0;
    d.update(30, now);
    now += 0.3;
    d.update(8, now); // one bad frame
    now += 0.3;
    d.update(30, now);
    expect(d.currentLevel).toBe(0);
  });

  it("recovers a rung after a sustained good stretch", () => {
    const d = new DegradationController(15, 25, 2, 5);
    let now = 0;
    for (let i = 0; i < 100; i++) {
      now += 0.1;
      d.update(8, now);
    }
    const low = d.currentLevel;
    expect(low).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) {
      now += 0.1;
      d.update(40, now);
    }
    expect(d.currentLevel).toBeLessThan(low);
  });

  it("never goes below the last rung (single player floor)", () => {
    const d = new DegradationController(15, 25, 1, 5);
    let now = 0;
    for (let i = 0; i < 1000; i++) {
      now += 0.1;
      d.update(2, now);
    }
    expect(d.currentLevel).toBe(3);
    expect(d.action.numPoses).toBe(1);
  });
});
