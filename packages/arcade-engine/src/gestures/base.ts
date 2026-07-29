import type { GestureId } from "../types.js";

/**
 * Per-frame kinematic signals for one player, already normalised to torso units
 * and already mirrored to room space (+x = room-right = screen-right).
 *
 * "Reference centroid" is the hip centroid in standing mode and the shoulder
 * centroid in seated mode, so translation gestures read from whichever part of
 * the body actually moves in that profile.
 */
export interface Signals {
  /** Seconds (audio clock). */
  now: number;
  /** Seconds since this player's previous frame. */
  dt: number;
  /** Reference-centroid horizontal offset from rest, + = room-right. */
  refDx: number;
  /** Reference-centroid rise above rest, + = up. */
  refRise: number;
  /** Reference-centroid vertical speed, + = up (torso/s). */
  vUp: number;
  /** Shoulder-centroid drop below rest, + = down. */
  shoulderDrop: number;
  /** Shoulder-centroid downward speed, + = down (torso/s). */
  vShoulderDown: number;
  /** Knee interior angle (radians); larger = straighter. */
  kneeAngle: number;
  /** Rest knee angle captured at calibration. */
  restKneeAngle: number;
  /** True when both legs are visible enough to trust kneeAngle. */
  kneeValid: boolean;
  /** Highest wrist above shoulder, + = above (torso units). */
  wristAbove: number;
}

export interface FireResult {
  gesture: GestureId;
  direction?: "left" | "right";
}

export interface GestureDetector {
  readonly id: GestureId;
  /** Returns a FireResult exactly on the frame the gesture fires, else null. */
  update(s: Signals): FireResult | null;
  reset(): void;
}

/**
 * Time-based cooldown. After a fire, a detector stays locked until it has both
 * been released AND waited out the cooldown — this is what makes a double-fire
 * structurally impossible rather than merely unlikely.
 */
export class Cooldown {
  private until = -Infinity;

  constructor(private readonly seconds: number) {}

  arm(now: number): void {
    this.until = now + this.seconds;
  }

  ready(now: number): boolean {
    return now >= this.until;
  }
}
