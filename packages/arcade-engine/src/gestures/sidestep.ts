import { Cooldown, type FireResult, type GestureDetector, type Signals } from "./base.js";
import type { GestureThresholds } from "./config.js";

/**
 * Side-step detector — horizontal displacement of the reference centroid past a
 * torso-scaled gate, with hysteresis (enter > exit) so hovering near the gate
 * cannot chatter. Fires once per step-out with a direction; re-arms only after
 * the player returns toward centre and the cooldown elapses.
 *
 * A turn in place does not move the hip centroid horizontally, so it does not
 * trip this. Direction is already room-space because signals arrive mirrored.
 */
export class SidestepDetector implements GestureDetector {
  readonly id = "sidestep" as const;
  private state: "centre" | "out" = "centre";
  private cooldown: Cooldown;

  constructor(private readonly t: GestureThresholds["sidestep"]) {
    this.cooldown = new Cooldown(t.cooldown);
  }

  update(s: Signals): FireResult | null {
    if (this.state === "centre") {
      if (this.cooldown.ready(s.now) && Math.abs(s.refDx) >= this.t.enter) {
        this.state = "out";
        this.cooldown.arm(s.now);
        return { gesture: "sidestep", direction: s.refDx > 0 ? "right" : "left" };
      }
      return null;
    }
    // state === "out": wait for a return under the exit gate before re-arming.
    if (Math.abs(s.refDx) <= this.t.exit) this.state = "centre";
    return null;
  }

  reset(): void {
    this.state = "centre";
  }
}
