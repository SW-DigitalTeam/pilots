import type { ConsentGate } from "@sw/shell";
import { AudioScheduler, type SchedulerOptions } from "./audio/scheduler.js";
import type { AudioBackend } from "./audio/backend.js";
import { Transport } from "./audio/clock.js";
import { CueBank } from "./audio/cueBank.js";
import { MusicBed } from "./audio/musicBed.js";
import { DegradationController, type DegradationLevel } from "./degradation.js";
import { summaryToClaim } from "./evidence.js";
import { PoseInterpreter } from "./interpreter.js";
import { DEFAULT_SCORE, Scorer, type ScoreConfig } from "./scoring.js";
import type { Language, ShowConfig } from "./show.js";
import type {
  GestureEvent,
  GestureId,
  InputProfile,
  Mode,
  PoseFrame,
  SessionSummary,
  Team,
} from "./types.js";

export type EnginePhase = "idle" | "calibrating" | "running" | "ended";

export interface EngineOptions {
  show: ShowConfig;
  mode: Mode;
  team: Team;
  profile: InputProfile;
  consent: ConsentGate;
  backend: AudioBackend;
  language?: Language;
  score?: ScoreConfig;
  scheduler?: Partial<SchedulerOptions>;
  rng?: () => number;
  onEvidence?: (claim: ReturnType<typeof summaryToClaim>) => void;
  onSessionEnd?: (summary: SessionSummary) => void;
}

export interface StartResult {
  ok: boolean;
  reason?: "no-consent" | "unsupported-profile";
}

/** A move the character has called; drives the on-screen target and praise. */
export interface ScheduledCall {
  bar: number;
  gesture: GestureId;
  windowStartBeat: number;
  windowEndBeat: number;
  hit: boolean;
}

export interface RenderState {
  phase: EnginePhase;
  /** Audio-clock time in seconds (same basis as GestureEvent.atSeconds). */
  clockSeconds: number;
  /** Continuous beat position on the shared audio clock. */
  beat: number;
  bar: number;
  intensity: number;
  activeCall: ScheduledCall | null;
  /** Recent fires for pop animations (ring buffer, newest last). */
  recentFires: GestureEvent[];
  teamScore: number;
  activeSeconds: number;
  playersTracked: number;
  /** Always true while running — mirrors the persistent camera indicator. */
  cameraLive: boolean;
}

const WINDOW_BEATS = 2;
const PLAN_HORIZON_BARS = 4;
const RECENT_FIRE_CAP = 8;

/**
 * The session orchestrator. Refuses to start without camera consent, owns the
 * audio clock every subsystem shares, runs the cue director, and emits a
 * single derived-numbers evidence claim at the end. It holds no React.
 */
export class ArcadeEngine {
  private phase: EnginePhase = "idle";
  private transport: Transport | null = null;
  private scheduler: AudioScheduler | null = null;
  private readonly interpreter: PoseInterpreter;
  private readonly cues: CueBank;
  private readonly bed: MusicBed;
  private readonly scorer: Scorer;
  private readonly degradation = new DegradationController();
  private readonly language: Language;
  private readonly rng: () => number;
  private readonly modeConfig: { leadBars: number; callEveryBars: number };

  private startedAt = 0;
  private lastNow: number | null = null;
  private plannedThroughBar = -1;
  private nextGestureIndex = 0;
  private readonly calls: ScheduledCall[] = [];
  private readonly recentFires: GestureEvent[] = [];
  private consentUnsub: (() => void) | null = null;
  private finalSummary: SessionSummary | null = null;

  constructor(private readonly opts: EngineOptions) {
    this.language = opts.language ?? opts.show.defaultLanguage;
    this.rng = opts.rng ?? Math.random;
    this.interpreter = new PoseInterpreter(opts.profile, opts.show.thresholdOverrides);
    this.cues = new CueBank(opts.show.cues, this.rng);
    this.bed = new MusicBed(opts.show.music);
    this.scorer = new Scorer(opts.score ?? DEFAULT_SCORE);
    const mc = opts.show.modes[opts.mode];
    this.modeConfig = { leadBars: mc?.leadBars ?? 1, callEveryBars: mc?.callEveryBars ?? 2 };
  }

  get currentPhase(): EnginePhase {
    return this.phase;
  }

  get calibrationFrameCount(): number {
    return this.interpreter.calibrationFrameCount;
  }

  /**
   * Gate on consent. This is the hard refusal: no camera data class, no start.
   * The engine does not ask for consent itself — the shell owns that.
   */
  requestStart(): StartResult {
    if (!this.opts.consent.has("camera")) return { ok: false, reason: "no-consent" };
    if (!this.opts.show.supportedProfiles.includes(this.opts.profile)) {
      return { ok: false, reason: "unsupported-profile" };
    }
    this.phase = "calibrating";
    // Revoking consent mid-session must stop everything immediately.
    this.consentUnsub = this.opts.consent.subscribe((dc, granted) => {
      if (dc === "camera" && !granted && this.phase !== "ended") this.end();
    });
    return { ok: true };
  }

  addCalibrationFrame(frame: PoseFrame): void {
    if (this.phase !== "calibrating") return;
    this.interpreter.addCalibrationFrame(frame);
  }

  /** Complete calibration and start audio. Returns players registered. */
  finishCalibration(): number {
    if (this.phase !== "calibrating") return 0;
    const players = this.interpreter.finishCalibration();
    if (players === 0) return 0;

    const music = this.opts.show.music;
    // Start a hair in the future so the first events aren't already late.
    const t0 = this.opts.backend.currentTime + 0.12;
    this.transport = new Transport(music.bpm, music.beatsPerBar, music.stepsPerBeat, t0);
    this.scheduler = new AudioScheduler(this.opts.backend, this.transport, this.bed, this.opts.scheduler);
    this.scheduler.setIntensity(2);
    this.startedAt = Date.now();
    this.phase = "running";

    // Count-in on bar 0; calls begin on bar 1.
    const countIn = this.cues.pick("count-in");
    if (countIn) {
      this.scheduler.enqueueVoice(
        this.transport.timeAtBar(0),
        countIn.id,
        this.language,
        countIn.durationBeats * this.transport.secondsPerBeat,
        this.cues.buffer(countIn, this.language),
      );
    }
    this.plannedThroughBar = 0;
    this.scheduler.start();
    return players;
  }

  /** Feed one gameplay frame. Uses the audio clock as the master time. */
  ingestPose(frame: PoseFrame): void {
    if (this.phase !== "running" || !this.transport || !this.scheduler) return;
    const now = this.opts.backend.currentTime;
    const dt = this.lastNow === null ? 0 : Math.max(0, now - this.lastNow);
    this.lastNow = now;

    const result = this.interpreter.ingest(frame, now);
    this.scorer.update(dt, result.movementMagnitude, result.events);
    for (const e of result.events) this.registerFire(e, now);

    // FPS estimate from frame spacing drives graceful degradation.
    if (dt > 0) this.degradation.update(1 / dt, now);

    this.updateIntensity(now);
    this.planCalls(now);
    this.scheduler.tick();
  }

  /** Recommendation the capture layer should apply next frame. */
  get degradationLevel(): DegradationLevel {
    return this.degradation.currentLevel;
  }
  get degradationAction() {
    return this.degradation.action;
  }

  private registerFire(e: GestureEvent, now: number): void {
    this.recentFires.push(e);
    while (this.recentFires.length > RECENT_FIRE_CAP) this.recentFires.shift();
    if (!this.transport || !this.scheduler) return;

    // If it answers an open call, praise it; otherwise a light encourage.
    const call = this.activeCall(now);
    if (call && !call.hit && call.gesture === e.gesture) {
      call.hit = true;
      const praise = this.cues.pick("praise");
      if (praise) {
        this.scheduler.enqueueVoice(
          now + 0.03,
          praise.id,
          this.language,
          praise.durationBeats * this.transport.secondsPerBeat,
          this.cues.buffer(praise, this.language),
        );
      }
    }
  }

  private updateIntensity(now: number): void {
    if (!this.transport || !this.scheduler) return;
    const bar = Math.floor(this.transport.beatAtTime(now) / this.transport.beatsPerBar);
    // Start at tier 2 (kick+bass+hats on immediately), ramp one tier every 4
    // bars so the full arrangement lands inside the first ~12 bars of play.
    this.scheduler.setIntensity(Math.min(5, 2 + Math.floor(Math.max(0, bar) / 4)));
  }

  /** Plan and enqueue upcoming calls within the horizon. */
  private planCalls(now: number): void {
    if (!this.transport || !this.scheduler) return;
    const currentBar = Math.floor(this.transport.beatAtTime(now) / this.transport.beatsPerBar);
    const target = currentBar + PLAN_HORIZON_BARS;
    for (let bar = Math.max(this.plannedThroughBar + 1, 1); bar <= target; bar++) {
      if (bar % this.modeConfig.callEveryBars !== 0) continue;
      const gesture = this.nextGesture();
      const cue = this.cues.pickCall(gesture);
      const windowStartBeat = bar * this.transport.beatsPerBar;
      const call: ScheduledCall = {
        bar,
        gesture,
        windowStartBeat,
        windowEndBeat: windowStartBeat + WINDOW_BEATS,
        hit: false,
      };
      this.calls.push(call);
      if (cue) {
        // Anticipatory: the call is heard leadBars before the window opens.
        const onset = Math.max(now + 0.02, this.transport.timeAtBar(bar - this.modeConfig.leadBars));
        this.scheduler.enqueueVoice(
          onset,
          cue.id,
          this.language,
          cue.durationBeats * this.transport.secondsPerBeat,
          this.cues.buffer(cue, this.language),
        );
      }
      this.plannedThroughBar = bar;
    }
  }

  private nextGesture(): GestureId {
    const vocab = this.opts.show.vocabulary;
    const g = vocab[this.nextGestureIndex % vocab.length]!;
    // Rotate with a little variation so it isn't a rigid cycle.
    this.nextGestureIndex += 1 + Math.floor(this.rng() * vocab.length);
    return g;
  }

  private activeCall(now: number): ScheduledCall | null {
    if (!this.transport) return null;
    const beat = this.transport.beatAtTime(now);
    for (const c of this.calls) {
      if (beat >= c.windowStartBeat - 0.5 && beat <= c.windowEndBeat) return c;
    }
    return null;
  }

  /** Snapshot for rendering at 60fps; `now` is audio-clock seconds. */
  getRenderState(now: number): RenderState {
    const beat = this.transport ? this.transport.beatAtTime(now) : 0;
    const beatsPerBar = this.transport?.beatsPerBar ?? 4;
    return {
      phase: this.phase,
      clockSeconds: now,
      beat,
      bar: Math.floor(beat / beatsPerBar),
      intensity: this.transport ? Math.min(5, 1 + Math.floor(Math.max(0, beat / beatsPerBar) / 8)) : 1,
      activeCall: this.activeCall(now),
      recentFires: [...this.recentFires],
      teamScore: this.scorer.teamScore,
      activeSeconds: this.scorer.activeSecondsTotal,
      playersTracked: this.interpreter.playersTracked,
      cameraLive: this.phase === "running",
    };
  }

  /** End the session, emit evidence + summary. Idempotent. */
  end(): SessionSummary {
    // Truly idempotent: cache the summary so a second end() returns the same
    // object (endedAt included) and never re-emits evidence.
    if (this.finalSummary) return this.finalSummary;
    const summary = this.buildSummary();
    this.finalSummary = summary;
    this.phase = "ended";
    this.scheduler?.stop();
    this.consentUnsub?.();
    this.consentUnsub = null;
    if (this.opts.onEvidence) this.opts.onEvidence(summaryToClaim(summary));
    if (this.opts.onSessionEnd) this.opts.onSessionEnd(summary);
    return summary;
  }

  private buildSummary(): SessionSummary {
    return {
      team: this.opts.team,
      show: this.opts.show.id,
      mode: this.opts.mode,
      inputProfile: this.opts.profile,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      activeSeconds: this.scorer.activeSecondsTotal,
      movementMagnitude: this.scorer.meanMagnitude,
      teamScore: this.scorer.teamScore,
      gestureCounts: this.scorer.gestureCounts,
      playersTracked: this.interpreter.playersTracked,
    };
  }
}

export type { InputProfile, Mode, Team };
