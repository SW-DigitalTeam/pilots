import {
  hipCentroid,
  kneeAngle as measureKnee,
  requiredVisible,
  shoulderCentroid,
  torsoLength,
  profileScale,
} from "./calibration.js";
import { LM, type InputProfile } from "./landmarks.js";
import { clamp, dist } from "./math.js";
import { PlayerTracker } from "./tracker.js";
import { DuckDetector } from "./gestures/duck.js";
import { JumpDetector } from "./gestures/jump.js";
import { ReachDetector } from "./gestures/reach.js";
import { SidestepDetector } from "./gestures/sidestep.js";
import type { GestureDetector, Signals } from "./gestures/base.js";
import { DEFAULT_THRESHOLDS, mergeThresholds, type GestureThresholds } from "./gestures/config.js";
import type { GestureEvent, GestureId, Pose, PoseFrame } from "./types.js";

/** Result of ingesting one frame. */
export interface InterpretResult {
  events: GestureEvent[];
  /** Mean per-player movement magnitude this frame (torso/s), for scoring. */
  movementMagnitude: number;
  playersTracked: number;
}

const STABLE_LANDMARKS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
];

/** Per-player running state, baselines, and detector bank. */
class PlayerRuntime {
  private baseHipX: number | null = null;
  private baseRefY: number | null = null;
  private baseShoulderY: number | null = null;
  private prevRefY: number | null = null;
  private prevShoulderY: number | null = null;
  private prevLandmarks: Pose["landmarks"] | null = null;
  private prevTime: number | null = null;
  private readonly detectors: GestureDetector[];

  constructor(
    readonly id: number,
    private torso: number,
    private readonly restKneeAngle: number,
    private readonly profile: InputProfile,
    t: GestureThresholds,
  ) {
    this.detectors = [
      new JumpDetector(t.jump),
      new SidestepDetector(t.sidestep),
      new DuckDetector(t.duck, profile === "seated"),
      new ReachDetector(t.reach),
    ];
  }

  /** Slowly re-scale on drift so a player who steps closer stays calibrated. */
  refreshScale(torso: number): void {
    this.torso = torso;
  }

  process(pose: Pose, now: number): { events: GestureEvent[]; magnitude: number } {
    const hip = hipCentroid(pose);
    const shoulder = shoulderCentroid(pose);
    const ref = this.profile === "seated" ? shoulder : hip;
    const torso = this.torso > 0 ? this.torso : torsoLength(pose) || 1e-6;

    // Initialise baselines on first frame.
    if (this.baseHipX === null) this.baseHipX = ref.x;
    if (this.baseRefY === null) this.baseRefY = ref.y;
    if (this.baseShoulderY === null) this.baseShoulderY = shoulder.y;

    const dt = this.prevTime === null ? 0 : Math.max(1e-3, now - this.prevTime);

    const refDx = (ref.x - this.baseHipX) / torso;
    const refRise = (this.baseRefY - ref.y) / torso; // up positive
    const shoulderDrop = (shoulder.y - this.baseShoulderY) / torso; // down positive

    const vUp = this.prevRefY === null || dt === 0 ? 0 : ((this.prevRefY - ref.y) / dt) / torso;
    const vShoulderDown =
      this.prevShoulderY === null || dt === 0 ? 0 : ((shoulder.y - this.prevShoulderY) / dt) / torso;

    const knee = this.profile === "seated" ? Math.PI : measureKnee(pose);
    const kneeValid =
      this.profile === "standing" &&
      (pose.landmarks[LM.LEFT_KNEE]?.visibility ?? 0) >= 0.5 &&
      (pose.landmarks[LM.RIGHT_KNEE]?.visibility ?? 0) >= 0.4;

    const wristAbove = Math.max(
      wristRise(pose, LM.LEFT_WRIST, shoulder.y, torso),
      wristRise(pose, LM.RIGHT_WRIST, shoulder.y, torso),
    );

    const s: Signals = {
      now,
      dt,
      refDx,
      refRise,
      vUp,
      shoulderDrop,
      vShoulderDown,
      kneeAngle: knee,
      restKneeAngle: this.restKneeAngle,
      kneeValid,
      wristAbove,
    };

    const events: GestureEvent[] = [];
    for (const d of this.detectors) {
      const fire = d.update(s);
      if (fire) {
        events.push({
          gesture: fire.gesture,
          playerId: this.id,
          direction: fire.direction,
          atSeconds: now,
          frameTimestampMs: now * 1000,
        });
      }
    }

    // Baselines adapt only near rest, so a held gesture never drags them.
    if (Math.abs(refDx) < 0.12) this.baseHipX = ema(this.baseHipX, ref.x, dt);
    if (Math.abs(refRise) < 0.08) this.baseRefY = ema(this.baseRefY, ref.y, dt);
    if (Math.abs(shoulderDrop) < 0.08) this.baseShoulderY = ema(this.baseShoulderY, shoulder.y, dt);

    const magnitude = this.frameMagnitude(pose, dt, torso);

    this.prevRefY = ref.y;
    this.prevShoulderY = shoulder.y;
    this.prevLandmarks = pose.landmarks;
    this.prevTime = now;

    return { events, magnitude };
  }

  private frameMagnitude(pose: Pose, dt: number, torso: number): number {
    if (!this.prevLandmarks || dt === 0) return 0;
    let sum = 0;
    let n = 0;
    for (const i of STABLE_LANDMARKS) {
      const cur = pose.landmarks[i];
      const prev = this.prevLandmarks[i];
      if (!cur || !prev) continue;
      sum += dist(cur, prev) / torso / dt;
      n++;
    }
    return n === 0 ? 0 : sum / n;
  }

  reset(): void {
    for (const d of this.detectors) d.reset();
  }
}

function wristRise(pose: Pose, wristIndex: number, shoulderY: number, torso: number): number {
  const w = pose.landmarks[wristIndex];
  if (!w || w.visibility < 0.5) return -Infinity;
  return (shoulderY - w.y) / torso; // above shoulder -> positive
}

/** Baseline low-pass with ~1.2s time constant. */
function ema(base: number, value: number, dt: number): number {
  const tau = 1.2;
  const alpha = clamp(dt / tau, 0, 1);
  return base + alpha * (value - base);
}

/** Median helper for calibration accumulation. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

interface CalAccum {
  torsos: number[];
  knees: number[];
}

/**
 * Turns a stream of PoseFrames into gesture events and movement magnitude.
 * Owns calibration (per player, torso scale + rest knee) and player tracking.
 */
export class PoseInterpreter {
  private readonly tracker: PlayerTracker;
  private readonly thresholds: GestureThresholds;
  private readonly runtimes = new Map<number, PlayerRuntime>();
  private readonly calAccum = new Map<number, CalAccum>();
  private phase: "calibrating" | "running" = "calibrating";

  constructor(
    private readonly profile: InputProfile,
    thresholdOverrides?: Parameters<typeof mergeThresholds>[1],
  ) {
    this.thresholds = mergeThresholds(DEFAULT_THRESHOLDS, thresholdOverrides);
    this.tracker = new PlayerTracker(profile);
  }

  get playersTracked(): number {
    return this.runtimes.size || this.tracker.playerCount;
  }

  /** Feed a still-stand frame during the calibration window. */
  addCalibrationFrame(frame: PoseFrame): void {
    const anchor = this.profile === "seated" ? shoulderCentroid : hipCentroid;
    for (const pose of frame.poses) {
      if (!requiredVisible(pose, this.profile)) continue;
      const matched = this.tracker.match({ timestampMs: frame.timestampMs, poses: [pose] });
      let id: number;
      if (matched.length === 0) {
        id = this.tracker.register(anchor(pose), profileScale(pose, this.profile));
        if (id < 0) continue;
        this.calAccum.set(id, { torsos: [], knees: [] });
      } else {
        id = matched[0]!.id;
      }
      const acc = this.calAccum.get(id)!;
      acc.torsos.push(profileScale(pose, this.profile));
      acc.knees.push(this.profile === "seated" ? Math.PI : measureKnee(pose));
    }
  }

  /** Finish calibration; returns how many players registered successfully. */
  finishCalibration(minSamples = 15): number {
    for (const [id, acc] of this.calAccum) {
      if (acc.torsos.length < minSamples) continue;
      const torso = median(acc.torsos);
      if (torso <= 0) continue;
      this.runtimes.set(
        id,
        new PlayerRuntime(id, torso, median(acc.knees), this.profile, this.thresholds),
      );
    }
    this.calAccum.clear();
    this.phase = "running";
    return this.runtimes.size;
  }

  get calibrated(): boolean {
    return this.phase === "running" && this.runtimes.size > 0;
  }

  get calibrationFrameCount(): number {
    let total = 0;
    for (const acc of this.calAccum.values()) total += acc.torsos.length;
    return total;
  }

  /** Process one gameplay frame. `now` is audio-clock seconds. */
  ingest(frame: PoseFrame, now: number): InterpretResult {
    if (this.phase !== "running") {
      return { events: [], movementMagnitude: 0, playersTracked: 0 };
    }
    const matched = this.tracker.match(frame);
    const events: GestureEvent[] = [];
    let magSum = 0;
    let magN = 0;
    for (const { id, pose } of matched) {
      const rt = this.runtimes.get(id);
      if (!rt) continue;
      rt.refreshScale(profileScale(pose, this.profile));
      const res = rt.process(pose, now);
      events.push(...res.events);
      magSum += res.magnitude;
      magN++;
    }
    return {
      events,
      movementMagnitude: magN === 0 ? 0 : magSum / magN,
      playersTracked: magN,
    };
  }

  reset(): void {
    this.tracker.reset();
    this.runtimes.clear();
    this.calAccum.clear();
    this.phase = "calibrating";
  }

  /** Which gestures this profile fires (both fire all four today). */
  static gesturesFor(_profile: InputProfile): GestureId[] {
    return ["jump", "sidestep", "duck", "reach"];
  }
}
