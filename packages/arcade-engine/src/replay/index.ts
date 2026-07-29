import { PoseInterpreter } from "../interpreter.js";
import type { GestureEvent, GestureId } from "../types.js";
import type { Fixture } from "./scenarios.js";

export * from "./scenarios.js";
export * from "./skeleton.js";

const GESTURES: GestureId[] = ["jump", "sidestep", "duck", "reach"];

export interface ReplayReport {
  fixture: string;
  counts: Record<GestureId, number>;
  events: GestureEvent[];
  playersCalibrated: number;
  /** First fire time in seconds, or null. */
  firstFireS: number | null;
  /** Detection latency vs the fixture's motionStartS, ms (null if N/A). */
  latencyMs: number | null;
}

/**
 * Feed a fixture through a fresh interpreter exactly as the live pipeline would:
 * calibration window first, then gameplay frames on the frame clock. This is
 * the rig every motion-critic assertion runs against, so a gesture can be
 * *proven*, not eyeballed.
 */
export function replay(fixture: Fixture): ReplayReport {
  const interp = new PoseInterpreter(fixture.profile, undefined);
  for (const f of fixture.calibrationFrames) interp.addCalibrationFrame(f);
  const playersCalibrated = interp.finishCalibration();

  const counts: Record<GestureId, number> = { jump: 0, sidestep: 0, duck: 0, reach: 0 };
  const events: GestureEvent[] = [];
  for (const frame of fixture.frames) {
    const now = frame.timestampMs / 1000;
    const res = interp.ingest(frame, now);
    for (const e of res.events) {
      counts[e.gesture]++;
      events.push(e);
    }
  }

  const firstFireS = events.length > 0 ? events[0]!.atSeconds : null;
  const latencyMs =
    firstFireS !== null && fixture.motionStartS !== undefined
      ? (firstFireS - fixture.motionStartS) * 1000
      : null;

  return { fixture: fixture.name, counts, events, playersCalibrated, firstFireS, latencyMs };
}

/** Serialise a fixture to the on-disk JSON shape (landmark sequences). */
export function fixtureToJSON(fixture: Fixture): string {
  return JSON.stringify(
    {
      name: fixture.name,
      profile: fixture.profile,
      fps: fixture.fps,
      expect: fixture.expect,
      motionStartS: fixture.motionStartS,
      note: fixture.note,
      calibrationFrames: fixture.calibrationFrames,
      frames: fixture.frames,
    },
    null,
    0,
  );
}

export { GESTURES };
