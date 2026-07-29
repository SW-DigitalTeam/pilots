import type { Language } from "../show.js";
import type { AudioBackend } from "./backend.js";
import { Transport } from "./clock.js";
import { MusicBed } from "./musicBed.js";

export interface SchedulerOptions {
  /** How far ahead to schedule, seconds. */
  lookahead: number;
  /** Timer period, seconds. */
  interval: number;
  /** How much to duck music under voice, dB (negative). */
  duckDb: number;
  duckRampMs: number;
}

export const DEFAULT_SCHEDULER: SchedulerOptions = {
  lookahead: 0.1,
  interval: 0.025,
  duckDb: -6,
  duckRampMs: 50,
};

interface PendingVoice {
  onset: number;
  cueId: string;
  language: Language;
  durationSeconds: number;
  buffer?: AudioBuffer;
  scheduled: boolean;
}

/**
 * The lookahead scheduler. A 25ms timer queues any event whose grid time falls
 * inside the next 100ms, calling sample-accurate `start(when)` on the backend.
 * Nothing is ever fired by setTimeout/rAF directly, so audio stays locked to
 * the clock regardless of timer jitter. Every scheduled onset is computed from
 * a step/bar index via the Transport, so drift cannot accumulate.
 */
export class AudioScheduler {
  private nextStep = 0;
  private intensity = 1;
  private readonly voices: PendingVoice[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly opts: SchedulerOptions;

  constructor(
    private readonly backend: AudioBackend,
    readonly transport: Transport,
    private readonly bed: MusicBed,
    opts: Partial<SchedulerOptions> = {},
  ) {
    this.opts = { ...DEFAULT_SCHEDULER, ...opts };
  }

  setIntensity(tier: number): void {
    this.intensity = Math.max(1, Math.floor(tier));
  }

  /** Queue a voice cue to begin at an absolute clock time. */
  enqueueVoice(onset: number, cueId: string, language: Language, durationSeconds: number, buffer?: AudioBuffer): void {
    this.voices.push({ onset, cueId, language, durationSeconds, buffer, scheduled: false });
  }

  /** Schedule everything due within the lookahead window. Idempotent-safe. */
  tick(): void {
    const horizon = this.backend.currentTime + this.opts.lookahead;

    // Music: advance the step pointer, scheduling each step exactly once.
    while (this.transport.timeAtStep(this.nextStep) < horizon) {
      const when = this.transport.timeAtStep(this.nextStep);
      for (const spec of this.bed.tonesForStep(this.nextStep, when, this.intensity)) {
        this.backend.scheduleTone(spec);
      }
      this.nextStep++;
    }

    // Voice: schedule due cues once, ducking the bed under each.
    for (const v of this.voices) {
      if (v.scheduled || v.onset >= horizon) continue;
      this.backend.scheduleVoice({
        when: v.onset,
        cueId: v.cueId,
        language: v.language,
        durationSeconds: v.durationSeconds,
        buffer: v.buffer,
      });
      this.backend.duck(v.onset, this.opts.duckDb, this.opts.duckRampMs);
      this.backend.unduck(v.onset + v.durationSeconds, this.opts.duckRampMs);
      v.scheduled = true;
    }
  }

  start(): void {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.opts.interval * 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
