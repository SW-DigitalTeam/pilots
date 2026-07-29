import { Cooldown, type FireResult, type GestureDetector, type Signals } from "./base.js";
import type { GestureThresholds } from "./config.js";

/**
 * Duck detector.
 *
 * Standing: a duck is a shoulder drop AND a knee bend. Requiring the knee bend
 * is the whole trick — leaning forward drops the shoulders too, but does not
 * bend the knees, so a lean reads as nothing. Shoulder height alone would fire
 * on every lean, which is exactly the false positive the fixtures guard.
 *
 * Seated (no reliable knees): a duck is a shoulder drop delivered fast. A
 * deliberate downward duck has downward shoulder speed a slow lean never
 * reaches, so speed replaces the knee test.
 */
export class DuckDetector implements GestureDetector {
  readonly id = "duck" as const;
  private state: "up" | "down" = "up";
  private cooldown: Cooldown;

  constructor(
    private readonly t: GestureThresholds["duck"],
    private readonly seated: boolean,
  ) {
    this.cooldown = new Cooldown(t.cooldown);
  }

  private triggered(s: Signals): boolean {
    if (s.shoulderDrop < this.t.shoulderEnter) return false;
    if (this.seated || !s.kneeValid) return s.vShoulderDown >= this.t.seatedVDown;
    return s.kneeAngle <= s.restKneeAngle - this.t.kneeBendDelta;
  }

  update(s: Signals): FireResult | null {
    if (this.state === "up") {
      if (this.cooldown.ready(s.now) && this.triggered(s)) {
        this.state = "down";
        this.cooldown.arm(s.now);
        return { gesture: "duck" };
      }
      return null;
    }
    if (s.shoulderDrop <= this.t.shoulderExit) this.state = "up";
    return null;
  }

  reset(): void {
    this.state = "up";
  }
}
