import type { ShowConfig } from "@sw/arcade-engine";
import { buildCues } from "./cueFactory.js";

/**
 * SHOW 3 — Character-free. "GRID".
 *
 * For students who find a performing character embarrassing, the whole social
 * layer is removed: there is NO character, no face, nothing performing at you.
 * Aesthetic direction: BAUHAUS / RISOGRAPH — a flat off-white ground, three
 * primary inks, pure geometric shapes on a grid that move on the beat. The
 * "call" is a shape sliding into a target frame; you match the shape with your
 * body. Voice is a spare, neutral count — no praise theatre, just rhythm and
 * form. It is deliberately calm, which is its own distinct energy.
 */
export const PURE_SHAPES: ShowConfig = {
  id: "grid",
  title: "Grid",
  aesthetic: "Bauhaus / risograph: flat off-white ground, three primary inks, pure geometric shapes moving on a grid. No character at all.",
  targetYears: "Any (character-free)",
  defaultLanguage: "en",
  palette: {
    // Off-white ground reads calm and still holds high contrast for the inks.
    background: "#f4f1e8",
    ink: "#141414",
    accent: "#e63025",
    gesture: {
      jump: { color: "#e63025", shape: "triangle" },
      duck: { color: "#141414", shape: "bar" },
      reach: { color: "#f2b705", shape: "circle" },
      sidestep: { color: "#2b50e6", shape: "square" },
    },
  },
  backgroundUrl: "/assets/bg/grid.png",
  music: {
    bpm: 120,
    beatsPerBar: 4,
    stepsPerBeat: 4,
    rootHz: 98, // G2 — warm, neutral
    scale: [0, 2, 4, 5, 7], // clean, unhurried
    layers: {
      kick: { fromIntensity: 1 },
      bass: { fromIntensity: 2 },
      hats: { fromIntensity: 3 },
      pad: { fromIntensity: 2 },
      lead: { fromIntensity: 5 }, // lead stays out until very high intensity
    },
    trackUrl: "/audio/music/grid.mp3",
  },
  character: null,
  vocabulary: ["jump", "duck", "reach", "sidestep"],
  modes: {
    follow: { leadBars: 1, callEveryBars: 2 },
  },
  supportedProfiles: ["standing", "seated"],
  cues: buildCues({
    slug: "grid",
    calls: {
      jump: ["Up.", "Rise.", "Jump.", "Lift.", "Off.", "Peak."],
      duck: ["Down.", "Low.", "Duck.", "Drop.", "Under.", "Fold."],
      reach: ["Reach.", "Up.", "Extend.", "Tall.", "Top.", "Open."],
      sidestep: ["Side.", "Across.", "Step.", "Shift.", "Out.", "Over."],
    },
    // Neutral, minimal — no praise theatre. Short acknowledgements only.
    praise: ["Yes.", "Good.", "Match.", "On.", "Set.", "Done.", "Clean.", "There.", "Right.", "Held.", "Square.", "True."],
    encourage: ["Again.", "Keep time.", "Find it.", "Stay.", "Hold.", "Reset.", "Steady.", "In time.", "Line up.", "Hold form."],
    countIn: ["One, two.", "Two, three.", "From here.", "Begin.", "Now.", "Go.", "Ready.", "Set."],
    transition: ["Change.", "Next.", "Turn.", "New shape.", "Shift.", "Again.", "Rotate.", "Reset form."],
    idle: ["Move.", "With the beat.", "Your turn.", "Begin when ready.", "Step in.", "Now.", "Join in.", "Any time."],
  }),
};
