import { Cooldown, type FireResult, type GestureDetector, type Signals } from "./base.js";
import type { GestureThresholds } from "./config.js";

/**
 * Jump detector.
 *
 * Two-phase, so a real jump and a fake jump (a quick upward bob with no
 * elevation) are separable:
 *   idle --(vUp > vArm)--> armed --(rise >= minRise)--> FIRE
 *   armed --(vUp turns downward before minRise)--> disarm   [it was a bob]
 *
 * Firing at the moment elevation is confirmed keeps motion-to-response low
 * while refusing to reward a bob. After firing we require a return toward rest
 * plus a cooldown before re-arming, so one jump can never double-fire.
 */
export class JumpDetector implements GestureDetector {
  readonly id = "jump" as const;
  private state: "idle" | "armed" | "airborne" = "idle";
  private cooldown: Cooldown;

  constructor(private readonly t: GestureThresholds["jump"]) {
    this.cooldown = new Cooldown(t.cooldown);
  }

  update(s: Signals): FireResult | null {
    switch (this.state) {
      case "idle":
        if (this.cooldown.ready(s.now) && s.vUp > this.t.vArm) this.state = "armed";
        return null;
      case "armed":
        if (s.refRise >= this.t.minRise) {
          this.state = "airborne";
          this.cooldown.arm(s.now);
          return { gesture: "jump" };
        }
        // Upward burst fizzled without real elevation -> it was a bob.
        if (s.vUp <= 0) this.state = "idle";
        return null;
      case "airborne":
        // Wait until the player has come back down before re-arming.
        if (s.refRise < this.t.minRise * 0.4 && this.cooldown.ready(s.now)) this.state = "idle";
        return null;
    }
  }

  reset(): void {
    this.state = "idle";
  }
}
