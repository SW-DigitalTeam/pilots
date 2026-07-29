import { LM, REQUIRED_LANDMARKS, type InputProfile } from "./landmarks.js";
import { midpoint, dist, type Vec2 } from "./math.js";
import type { Pose } from "./types.js";

/**
 * The calibrated reference for one player. Every gesture threshold is expressed
 * as a multiple of `torso`, so a kid at the back of the hall and a kid right in
 * front of the lens produce the same numbers for the same movement.
 */
export interface Calibration {
  /** Shoulder-centroid to hip-centroid distance, in normalised image units. */
  torso: number;
  /** Resting hip centroid — the baseline sidestep and jump measure against. */
  restHip: Vec2;
  restShoulder: Vec2;
  /** Baseline knee bend (radians); a duck must bend well past this. */
  restKneeAngle: number;
}

const VISIBILITY_GATE = 0.5;

export function landmarkVisible(pose: Pose, index: number): boolean {
  const lm = pose.landmarks[index];
  return lm !== undefined && lm.visibility >= VISIBILITY_GATE;
}

export function requiredVisible(pose: Pose, profile: InputProfile): boolean {
  return REQUIRED_LANDMARKS[profile].every((i) => landmarkVisible(pose, i));
}

export function shoulderCentroid(pose: Pose): Vec2 {
  return midpoint(pose.landmarks[LM.LEFT_SHOULDER]!, pose.landmarks[LM.RIGHT_SHOULDER]!);
}

export function hipCentroid(pose: Pose): Vec2 {
  return midpoint(pose.landmarks[LM.LEFT_HIP]!, pose.landmarks[LM.RIGHT_HIP]!);
}

export function torsoLength(pose: Pose): number {
  return dist(shoulderCentroid(pose), hipCentroid(pose));
}

/** Knee angle at the more-visible leg; falls back to a straight leg. */
export function kneeAngle(pose: Pose): number {
  const legs: Array<[number, number, number]> = [
    [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
    [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  ];
  let best: number | null = null;
  let bestVis = -1;
  for (const [h, k, a] of legs) {
    const hv = pose.landmarks[h]?.visibility ?? 0;
    const kv = pose.landmarks[k]?.visibility ?? 0;
    const av = pose.landmarks[a]?.visibility ?? 0;
    const vis = Math.min(hv, kv, av);
    if (vis >= VISIBILITY_GATE && vis > bestVis) {
      bestVis = vis;
      best = interiorAngle(pose, h, k, a);
    }
  }
  return best ?? Math.PI;
}

function interiorAngle(pose: Pose, ai: number, bi: number, ci: number): number {
  const a = pose.landmarks[ai]!;
  const b = pose.landmarks[bi]!;
  const c = pose.landmarks[ci]!;
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magA = Math.hypot(abx, aby);
  const magC = Math.hypot(cbx, cby);
  if (magA === 0 || magC === 0) return Math.PI;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magC)));
  return Math.acos(cos);
}

/**
 * Accumulates still-stand frames (~5s) and produces a Calibration by averaging.
 * Rejects the sample if too few frames had the required landmarks visible.
 */
export class Calibrator {
  private torsos: number[] = [];
  private hips: Vec2[] = [];
  private shoulders: Vec2[] = [];
  private knees: number[] = [];

  constructor(
    private readonly profile: InputProfile,
    /** Minimum usable frames before calibration is allowed to complete. */
    private readonly minFrames = 20,
  ) {}

  add(pose: Pose): void {
    if (!requiredVisible(pose, this.profile)) return;
    this.torsos.push(torsoLength(pose));
    this.hips.push(hipCentroid(pose));
    this.shoulders.push(shoulderCentroid(pose));
    this.knees.push(this.profile === "standing" ? kneeAngle(pose) : Math.PI);
  }

  get samples(): number {
    return this.torsos.length;
  }

  ready(): boolean {
    return this.torsos.length >= this.minFrames && median(this.torsos) > 0;
  }

  complete(): Calibration {
    if (!this.ready()) throw new Error("calibration not ready");
    return {
      torso: median(this.torsos),
      restHip: averageVec(this.hips),
      restShoulder: averageVec(this.shoulders),
      restKneeAngle: median(this.knees),
    };
  }

  reset(): void {
    this.torsos = [];
    this.hips = [];
    this.shoulders = [];
    this.knees = [];
  }
}

/** True when the live torso has drifted enough to warrant silent recalibration. */
export function scaleDrifted(cal: Calibration, liveTorso: number, threshold = 0.2): boolean {
  if (cal.torso <= 0) return true;
  return Math.abs(liveTorso - cal.torso) / cal.torso > threshold;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function averageVec(vs: Vec2[]): Vec2 {
  if (vs.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const v of vs) {
    sx += v.x;
    sy += v.y;
  }
  return { x: sx / vs.length, y: sy / vs.length };
}
