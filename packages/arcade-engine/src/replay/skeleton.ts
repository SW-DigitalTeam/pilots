import { LM } from "../landmarks.js";
import type { Landmark, Pose } from "../types.js";

/**
 * A parametric skeleton in normalised, mirrored (display-space) coordinates,
 * y down. This is how we "record" landmark sequences: instead of hand-typing
 * 33 points per frame, we drive a small set of body parameters and emit poses.
 * The scenarios built on top are the real-jump / fake-jump / lean / side-step /
 * duck / stumble / turn / bystander fixtures the motion critic replays.
 */
export interface BodyParams {
  /** Body centre x (0..1); 0.5 is centred. */
  cx: number;
  /** Vertical translation of the whole body; negative = up (a jump). */
  dy: number;
  /** Knee bend 0..1; bends hip-knee-ankle and lowers the upper body (a squat). */
  kneeBend: number;
  /** Forward lean 0..1; drops the shoulders WITHOUT bending the knees. */
  lean: number;
  /** Torso yaw 0..1; shrinks shoulder/hip width as the player turns. */
  turn: number;
  /** Left / right wrist raise 0..1; 1 puts the wrist well above the shoulder. */
  wristL: number;
  wristR: number;
  /** Overall visibility for the filled landmarks. */
  visibility: number;
}

export const NEUTRAL: BodyParams = {
  cx: 0.5,
  dy: 0,
  kneeBend: 0,
  lean: 0,
  turn: 0,
  wristL: 0,
  wristR: 0,
  visibility: 0.95,
};

function lm(x: number, y: number, v: number): Landmark {
  return { x, y, z: 0, visibility: v };
}

export function buildPose(p: Partial<BodyParams>): Pose {
  const b = { ...NEUTRAL, ...p };
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => lm(0, 0, 0));
  const v = b.visibility;

  const widthS = 0.09 * (1 - 0.7 * b.turn);
  const widthH = 0.07 * (1 - 0.7 * b.turn);

  // Squat lowers the upper body; lean lowers shoulders only.
  const upperDrop = 0.14 * b.kneeBend + 0.14 * b.lean;
  const hipDrop = 0.12 * b.kneeBend;

  const shoulderY = 0.3 + b.dy + upperDrop;
  const hipY = 0.55 + b.dy + hipDrop;
  const noseY = 0.2 + b.dy + upperDrop + 0.05 * b.lean;

  landmarks[LM.NOSE] = lm(b.cx, noseY, v);
  landmarks[LM.LEFT_SHOULDER] = lm(b.cx + widthS, shoulderY, v);
  landmarks[LM.RIGHT_SHOULDER] = lm(b.cx - widthS, shoulderY, v);
  landmarks[LM.LEFT_HIP] = lm(b.cx + widthH, hipY, v);
  landmarks[LM.RIGHT_HIP] = lm(b.cx - widthH, hipY, v);

  // Knees: bending moves them forward (x) and slightly up so the interior
  // hip-knee-ankle angle closes. Ankles stay put on the floor.
  const kneeY = 0.78 + b.dy - 0.03 * b.kneeBend;
  const kneeX = 0.06 * b.kneeBend;
  const ankleY = 0.97 + b.dy;
  landmarks[LM.LEFT_KNEE] = lm(b.cx + widthH + kneeX, kneeY, v);
  landmarks[LM.RIGHT_KNEE] = lm(b.cx - widthH - kneeX, kneeY, v);
  landmarks[LM.LEFT_ANKLE] = lm(b.cx + widthH, ankleY, v);
  landmarks[LM.RIGHT_ANKLE] = lm(b.cx - widthH, ankleY, v);

  // Arms: wrists rest by the hips, or rise above the shoulders when raised.
  const wristLY = shoulderY + 0.25 - (0.4 * b.wristL);
  const wristRY = shoulderY + 0.25 - (0.4 * b.wristR);
  landmarks[LM.LEFT_ELBOW] = lm(b.cx + widthS + 0.02, shoulderY + 0.13, v);
  landmarks[LM.RIGHT_ELBOW] = lm(b.cx - widthS - 0.02, shoulderY + 0.13, v);
  landmarks[LM.LEFT_WRIST] = lm(b.cx + widthS + 0.02, wristLY, v);
  landmarks[LM.RIGHT_WRIST] = lm(b.cx - widthS - 0.02, wristRY, v);

  return { landmarks };
}
