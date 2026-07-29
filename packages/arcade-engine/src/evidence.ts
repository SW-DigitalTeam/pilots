import type { CameraPoseClaim } from "@sw/shell";
import type { SessionSummary } from "./types.js";

/**
 * Maps a session summary to a cameraPose evidence claim — the only thing that
 * leaves the device. By construction it contains derived numbers about a team
 * and nothing else: no landmarks, no frames, no per-student anything. This is
 * the single chokepoint, so the privacy critic has one place to audit.
 */
export function summaryToClaim(summary: SessionSummary): CameraPoseClaim {
  return {
    provider: "cameraPose",
    schemaVersion: 1,
    team: { id: summary.team.id, label: summary.team.label },
    show: summary.show,
    mode: summary.mode,
    inputProfile: summary.inputProfile,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
    activeSeconds: round(summary.activeSeconds, 1),
    movementMagnitude: round(summary.movementMagnitude, 3),
    teamScore: Math.round(summary.teamScore),
    gestureCounts: { ...summary.gestureCounts },
    playersTracked: summary.playersTracked,
  };
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
