import type { MusicConfig } from "../show.js";
import type { ToneSpec, Waveform } from "./backend.js";

/**
 * Procedural, bar-locked music. Built from oscillators and noise, never an
 * <audio> loop that could restart and click. Intensity raises the arrangement
 * by switching layers ON — it never changes tempo, so the beat grid the whole
 * game hangs off stays fixed for the entire session.
 *
 * The arrangement is chord-progression driven: a 4-bar cycle (I, V, vi, IV in
 * scale degrees) gives the bass, pad and lead harmonic direction, so the music
 * sounds composed rather than a drone.
 */
export class MusicBed {
  private readonly stepsPerBar: number;
  private readonly secondsPerStep: number;

  constructor(private readonly cfg: MusicConfig) {
    this.stepsPerBar = cfg.beatsPerBar * cfg.stepsPerBeat;
    this.secondsPerStep = 60 / cfg.bpm / cfg.stepsPerBeat;
  }

  private hz(semitoneFromRoot: number): number {
    return this.cfg.rootHz * Math.pow(2, semitoneFromRoot / 12);
  }

  private layerOn(name: keyof MusicConfig["layers"], intensity: number): boolean {
    return intensity >= this.cfg.layers[name].fromIntensity;
  }

  /**
   * Tones that begin exactly at `when`, the grid time of `absoluteStep`.
   *
   * Chord cycle (in scale-degree indices, wraps around the show's scale):
   *   bar 0 → tonic (degree 0)
   *   bar 1 → dominant-ish (degree 4 / fifth)
   *   bar 2 → relative (degree 5 / sixth)
   *   bar 3 → subdominant-ish (degree 3 / fourth)
   */
  tonesForStep(absoluteStep: number, when: number, intensity: number): ToneSpec[] {
    const spb = this.cfg.stepsPerBeat;
    const barIndex = Math.floor(absoluteStep / this.stepsPerBar);
    const stepInBar = ((absoluteStep % this.stepsPerBar) + this.stepsPerBar) % this.stepsPerBar;
    const beatInBar = Math.floor(stepInBar / spb);
    const isBeat = stepInBar % spb === 0;
    const isOffEighth = spb % 2 === 0 && stepInBar % spb === spb / 2;
    const isBarStart = stepInBar === 0;
    const stepDur = this.secondsPerStep;
    const beatDur = stepDur * spb;
    const barDur = beatDur * this.cfg.beatsPerBar;
    const scale = this.cfg.scale;
    const out: ToneSpec[] = [];

    // ── Chord for this bar (4-bar cycle) ─────────────────────────
    const chordDegrees = [0, 4, 5, 3]; // I, V, vi, IV as scale-degree indexes
    const chordRootIdx = chordDegrees[barIndex % 4]!;
    const chordRoot = scale[chordRootIdx % scale.length] ?? 0;
    const chordThird = scale[(chordRootIdx + 2) % scale.length] ?? 4;
    const chordFifth = scale[(chordRootIdx + 4) % scale.length] ?? 7;

    // ── KICK: four-on-the-floor + a bounce 8th before beat 3 ────
    if (this.layerOn("kick", intensity)) {
      if (isBeat) {
        out.push(tone(when, Math.min(0.14, beatDur * 0.9), this.hz(-24), "sine", 0.95, "kick"));
      }
      // bounce kick on the "and" of beat 2 (before beat 3). Layered separately
      // from "kick" so the on-beat kick critic still sees one kick per beat.
      if (stepInBar === spb * 2 + spb / 2) {
        out.push(tone(when, 0.09, this.hz(-24), "sine", 0.6, "kickBounce"));
      }
    }

    // ── SNARE: beats 2 & 4 (pop backbeat) ────────────────────────
    if (this.layerOn("hats", intensity)) {
      if (isBeat && (beatInBar === 1 || beatInBar === 3)) {
        out.push(tone(when, 0.12, 1800, "noise", 0.35, "snare"));
      }
    }

    // ── HATS: off-8ths + 16th shimmer at high intensity ──────────
    if (this.layerOn("hats", intensity)) {
      if (isOffEighth) {
        out.push(tone(when, 0.035, 8000, "noise", 0.18, "hats"));
      }
      // extra 16ths at intensity 3+
      if (intensity >= 3 && spb % 4 === 0 && stepInBar % (spb / 2) === 0 && !isBeat) {
        out.push(tone(when, 0.02, 9000, "noise", 0.08, "hats"));
      }
    }

    // ── BASS: bouncy 8th-note line, root→fifth pattern ───────────
    if (this.layerOn("bass", intensity)) {
      const eighthStep = stepInBar % (spb / 2) === 0;
      if (eighthStep) {
        // Walking pattern: root on 1 & "and" of 1, fifth on 2, root on 3, octave pop on 4
        const eighthIdx = Math.floor(stepInBar / (spb / 2));
        const pattern = [0, 0, 7, 0, 0, 0, 7, 12]; // semitones above chord root
        const semitone = pattern[eighthIdx % pattern.length] ?? 0;
        const accent = eighthIdx % 2 === 0 ? 0.32 : 0.22;
        out.push(tone(when, beatDur * 0.5 * 0.9, this.hz(chordRoot + semitone - 12), "sawtooth", accent, "bass"));
      }
    }

    // ── PAD: chord tones spanning the whole bar ──────────────────
    if (isBarStart && this.layerOn("pad", intensity)) {
      out.push(tone(when, barDur, this.hz(chordRoot), "triangle", 0.1, "pad"));
      out.push(tone(when, barDur, this.hz(chordThird), "triangle", 0.08, "pad"));
      out.push(tone(when, barDur, this.hz(chordFifth), "sine", 0.07, "pad"));
    }

    // ── LEAD: pentatonic riff, 2 bars of call, 2 bars of answer ──
    if (this.layerOn("lead", intensity) && isBeat) {
      // Melody contour: call phrase (bars 0-1), answer phrase (bars 2-3)
      const phrase = [0, 2, 4, 2, 5, 4, 2, 0]; // scale-degree pattern over 8 beats
      const melodyIdx = (barIndex % 2) * 4 + beatInBar;
      const deg = phrase[melodyIdx % phrase.length] ?? 0;
      const note = scale[(chordRootIdx + deg) % scale.length] ?? 0;
      const dur = beatInBar === this.cfg.beatsPerBar - 1 ? beatDur * 0.9 : beatDur * 0.45;
      out.push(tone(when, dur, this.hz(note + 12), "square", 0.08, "lead"));
      // harmony third at intensity 4+
      if (intensity >= 4) {
        const thirdNote = scale[(chordRootIdx + deg + 2) % scale.length] ?? 0;
        out.push(tone(when, dur, this.hz(thirdNote + 12), "square", 0.04, "lead"));
      }
    }

    // ── ARPEGGIO: 16th-note sparkle at high intensity ────────────
    if (this.layerOn("lead", intensity) && intensity >= 3 && spb % 2 === 0) {
      const arpNotes = [chordRoot, chordThird, chordFifth, chordThird];
      const sixteenthIdx = stepInBar % (spb / 2);
      if (sixteenthIdx === 0 || sixteenthIdx === spb / 4) {
        const arpIdx = Math.floor(stepInBar / (spb / 4)) % arpNotes.length;
        out.push(tone(when, stepDur * 0.8, this.hz(arpNotes[arpIdx]! + 24), "triangle", 0.04, "arp"));
      }
    }

    return out;
  }
}

function tone(
  when: number,
  duration: number,
  freq: number,
  waveform: Waveform,
  gain: number,
  layer: string,
): ToneSpec {
  return { when, duration, freq, waveform, gain, layer };
}
