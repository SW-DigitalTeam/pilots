/**
 * Gesture thresholds, all in torso units / radians / seconds. Defaults are
 * tuned against the fixture library; a ShowConfig may override any of them to
 * widen or narrow a show's movement vocabulary.
 */
export interface GestureThresholds {
  jump: {
    /** Upward speed to arm a launch (torso/s). */
    vArm: number;
    /** Rise that confirms the launch was real, not a bob (torso). */
    minRise: number;
    cooldown: number;
  };
  sidestep: {
    enter: number;
    exit: number;
    cooldown: number;
  };
  duck: {
    shoulderEnter: number;
    shoulderExit: number;
    /** Knee must bend at least this far below the calibrated rest angle. */
    kneeBendDelta: number;
    /** Seated fallback: downward shoulder speed that separates a duck from a lean. */
    seatedVDown: number;
    cooldown: number;
  };
  reach: {
    enter: number;
    exit: number;
    cooldown: number;
  };
}

export const DEFAULT_THRESHOLDS: GestureThresholds = {
  jump: { vArm: 1.2, minRise: 0.12, cooldown: 0.35 },
  sidestep: { enter: 0.35, exit: 0.18, cooldown: 0.3 },
  duck: { shoulderEnter: 0.18, shoulderExit: 0.1, kneeBendDelta: 0.45, seatedVDown: 0.9, cooldown: 0.4 },
  reach: { enter: 0.15, exit: 0.02, cooldown: 0.3 },
};

export function mergeThresholds(
  base: GestureThresholds,
  over?: Partial<{ [K in keyof GestureThresholds]: Partial<GestureThresholds[K]> }>,
): GestureThresholds {
  if (!over) return base;
  return {
    jump: { ...base.jump, ...over.jump },
    sidestep: { ...base.sidestep, ...over.sidestep },
    duck: { ...base.duck, ...over.duck },
    reach: { ...base.reach, ...over.reach },
  };
}
