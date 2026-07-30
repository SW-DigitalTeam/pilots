/**
 * MediaPipe Pose landmark indices we rely on, and the two landmark subsets
 * that define the standing vs seated input profiles.
 *
 * We deliberately derive gestures from *stable* landmarks (hips, shoulders,
 * knees, wrists) and never from face/foot points, which are noisy and drop out
 * first under bad light or partial framing.
 */
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export type InputProfile = "standing" | "seated";

/** Landmarks that must be visible for a profile's calibration to be valid. */
export const REQUIRED_LANDMARKS: Record<InputProfile, number[]> = {
  standing: [
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
    LM.LEFT_HIP,
    LM.RIGHT_HIP,
    LM.LEFT_KNEE,
    LM.RIGHT_KNEE,
  ],
  // Seated: only shoulders and elbows are required — hips/knees are often
  // occluded by a desk or out of frame on phone selfie cameras. Gestures are
  // driven from the shoulder centroid and arm reach.
  seated: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
};
