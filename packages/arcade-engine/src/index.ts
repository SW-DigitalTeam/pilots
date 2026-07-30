// Public surface of the framework-agnostic engine. Zero React.
export { ArcadeEngine } from "./engine.js";
export type {
  EngineOptions,
  EnginePhase,
  RenderState,
  ScheduledCall,
  StartResult,
} from "./engine.js";

export { PoseInterpreter } from "./interpreter.js";
export type { InterpretResult } from "./interpreter.js";

export { Calibrator, scaleDrifted, shoulderWidth, profileScale } from "./calibration.js";
export type { Calibration } from "./calibration.js";
export { PlayerTracker } from "./tracker.js";

export { Scorer, DEFAULT_SCORE } from "./scoring.js";
export type { ScoreConfig } from "./scoring.js";
export { DegradationController } from "./degradation.js";
export type { DegradationLevel, DegradationAction } from "./degradation.js";

export { Transport } from "./audio/clock.js";
export { AudioScheduler, DEFAULT_SCHEDULER } from "./audio/scheduler.js";
export type { SchedulerOptions } from "./audio/scheduler.js";
export { MusicBed } from "./audio/musicBed.js";
export { CueBank } from "./audio/cueBank.js";
export { WebAudioBackend, synthesizePlaceholder } from "./audio/webAudioBackend.js";
export { FakeAudioBackend } from "./audio/backend.js";
export type { AudioBackend, ToneSpec, VoiceSpec, Waveform } from "./audio/backend.js";

export { summaryToClaim } from "./evidence.js";

export { LM, REQUIRED_LANDMARKS } from "./landmarks.js";
export { DEFAULT_THRESHOLDS } from "./gestures/config.js";
export type { GestureThresholds } from "./gestures/config.js";

export type {
  Cue,
  CueCategory,
  Language,
  Palette,
  ColorShape,
  MusicConfig,
  ModeConfig,
  CharacterConfig,
  ShowConfig,
} from "./show.js";

export type {
  GestureEvent,
  GestureId,
  InputProfile,
  Landmark,
  Mode,
  Pose,
  PoseFrame,
  SessionSummary,
  Team,
} from "./types.js";
