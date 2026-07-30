import type { GestureThresholds } from "./gestures/config.js";
import type { GestureId, InputProfile, Mode } from "./types.js";

export type CueCategory = "call" | "praise" | "encourage" | "count-in" | "transition" | "idle";

export type Language = "en" | "mi";

/**
 * A voice line. English and te reo Māori SHARE this one definition — same id,
 * same duration in beats, same category — so a show can switch language without
 * retiming. Only the text and the decoded buffer differ per language.
 *
 * `buffer` is filled at load from a compressed asset; it is intentionally
 * optional so the engine and its tests run headless with a synthetic voice.
 */
export interface Cue {
  id: string;
  textEn: string;
  textMi: string;
  durationBeats: number;
  category: CueCategory;
  /** For `call` cues: which move this line asks for. */
  gesture?: GestureId;
  /** Decoded audio per language, injected by the loader. */
  buffer?: Partial<Record<Language, AudioBuffer>>;
}

/** A named colour ALWAYS paired with a shape, because projector colour lies. */
export interface ColorShape {
  color: string;
  /** Redundant, non-colour carrier of the same meaning. */
  shape: "circle" | "square" | "triangle" | "diamond" | "chevron" | "bar" | "cross";
}

export interface Palette {
  /** High-contrast background; gyms are bright. */
  background: string;
  ink: string;
  /** Per-gesture colour+shape so meaning survives bad projector colour. */
  gesture: Record<GestureId, ColorShape>;
  /** Accent used for the beat markers and hit windows. */
  accent: string;
}

export interface MusicLayerConfig {
  /** Which intensity tier switches this layer on (1 = always on). */
  fromIntensity: number;
}

export interface MusicConfig {
  bpm: number;
  beatsPerBar: number;
  /** Grid resolution; 4 = sixteenth notes at 4/4. */
  stepsPerBeat: number;
  /** Root frequency (Hz) for the procedural bass/pad. */
  rootHz: number;
  /** Musical mode degrees (semitone offsets) the bed draws from. */
  scale: number[];
  layers: {
    kick: MusicLayerConfig;
    bass: MusicLayerConfig;
    hats: MusicLayerConfig;
    pad: MusicLayerConfig;
    lead: MusicLayerConfig;
  };
  /**
   * Optional path to an AI-generated/original music track (mp3/wav). When
   * present, the track loops as the bed and the procedural synth drops to a
   * rhythm skeleton. Falls back to full procedural music when absent or if
   * the file fails to load.
   */
  trackUrl?: string;
}

export interface ModeConfig {
  /** How far ahead of the scoring window the call fires. Anticipatory. */
  leadBars: number;
  /** Bars between calls at base intensity. */
  callEveryBars: number;
}

export interface CharacterConfig {
  name: string;
  /** Palette-driven; no external art required to run. */
  bodyColor: string;
  accentColor: string;
}

export interface ShowConfig {
  id: string;
  title: string;
  /** One-line statement of the aesthetic direction (see README). */
  aesthetic: string;
  targetYears: string;
  defaultLanguage: Language;
  palette: Palette;
  /** Optional AI-generated background art. Drawn behind everything, darkened
   * so gameplay elements pop. Falls back to the procedural background when
   * absent or if the image fails to load. */
  backgroundUrl?: string;
  music: MusicConfig;
  cues: Cue[];
  /** null = the deliberately character-free show. */
  character: CharacterConfig | null;
  vocabulary: GestureId[];
  thresholdOverrides?: Partial<{ [K in keyof GestureThresholds]: Partial<GestureThresholds[K]> }>;
  modes: Partial<Record<Mode, ModeConfig>>;
  supportedProfiles: InputProfile[];
}
