import type { InputProfile } from "./landmarks.js";

export type { InputProfile };

/** A single normalised landmark from MediaPipe (image space, 0..1). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** 0..1; below the gate we treat the point as missing. */
  visibility: number;
}

/** One detected person in one frame. */
export interface Pose {
  landmarks: Landmark[];
}

/** One capture frame: zero or more poses plus the capture timestamp (ms). */
export interface PoseFrame {
  timestampMs: number;
  poses: Pose[];
}

export type GestureId = "jump" | "sidestep" | "duck" | "reach";

export type Mode = "follow" | "dodge" | "pop";

/** A class, never a student. */
export interface Team {
  id: string;
  label: string;
}

/** Emitted the instant a player's gesture state machine fires. */
export interface GestureEvent {
  gesture: GestureId;
  /** Which tracked player slot fired it. */
  playerId: number;
  /** For sidestep: the direction in room space (already mirrored). */
  direction?: "left" | "right";
  /** Audio-clock time of the fire, in seconds. */
  atSeconds: number;
  /** Capture timestamp of the frame that produced it (ms). */
  frameTimestampMs: number;
}

export interface SessionSummary {
  team: Team;
  show: string;
  mode: Mode;
  inputProfile: InputProfile;
  startedAt: number;
  endedAt: number;
  activeSeconds: number;
  movementMagnitude: number;
  teamScore: number;
  gestureCounts: Record<GestureId, number>;
  playersTracked: number;
}
