import type { ShowConfig } from "@sw/arcade-engine";
import { buildCues } from "./cueFactory.js";

/**
 * SHOW 1 — Year 7-8. "TARAPĪ'S POWER-UP PARTY".
 *
 * Aesthetic direction: SATURATED COMIC-BOOK. Original chunky creature Tarapī
 * (a made-up spiky forest critter, owned outright — no existing fitness brand
 * or presenter), thick black outlines, halftone-free flat pop fills, speech
 * bursts. High energy and unashamedly silly, because this age still buys in.
 * Bright by design, but every colour is paired with a bold shape so it survives
 * a washed-out projector.
 */
export const YEAR_7_8: ShowConfig = {
  id: "tarapi-power-up",
  title: "Tarapī's Power-Up Party",
  aesthetic: "Saturated comic-book pop: thick outlines, flat vivid fills, speech-burst callouts, an original spiky critter mascot.",
  targetYears: "Year 7-8",
  defaultLanguage: "en",
  palette: {
    background: "#1b0b3b",
    ink: "#ffffff",
    accent: "#ffd400",
    gesture: {
      jump: { color: "#ff2e63", shape: "triangle" },
      duck: { color: "#00e0ff", shape: "bar" },
      reach: { color: "#7cf03d", shape: "diamond" },
      sidestep: { color: "#ff8a00", shape: "chevron" },
    },
  },
  music: {
    bpm: 128,
    beatsPerBar: 4,
    stepsPerBeat: 4,
    rootHz: 130.81,
    scale: [0, 2, 4, 7, 9], // bright major pentatonic
    layers: {
      kick: { fromIntensity: 1 },
      bass: { fromIntensity: 2 },
      hats: { fromIntensity: 2 },
      pad: { fromIntensity: 3 },
      lead: { fromIntensity: 4 },
    },
    trackUrl: "/audio/music/tarapi.mp3",
  },
  character: { name: "Tarapī", bodyColor: "#ff2e63", accentColor: "#ffd400" },
  vocabulary: ["jump", "duck", "reach", "sidestep"],
  modes: {
    follow: { leadBars: 1, callEveryBars: 2 },
    pop: { leadBars: 1, callEveryBars: 1 },
  },
  supportedProfiles: ["standing", "seated"],
  cues: buildCues({
    slug: "y78",
    calls: {
      jump: ["JUMP!", "Boing! Up you go!", "POWER JUMP!", "Launch it!", "Springs on — JUMP!"],
      duck: ["DUCK!", "Down low!", "Hide! Duck it!", "Squish down!", "Under the log — DUCK!"],
      reach: ["REACH!", "Grab a star!", "Stretch up tall!", "Touch the sky!", "Big reach!"],
      sidestep: ["STEP!", "Slide across!", "Zippy side-step!", "Shuffle it!", "Dodge sideways!"],
    },
    praise: [
      "MEGA!", "You did it!", "So good!", "Power-up!", "Legend!", "Boom!", "Nailed it!",
      "Too easy!", "Superstar!", "Yeah!", "Sparkles!", "Champion!", "Wowee!", "Ka-pow!",
    ],
    encourage: [
      "Keep going!", "You've got this!", "Nearly!", "Try again!", "Come on team!",
      "Bring it!", "Big energy!", "Don't stop!", "Shake it out!", "Here we go!",
    ],
    countIn: ["Ready... GO!", "Three, two, one!", "Here it comes!", "Get set!", "Power on!", "Let's move!"],
    transition: [
      "New move!", "Switch it up!", "Round two!", "Faster now!", "Level up!", "Here's a tricky one!",
      "Mix it up!", "Big finish soon!",
    ],
    idle: [
      "You awake back there?", "Give me a wiggle!", "Warm those legs!", "Bounce a bit!",
      "Show me something!", "Don't go to sleep!", "Wiggle wiggle!", "Let's gooo!",
    ],
  }),
};
