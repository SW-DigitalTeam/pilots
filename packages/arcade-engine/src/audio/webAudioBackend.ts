import type { AudioBackend, LoopSpec, ToneSpec, VoiceSpec } from "./backend.js";

/**
 * Web Audio implementation of the backend.
 *
 * Two buses share one clock: a music bus and a voice bus, both into the
 * destination. Ducking is a gain ramp on the music bus. An AnalyserNode on the
 * voice bus exposes the amplitude envelope so the React layer can drive three
 * mouth shapes cheaply — no viseme system. This file is the only place raw
 * Web Audio lives; the scheduler and engine never touch it directly.
 */
export class WebAudioBackend implements AudioBackend {
  readonly musicBus: GainNode;
  readonly voiceBus: GainNode;
  readonly voiceAnalyser: AnalyserNode;
  private noiseBuffer: AudioBuffer | null = null;
  private loopSource: AudioBufferSourceNode | null = null;
  private readonly baseMusicGain = 0.9;

  constructor(readonly ctx: AudioContext) {
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.baseMusicGain;
    this.musicBus.connect(ctx.destination);

    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1;
    this.voiceAnalyser = ctx.createAnalyser();
    this.voiceAnalyser.fftSize = 256;
    this.voiceBus.connect(this.voiceAnalyser);
    this.voiceBus.connect(ctx.destination);
  }

  get currentTime(): number {
    return this.ctx.currentTime;
  }

  /** Unlock on the first user gesture; show nothing until running. */
  async unlock(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  scheduleTone(spec: ToneSpec): void {
    const { ctx } = this;
    const gain = ctx.createGain();
    gain.connect(this.musicBus);
    // Short attack/release envelope so nothing clicks on/off.
    const a = 0.005;
    const r = Math.min(0.05, spec.duration * 0.5);
    gain.gain.setValueAtTime(0, spec.when);
    gain.gain.linearRampToValueAtTime(spec.gain, spec.when + a);
    gain.gain.setValueAtTime(spec.gain, spec.when + spec.duration - r);
    gain.gain.linearRampToValueAtTime(0, spec.when + spec.duration);

    if (spec.waveform === "noise") {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoise();
      const filter = ctx.createBiquadFilter();
      // Snare-ish layers (lower freq) get a bandpass "thwack"; bright hats get
      // a highpass "tss".
      if (spec.freq < 5000) {
        filter.type = "bandpass";
        filter.frequency.value = spec.freq;
        filter.Q.value = 1.2;
      } else {
        filter.type = "highpass";
        filter.frequency.value = spec.freq;
      }
      src.connect(filter).connect(gain);
      src.start(spec.when);
      src.stop(spec.when + spec.duration);
    } else {
      const osc = ctx.createOscillator();
      osc.type = spec.waveform;
      osc.frequency.value = spec.freq;
      osc.connect(gain);
      osc.start(spec.when);
      osc.stop(spec.when + spec.duration);
    }
  }

  scheduleVoice(spec: VoiceSpec): void {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = spec.buffer ?? synthesizePlaceholder(ctx, spec.durationSeconds);
    src.connect(this.voiceBus);
    src.start(spec.when);
  }

  playLoop(spec: LoopSpec): void {
    const { ctx } = this;
    this.stopLoop();
    const src = ctx.createBufferSource();
    src.buffer = spec.buffer;
    src.loop = true;
    src.playbackRate.value = spec.playbackRate;
    const gain = ctx.createGain();
    gain.gain.value = spec.gain;
    src.connect(gain).connect(this.musicBus);
    src.start(spec.when);
    this.loopSource = src;
  }

  stopLoop(): void {
    if (this.loopSource) {
      try {
        this.loopSource.stop();
      } catch {
        /* already stopped */
      }
      this.loopSource = null;
    }
  }

  duck(when: number, db: number, rampMs: number): void {
    const target = this.baseMusicGain * Math.pow(10, db / 20);
    this.musicBus.gain.setTargetAtTime(target, when, rampMs / 1000 / 3);
  }

  unduck(when: number, rampMs: number): void {
    this.musicBus.gain.setTargetAtTime(this.baseMusicGain, when, rampMs / 1000 / 3);
  }

  /** 0..1 amplitude for the current voice — feed the mouth shapes. */
  voiceAmplitude(): number {
    const bins = new Uint8Array(this.voiceAnalyser.frequencyBinCount);
    this.voiceAnalyser.getByteTimeDomainData(bins);
    let peak = 0;
    for (const b of bins) peak = Math.max(peak, Math.abs(b - 128));
    return peak / 128;
  }

  private getNoise(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = Math.floor(this.ctx.sampleRate * 0.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }
}

/**
 * A synthetic stand-in "voice" — two detuned formant-ish tones under a syllable
 * envelope. Prototype the cue timing and script with this, then drop in real
 * recordings with the same ids and durations. It is never a substitute for a
 * real person before a school sees it.
 */
export function synthesizePlaceholder(ctx: BaseAudioContext, durationSeconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * durationSeconds));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const f0 = 180;
  const syllables = Math.max(1, Math.round(durationSeconds / 0.28));
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const syllablePhase = (t / durationSeconds) * syllables;
    const env = Math.sin(Math.PI * (syllablePhase % 1)) ** 2;
    const master = Math.min(1, t / 0.02) * Math.min(1, (durationSeconds - t) / 0.05);
    const s =
      Math.sin(2 * Math.PI * f0 * t) * 0.5 +
      Math.sin(2 * Math.PI * f0 * 2.4 * t) * 0.3 +
      Math.sin(2 * Math.PI * f0 * 3.1 * t) * 0.2;
    data[i] = s * env * master * 0.5;
  }
  return buf;
}
