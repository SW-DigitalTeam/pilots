import { hipCentroid, requiredVisible, shoulderCentroid, profileScale } from "./calibration.js";
import { dist, type Vec2 } from "./math.js";
import type { InputProfile, Pose, PoseFrame } from "./types.js";

/**
 * Stable per-player identity across frames.
 *
 * Players are *registered* during calibration. During play we only ever report
 * poses that match a registered slot, matched by nearest centroid within a
 * torso-scaled gate. For seated the shoulder centroid is used since hips are
 * often out of frame on phone cameras.
 */
export interface PlayerSlot {
  id: number;
  anchor: Vec2;
  torso: number;
}

export interface MatchedPlayer {
  id: number;
  pose: Pose;
}

function anchorOf(pose: Pose, profile: InputProfile): Vec2 {
  return profile === "seated" ? shoulderCentroid(pose) : hipCentroid(pose);
}

export class PlayerTracker {
  private slots: PlayerSlot[] = [];
  private nextId = 0;

  constructor(
    private readonly profile: InputProfile,
    /** Match gate as a multiple of torso length. */
    private readonly gateTorsos = 1.25,
    private readonly maxPlayers = 4,
  ) {}

  get playerCount(): number {
    return this.slots.length;
  }

  /** Register a player at a calibrated anchor/scale. */
  register(anchor: Vec2, torso: number): number {
    if (this.slots.length >= this.maxPlayers) return -1;
    const id = this.nextId++;
    this.slots.push({ id, anchor, torso });
    return id;
  }

  /**
   * Match this frame's poses to registered slots. Greedy by ascending distance
   * so the closest pair binds first. Updates each matched slot's anchor so the
   * gate travels with the player. Returns only matched, registered players.
   */
  match(frame: PoseFrame): MatchedPlayer[] {
    const candidates = frame.poses.filter((p) => requiredVisible(p, this.profile));
    const pairs: Array<{ slot: PlayerSlot; pose: Pose; d: number }> = [];
    for (const slot of this.slots) {
      for (const pose of candidates) {
        const d = dist(slot.anchor, anchorOf(pose, this.profile));
        if (d <= this.gateTorsos * slot.torso) pairs.push({ slot, pose, d });
      }
    }
    pairs.sort((a, b) => a.d - b.d);

    const usedSlots = new Set<number>();
    const usedPoses = new Set<Pose>();
    const out: MatchedPlayer[] = [];
    for (const { slot, pose } of pairs) {
      if (usedSlots.has(slot.id) || usedPoses.has(pose)) continue;
      usedSlots.add(slot.id);
      usedPoses.add(pose);
      slot.anchor = anchorOf(pose, this.profile);
      slot.torso = profileScale(pose, this.profile);
      out.push({ id: slot.id, pose });
    }
    return out.sort((a, b) => a.id - b.id);
  }

  reset(): void {
    this.slots = [];
    this.nextId = 0;
  }
}
