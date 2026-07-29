import { Cooldown, type FireResult, type GestureDetector, type Signals } from "./base.js";
import type { GestureThresholds } from "./config.js";

/**
 * Reach detector — a wrist raised clearly above the shoulder line. Hysteresis
 * (enter above, exit near the line) plus a cooldown keep a single raised hand
 * from stuttering into several fires. Works identically standing and seated,
 * which is part of why seated mode is the same game and not a lesser one.
 */
export class ReachDetector implements GestureDetector {
  readonly id = "reach" as const;
  private state: "down" | "up" = "down";
  private cooldown: Cooldown;

  constructor(private readonly t: GestureThresholds["reach"]) {
    this.cooldown = new Cooldown(t.cooldown);
  }

  update(s: Signals): FireResult | null {
    if (this.state === "down") {
      if (this.cooldown.ready(s.now) && s.wristAbove >= this.t.enter) {
        this.state = "up";
        this.cooldown.arm(s.now);
        return { gesture: "reach" };
      }
      return null;
    }
    if (s.wristAbove <= this.t.exit) this.state = "down";
    return null;
  }

  reset(): void {
    this.state = "down";
  }
}
