/**
 * Evidence-claim schema for the `cameraPose` provider.
 *
 * This is the ONLY shape allowed to leave an activity. It is deliberately made
 * of derived numbers about a *team* (a class), never a student, and it can
 * carry no pixels, no landmark coordinates, and no free geometry. The runtime
 * validator below is what the integration critic checks engine output against,
 * and what the transport layer runs before anything is submitted.
 */

export const CAMERA_POSE_PROVIDER = "cameraPose" as const;

export type GestureCount = {
  jump: number;
  sidestep: number;
  duck: number;
  reach: number;
};

export interface CameraPoseClaim {
  provider: typeof CAMERA_POSE_PROVIDER;
  /** Schema version so the shell can evolve validation without breaking pilots. */
  schemaVersion: 1;
  /** Class-level identity only. Enforced: no per-student fields exist here. */
  team: { id: string; label: string };
  show: string;
  mode: "follow" | "dodge" | "pop";
  inputProfile: "standing" | "seated";
  /** Wall-clock window this claim summarises. */
  startedAt: number;
  endedAt: number;
  /** Derived numbers only. */
  activeSeconds: number;
  /** Session-mean movement magnitude, normalised (torso units / s). */
  movementMagnitude: number;
  /** Effort-based team score (Movement Points). */
  teamScore: number;
  gestureCounts: GestureCount;
  /** How many players were tracked (a count, never an identity). */
  playersTracked: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const FORBIDDEN_KEYS = [
  "landmarks",
  "landmark",
  "keypoints",
  "frame",
  "frames",
  "image",
  "imageData",
  "pixels",
  "dataUrl",
  "blob",
  "canvas",
  "student",
  "studentId",
  "studentName",
  "name",
  "faces",
  "video",
];

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/**
 * Structural + safety validation. Rejects anything with a forbidden key
 * anywhere in the object graph, so a well-meaning caller cannot smuggle raw
 * geometry through by nesting it.
 */
export function validateCameraPoseClaim(claim: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof claim !== "object" || claim === null) {
    return { ok: false, errors: ["claim is not an object"] };
  }

  const deepForbidden = findForbiddenKey(claim);
  if (deepForbidden) errors.push(`forbidden key present: ${deepForbidden}`);

  const c = claim as Record<string, unknown>;
  if (c.provider !== CAMERA_POSE_PROVIDER) errors.push("provider must be 'cameraPose'");
  if (c.schemaVersion !== 1) errors.push("schemaVersion must be 1");

  const team = c.team as Record<string, unknown> | undefined;
  if (!team || typeof team.id !== "string" || typeof team.label !== "string") {
    errors.push("team.id and team.label are required strings");
  } else if (Object.keys(team).length !== 2) {
    errors.push("team must contain only id and label (no per-student fields)");
  }

  if (typeof c.show !== "string") errors.push("show is required");
  if (c.mode !== "follow" && c.mode !== "dodge" && c.mode !== "pop") errors.push("mode invalid");
  if (c.inputProfile !== "standing" && c.inputProfile !== "seated") errors.push("inputProfile invalid");

  if (!isFiniteNonNegative(c.startedAt)) errors.push("startedAt invalid");
  if (!isFiniteNonNegative(c.endedAt)) errors.push("endedAt invalid");
  if (isFiniteNonNegative(c.startedAt) && isFiniteNonNegative(c.endedAt) && c.endedAt < c.startedAt) {
    errors.push("endedAt precedes startedAt");
  }
  if (!isFiniteNonNegative(c.activeSeconds)) errors.push("activeSeconds invalid");
  if (!isFiniteNonNegative(c.movementMagnitude)) errors.push("movementMagnitude invalid");
  if (!isFiniteNonNegative(c.teamScore)) errors.push("teamScore invalid");
  if (!isFiniteNonNegative(c.playersTracked)) errors.push("playersTracked invalid");

  const g = c.gestureCounts as Record<string, unknown> | undefined;
  if (!g) {
    errors.push("gestureCounts required");
  } else {
    for (const k of ["jump", "sidestep", "duck", "reach"]) {
      if (!isFiniteNonNegative(g[k])) errors.push(`gestureCounts.${k} invalid`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function findForbiddenKey(value: unknown, seen = new Set<unknown>()): string | null {
  if (typeof value !== "object" || value === null) return null;
  if (seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key)) return key;
    const nested = findForbiddenKey(child, seen);
    if (nested) return nested;
  }
  return null;
}
