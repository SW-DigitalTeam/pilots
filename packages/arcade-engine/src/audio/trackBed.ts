import type { MusicConfig } from "../show.js";
import type { LoopSpec } from "./backend.js";

/**
 * A decoded music track that loops seamlessly over a whole number of bars.
 *
 * AI-generated tracks never land on an exact BPM, so we time-stretch the
 * buffer to fit an integer bar count: the playbackRate that makes the track's
 * length equal N bars at the show's tempo. N is chosen so the rate stays
 * within a musical ±8%, which is inaudible on a looped dance bed. Once the
 * rate is fixed, every bar boundary in the game lands on the same point in
 * the track on every loop — calls feel on-beat and the loop never drifts.
 */
export class TrackBed {
  /** Bar count the track was stretched to loop over. */
  readonly loopBars: number;
  /** The rate to play the buffer at. */
  readonly playbackRate: number;

  constructor(
    private readonly buffer: AudioBuffer,
    private readonly music: MusicConfig,
  ) {
    const barDuration = (60 / music.bpm) * music.beatsPerBar;
    const trackDuration = buffer.duration;
    const bars = Math.max(2, Math.round(trackDuration / barDuration));
    this.loopBars = bars;
    this.playbackRate = trackDuration / (bars * barDuration);
  }

  /** The LoopSpec to start the track at absolute time `when`. */
  loopSpec(when: number, gain = 0.8): LoopSpec {
    return { buffer: this.buffer, when, playbackRate: this.playbackRate, gain };
  }
}
