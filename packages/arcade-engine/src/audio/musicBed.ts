import type { MusicConfig } from "../show.js";
import type { ToneSpec, Waveform } from "./backend.js";

/**
 * Procedural, bar-locked music. Built from oscillators and noise, never an
 * <audio> loop that could restart and click. Intensity raises the arrangement
 * by switching layers ON — it never changes tempo, so the beat grid the whole
 * game hangs off stays fixed for the entire session.
 *
 * The pad is scheduled to span a whole bar and the next bar's pad begins
 * exactly where the last ended, so there is never a gap or overlap at the loop
 * boundary — that contiguity is what the audio critic checks for clicks.
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

  /** Tones that begin exactly at `when`, the grid time of `absoluteStep`. */
  tonesForStep(absoluteStep: number, when: number, intensity: number): ToneSpec[] {
    const spb = this.cfg.stepsPerBeat;
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

    if (isBeat && this.layerOn("kick", intensity)) {
      out.push(tone(when, Math.min(0.14, beatDur * 0.9), this.hz(-24), "sine", 0.9, "kick"));
    }

    if (this.layerOn("bass", intensity) && stepInBar % (spb * 2) === 0) {
      // Root on beat 0, fifth on beat 2 -> a simple walking half-note bass.
      const degree = beatInBar === 0 ? 0 : 7;
      out.push(tone(when, beatDur * 2 * 0.95, this.hz(degree - 12), "sawtooth", 0.28, "bass"));
    }

    if (isOffEighth && this.layerOn("hats", intensity)) {
      out.push(tone(when, 0.035, 8000, "noise", 0.16, "hats"));
    }

    if (isBarStart && this.layerOn("pad", intensity)) {
      // One pad per bar, spanning the whole bar -> contiguous across bars.
      const third = scale[2 % scale.length] ?? 4;
      out.push(tone(when, barDur, this.hz(0), "triangle", 0.12, "pad"));
      out.push(tone(when, barDur, this.hz(third), "triangle", 0.1, "pad"));
    }

    if (this.layerOn("lead", intensity) && isBeat) {
      const note = scale[(beatInBar * 2) % scale.length] ?? 0;
      out.push(tone(when, beatDur * 0.5, this.hz(note + 12), "square", 0.09, "lead"));
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
