/**
 * Cheap lip sync: three mouth shapes driven by the voice bus amplitude
 * envelope. No viseme system — three shapes read fine at five metres and cost
 * nothing.
 */
export type MouthShape = "closed" | "mid" | "open";

export function mouthShapeForAmplitude(amp: number): MouthShape {
  if (amp < 0.08) return "closed";
  if (amp < 0.25) return "mid";
  return "open";
}
