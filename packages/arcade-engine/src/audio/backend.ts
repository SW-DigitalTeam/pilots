/**
 * The scheduler talks to audio through this narrow backend so it can run
 * headless in tests. A real implementation wraps Web Audio (see
 * webAudioBackend.ts); the fake records every scheduled onset so the audio
 * critic can measure scheduled-vs-grid onset and prove there is no drift, no
 * dropped or duplicated event, and no click at bar boundaries.
 */
export type Waveform = "sine" | "square" | "sawtooth" | "triangle" | "noise";

export interface ToneSpec {
  /** Absolute start time on the audio clock (seconds). */
  when: number;
  /** Length in seconds. */
  duration: number;
  freq: number;
  waveform: Waveform;
  /** Peak gain 0..1 before the music-bus fader. */
  gain: number;
  /** Which musical layer this belongs to (for mixing/analysis). */
  layer: string;
}

export interface VoiceSpec {
  when: number;
  cueId: string;
  language: string;
  durationSeconds: number;
  buffer?: AudioBuffer;
}

export interface AudioBackend {
  /** The master clock. */
  readonly currentTime: number;
  /** Schedule one procedural music tone at an absolute time. */
  scheduleTone(spec: ToneSpec): void;
  /** Schedule a voice cue buffer at an absolute time. */
  scheduleVoice(spec: VoiceSpec): void;
  /** Duck the music bus by `db` starting at `when` over `rampMs`. */
  duck(when: number, db: number, rampMs: number): void;
  /** Recover the music bus at `when` over `rampMs`. */
  unduck(when: number, rampMs: number): void;
}

export interface RecordedDuck {
  when: number;
  db: number;
  rampMs: number;
}

/** Deterministic backend for tests: never makes sound, records everything. */
export class FakeAudioBackend implements AudioBackend {
  currentTime = 0;
  readonly tones: ToneSpec[] = [];
  readonly voices: VoiceSpec[] = [];
  readonly ducks: RecordedDuck[] = [];
  readonly unducks: Array<{ when: number; rampMs: number }> = [];

  scheduleTone(spec: ToneSpec): void {
    this.tones.push(spec);
  }
  scheduleVoice(spec: VoiceSpec): void {
    this.voices.push(spec);
  }
  duck(when: number, db: number, rampMs: number): void {
    this.ducks.push({ when, db, rampMs });
  }
  unduck(when: number, rampMs: number): void {
    this.unducks.push({ when, rampMs });
  }

  advanceTo(t: number): void {
    this.currentTime = t;
  }
}
