import type { ShowConfig } from "@sw/arcade-engine";
import { buildCues } from "./cueFactory.js";

/**
 * SHOW 2 — Year 9-10. "BASELINE".
 *
 * This is the hard audience, where a bright mascot dies on contact. The fix is
 * to drop the mascot register entirely and borrow the language teenagers
 * already opt into: a rhythm-game / streetwear HUD. Near-black ground, one
 * electric accent, hard neon geometry, no cartoon face — the on-screen figure
 * is a cool, low-status-safe crew SILHOUETTE (an MC hyping the room), not a
 * creature. Voice is dry hype-crew, never chirpy. Half-time 100 BPM so the
 * moves land heavy and it reads as a game, not a workout video.
 *
 * Justification is in the README: the participation drop at this age is a
 * social-risk problem, so the design removes the thing that makes moving feel
 * uncool (performing for a mascot) and replaces it with a format that already
 * carries status.
 */
export const YEAR_9_10: ShowConfig = {
  id: "baseline",
  title: "Baseline",
  aesthetic: "Rhythm-game / streetwear HUD: near-black ground, single electric accent, hard neon geometry, a cool crew silhouette instead of a mascot.",
  targetYears: "Year 9-10",
  defaultLanguage: "en",
  palette: {
    background: "#0a0a0f",
    ink: "#f2f2f7",
    accent: "#00ffa3",
    gesture: {
      jump: { color: "#00ffa3", shape: "triangle" },
      duck: { color: "#ff3b6b", shape: "bar" },
      reach: { color: "#4d9bff", shape: "cross" },
      sidestep: { color: "#c56bff", shape: "chevron" },
    },
  },
  music: {
    bpm: 100,
    beatsPerBar: 4,
    stepsPerBeat: 4,
    rootHz: 55, // deep sub — half-time weight
    scale: [0, 3, 5, 7, 10], // minor pentatonic
    layers: {
      kick: { fromIntensity: 1 },
      bass: { fromIntensity: 1 },
      hats: { fromIntensity: 2 },
      pad: { fromIntensity: 3 },
      lead: { fromIntensity: 4 },
    },
  },
  // A character, but re-registered as a slick crew MC silhouette, not a mascot.
  character: { name: "MC", bodyColor: "#14141c", accentColor: "#00ffa3" },
  vocabulary: ["jump", "duck", "sidestep", "reach"],
  modes: {
    follow: { leadBars: 1, callEveryBars: 2 },
    dodge: { leadBars: 1, callEveryBars: 1 },
  },
  supportedProfiles: ["standing", "seated"],
  cues: buildCues({
    slug: "y910",
    calls: {
      jump: ["Up.", "Jump — on it.", "Air.", "Off the floor.", "Lift."],
      duck: ["Down.", "Drop.", "Under it.", "Low.", "Duck — clean."],
      reach: ["Reach.", "Up high.", "Extend.", "Full stretch.", "Top."],
      sidestep: ["Slide.", "Off the line.", "Shift.", "Cut left, cut right.", "Step out."],
    },
    praise: [
      "Clean.", "That's it.", "Locked in.", "Sharp.", "Yeah, on beat.", "Cold.", "No misses.",
      "Crew's up.", "Tidy.", "On time.", "Solid.", "Run it back.", "Respect.", "In the pocket.",
    ],
    encourage: [
      "Stay with it.", "Find the beat.", "Reset.", "Again.", "Hold the line.",
      "Lock in.", "Ride it.", "Don't drift.", "Back on time.", "Keep the count.",
    ],
    countIn: ["Count it in.", "Four on the floor.", "From the top.", "Here.", "On the one.", "Go."],
    transition: [
      "Switch.", "New pattern.", "Double time coming.", "Flip it.", "Next phase.", "Harder now.",
      "Change up.", "Last run.",
    ],
    idle: [
      "Whole room, in.", "Back row — you're on.", "Move for the crew.", "Don't stall.",
      "Beat's still going.", "Step up.", "We're waiting.", "Show it.",
    ],
  }),
};
