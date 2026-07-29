import type { GestureId, InputProfile, Pose, PoseFrame } from "../types.js";
import { buildPose, type BodyParams } from "./skeleton.js";

export interface Fixture {
  name: string;
  profile: InputProfile;
  fps: number;
  calibrationFrames: PoseFrame[];
  frames: PoseFrame[];
  /** Exact expected fire counts for the tracked player. Omitted = 0. */
  expect: Partial<Record<GestureId, number>>;
  /** Seconds at which the intended movement begins, for latency checks. */
  motionStartS?: number;
  /** Human note on what the fixture proves. */
  note: string;
}

type ParamAt = (t: number) => Partial<BodyParams>;
type ExtraAt = (t: number) => Pose[];

function sample(fps: number, duration: number, paramAt: ParamAt, extraAt?: ExtraAt): PoseFrame[] {
  const dt = 1 / fps;
  const frames: PoseFrame[] = [];
  for (let t = 0; t <= duration + 1e-9; t += dt) {
    const poses = [buildPose(paramAt(t)), ...(extraAt ? extraAt(t) : [])];
    frames.push({ timestampMs: Math.round(t * 1000), poses });
  }
  return frames;
}

/** ~1.6s of still standing — the calibration capture. */
export function calibration(fps: number, profile: InputProfile): PoseFrame[] {
  return sample(fps, 1.6, () => ({ visibility: 0.96, kneeBend: profile === "seated" ? 0 : 0 }));
}

/** Smooth 0..1..0 pulse peaking at `peakT`, used to shape a movement. */
function pulse(t: number, start: number, peak: number, end: number): number {
  if (t <= start || t >= end) return 0;
  if (t < peak) return (t - start) / (peak - start);
  return 1 - (t - peak) / (end - peak);
}

const FPS = 25;

export function realJump(fps = FPS): Fixture {
  // Small dip, then a fast launch to a real apex, then land.
  const paramAt: ParamAt = (t) => {
    let dy = 0;
    if (t >= 0.5 && t < 0.62) dy = -((t - 0.5) / 0.12) * 0.18; // launch up
    else if (t >= 0.62 && t < 0.9) dy = -0.18 + ((t - 0.62) / 0.28) * 0.18; // fall
    return { dy };
  };
  return {
    name: "real-jump",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 1.4, paramAt),
    expect: { jump: 1 },
    motionStartS: 0.5,
    note: "A genuine launch clears minRise and fires exactly once.",
  };
}

export function fakeJump(fps = FPS): Fixture {
  // A quick upward bob that never gains real elevation.
  const paramAt: ParamAt = (t) => {
    let dy = 0;
    if (t >= 0.5 && t < 0.54) dy = -0.02;
    else if (t >= 0.54 && t < 0.6) dy = -0.02 + ((t - 0.54) / 0.06) * 0.02;
    return { dy };
  };
  return {
    name: "fake-jump-bob",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 1.2, paramAt),
    expect: {},
    note: "A bob arms then fizzles below minRise: no fire.",
  };
}

export function lean(fps = FPS): Fixture {
  const paramAt: ParamAt = (t) => ({ lean: pulse(t, 0.4, 0.9, 1.6) });
  return {
    name: "lean-forward",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 1.8, paramAt),
    expect: {},
    note: "A lean drops the shoulders but not the knees: duck must NOT fire.",
  };
}

export function sidestepRight(fps = FPS): Fixture {
  const paramAt: ParamAt = (t) => ({ cx: 0.5 + 0.14 * pulse(t, 0.4, 0.7, 1.3) });
  return {
    name: "sidestep-right",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 1.6, paramAt),
    expect: { sidestep: 1 },
    note: "A clear step past the gate fires once, direction right.",
  };
}

export function sidestepLeft(fps = FPS): Fixture {
  const paramAt: ParamAt = (t) => ({ cx: 0.5 - 0.14 * pulse(t, 0.4, 0.7, 1.3) });
  return {
    name: "sidestep-left",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 1.6, paramAt),
    expect: { sidestep: 1 },
    note: "Mirror of sidestep-right, direction left.",
  };
}

export function duck(fps = FPS): Fixture {
  const paramAt: ParamAt = (t) => ({ kneeBend: pulse(t, 0.4, 0.75, 1.4) });
  return {
    name: "duck-squat",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 1.7, paramAt),
    expect: { duck: 1 },
    note: "Shoulder drop WITH knee bend fires duck once; no false jump on rise.",
  };
}

export function reach(fps = FPS): Fixture {
  const paramAt: ParamAt = (t) => ({ wristR: pulse(t, 0.4, 0.8, 1.4) });
  return {
    name: "reach-up",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 1.7, paramAt),
    expect: { reach: 1 },
    note: "A wrist raised above the shoulder line fires reach once.",
  };
}

export function stumble(fps = FPS): Fixture {
  // Chaotic small jitter — stays under every gate.
  const paramAt: ParamAt = (t) => ({
    cx: 0.5 + 0.05 * Math.sin(t * 22),
    dy: 0.015 * Math.sin(t * 30),
    lean: 0.15 * Math.max(0, Math.sin(t * 9)),
  });
  return {
    name: "stumble",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 2.0, paramAt),
    expect: {},
    note: "Small stagger under every gate: no gesture fires.",
  };
}

export function turn(fps = FPS): Fixture {
  const paramAt: ParamAt = (t) => ({ turn: pulse(t, 0.3, 1.0, 1.8), cx: 0.5 + 0.02 * Math.sin(t * 6) });
  return {
    name: "turn-in-place",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 2.0, paramAt),
    expect: {},
    note: "Turning narrows the shoulders but moves nothing through a gate.",
  };
}

export function bystander(fps = FPS): Fixture {
  // Primary player stands still; a bystander walks across behind them.
  const primary: ParamAt = () => ({ visibility: 0.96 });
  const extra: ExtraAt = (t) => {
    const cx = 0.12 + (t / 2.0) * 0.76; // walk left -> right
    const bob = -0.05 * Math.abs(Math.sin(t * 6)); // walking bob
    return [buildPose({ cx, dy: bob, visibility: 0.9 })];
  };
  return {
    name: "bystander-walkthrough",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 2.0, primary, extra),
    expect: {},
    note: "An unregistered bystander crossing frame never fires the tracked player.",
  };
}

export function sustainedDuck(fps = FPS): Fixture {
  // Squat and HOLD for over a second — cooldown/hysteresis must yield one fire.
  const paramAt: ParamAt = (t) => {
    let kneeBend = 0;
    if (t >= 0.4 && t < 0.6) kneeBend = (t - 0.4) / 0.2;
    else if (t >= 0.6 && t < 1.8) kneeBend = 1;
    else if (t >= 1.8 && t < 2.0) kneeBend = 1 - (t - 1.8) / 0.2;
    return { kneeBend };
  };
  return {
    name: "sustained-duck",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 2.2, paramAt),
    expect: { duck: 1 },
    note: "A held duck fires exactly once, never chatters.",
  };
}

export function doubleJump(fps = FPS): Fixture {
  // Two separate launches with a clear gap; re-arm must allow a second fire.
  const oneJump = (t: number, start: number): number => {
    if (t >= start && t < start + 0.12) return -((t - start) / 0.12) * 0.18;
    if (t >= start + 0.12 && t < start + 0.4) return -0.18 + ((t - start - 0.12) / 0.28) * 0.18;
    return 0;
  };
  const paramAt: ParamAt = (t) => ({ dy: oneJump(t, 0.4) + oneJump(t, 1.4) });
  return {
    name: "double-jump",
    profile: "standing",
    fps,
    calibrationFrames: calibration(fps, "standing"),
    frames: sample(fps, 2.2, paramAt),
    expect: { jump: 2 },
    note: "Two distinct jumps fire twice — cooldown gates repeats, not new moves.",
  };
}

export function twoPlayerJump(fps = FPS): Fixture {
  // Two players calibrate side by side; each jumps once, at different times.
  const left = 0.32;
  const right = 0.68;
  const jumpAt = (t: number, start: number): number => {
    if (t >= start && t < start + 0.12) return -((t - start) / 0.12) * 0.18;
    if (t >= start + 0.12 && t < start + 0.4) return -0.18 + ((t - start - 0.12) / 0.28) * 0.18;
    return 0;
  };
  const calib: PoseFrame[] = [];
  const dt = 1 / fps;
  for (let t = 0; t <= 1.6 + 1e-9; t += dt) {
    calib.push({
      timestampMs: Math.round(t * 1000),
      poses: [buildPose({ cx: left }), buildPose({ cx: right })],
    });
  }
  const frames: PoseFrame[] = [];
  for (let t = 0; t <= 2.2 + 1e-9; t += dt) {
    frames.push({
      timestampMs: Math.round(t * 1000),
      poses: [buildPose({ cx: left, dy: jumpAt(t, 0.4) }), buildPose({ cx: right, dy: jumpAt(t, 1.2) })],
    });
  }
  return {
    name: "two-player-jump",
    profile: "standing",
    fps,
    calibrationFrames: calib,
    frames,
    expect: { jump: 2 },
    note: "Two tracked players jump independently; two fires, no cross-talk.",
  };
}

/** Seated reach — same game, upper-body only. */
export function seatedReach(fps = FPS): Fixture {
  const paramAt: ParamAt = (t) => ({ wristL: pulse(t, 0.4, 0.8, 1.4), visibility: 0.9 });
  return {
    name: "seated-reach",
    profile: "seated",
    fps,
    calibrationFrames: calibration(fps, "seated"),
    frames: sample(fps, 1.7, paramAt),
    expect: { reach: 1 },
    note: "Seated profile fires reach identically to standing.",
  };
}

export const ALL_FIXTURES: Fixture[] = [
  realJump(),
  fakeJump(),
  lean(),
  sidestepRight(),
  sidestepLeft(),
  duck(),
  reach(),
  stumble(),
  turn(),
  bystander(),
  sustainedDuck(),
  doubleJump(),
  twoPlayerJump(),
  seatedReach(),
];
