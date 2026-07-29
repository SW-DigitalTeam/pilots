import { clamp } from "./math.js";
import type { GestureEvent, GestureId } from "./types.js";

/**
 * Effort, not skill.
 *
 * Movement Points = active seconds × an intensity multiplier taken purely from
 * movement magnitude. Nothing here rewards *hitting* a cue — a kid who is
 * uncoordinated but working hard scores like a natural athlete, on purpose.
 * Gesture counts are tallied for evidence only; they never touch the score.
 * Do not "improve" this into a timing/accuracy score.
 */
export interface ScoreConfig {
  /** Magnitude (torso/s) below which a frame counts as at-rest. */
  activeThreshold: number;
  /** Multiplier slope and ceiling. */
  slope: number;
  maxMultiplier: number;
}

export const DEFAULT_SCORE: ScoreConfig = {
  activeThreshold: 0.15,
  slope: 0.5,
  maxMultiplier: 2.5,
};

export class Scorer {
  private activeSeconds = 0;
  private score = 0;
  private magSum = 0;
  private magSamples = 0;
  private readonly counts: Record<GestureId, number> = { jump: 0, sidestep: 0, duck: 0, reach: 0 };

  constructor(private readonly cfg: ScoreConfig = DEFAULT_SCORE) {}

  multiplier(magnitude: number): number {
    return clamp(1 + magnitude * this.cfg.slope, 1, this.cfg.maxMultiplier);
  }

  /** Advance the score by one frame. `magnitude` is team-mean torso/s. */
  update(dt: number, magnitude: number, events: GestureEvent[]): void {
    if (dt > 0 && magnitude > this.cfg.activeThreshold) {
      this.activeSeconds += dt;
      this.score += dt * this.multiplier(magnitude);
    }
    this.magSum += magnitude;
    this.magSamples++;
    for (const e of events) this.counts[e.gesture]++;
  }

  get teamScore(): number {
    // Present as whole Movement Points; effort should read as a big number.
    return Math.round(this.score * 100);
  }

  get activeSecondsTotal(): number {
    return this.activeSeconds;
  }

  get meanMagnitude(): number {
    return this.magSamples === 0 ? 0 : this.magSum / this.magSamples;
  }

  get gestureCounts(): Record<GestureId, number> {
    return { ...this.counts };
  }
}
