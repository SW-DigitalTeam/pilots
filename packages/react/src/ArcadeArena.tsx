import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArcadeEngine,
  WebAudioBackend,
  type InputProfile,
  type Language,
  type Mode,
  type PoseFrame,
  type SessionSummary,
  type ShowConfig,
  type Team,
  summaryToClaim,
} from "@pwa/arcade-engine";
import type { CameraPoseClaim, ConsentGate } from "@pwa/shell";
import { CameraIndicator } from "./CameraIndicator.js";
import { MediaPipeCapture } from "./capture/mediapipeCapture.js";
import type { CaptureOptions, PoseCapture } from "./capture/types.js";
import type { BrowserBackend } from "./backend.js";
import { drawFrame } from "./render/renderer.js";
import { mouthShapeForAmplitude } from "./render/mouth.js";

export interface ArcadeArenaProps {
  show: ShowConfig;
  mode: Mode;
  /** Class-level identity only — never a student. */
  team: Team;
  /** The shell's consent gate. ArcadeArena refuses to start without camera. */
  consent: ConsentGate;
  onEvidence: (claim: CameraPoseClaim) => void;
  onSessionEnd?: (summary: SessionSummary) => void;
  profile?: InputProfile;
  language?: Language;
  /** ~seconds of still-stand calibration. */
  calibrationSeconds?: number;
  /** Test seams — real defaults are Web Audio + MediaPipe. */
  createBackend?: () => BrowserBackend;
  createCapture?: (opts: CaptureOptions) => PoseCapture;
}

type Phase = "idle" | "need-camera" | "calibrating" | "running" | "ended";

const BIG_BUTTON: React.CSSProperties = {
  font: "bold 64px system-ui, sans-serif",
  padding: "32px 64px",
  border: "8px solid #fff",
  background: "#111",
  color: "#fff",
  borderRadius: 24,
  cursor: "pointer",
};

/**
 * The React binding. It mounts the engine, owns the calibration→gameplay
 * lifecycle, drives the canvas renderer at 60fps off the shared audio clock,
 * and emits evidence claims through the caller's onEvidence (which is expected
 * to be the shell's cameraPose provider). It never persists or transmits
 * anything itself.
 */
export function ArcadeArena(props: ArcadeArenaProps): React.JSX.Element {
  const { show, mode, team, consent } = props;
  const profile: InputProfile = props.profile ?? "standing";
  const calibrationSeconds = props.calibrationSeconds ?? 5;

  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const engineRef = useRef<ArcadeEngine | null>(null);
  const backendRef = useRef<BrowserBackend | null>(null);
  const captureRef = useRef<PoseCapture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const calStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  phaseRef.current = phase;

  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    captureRef.current?.stop();
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  const handleFrame = useCallback(
    (frame: PoseFrame) => {
      const engine = engineRef.current;
      const backend = backendRef.current;
      if (!engine || !backend) return;
      if (phaseRef.current === "calibrating") {
        engine.addCalibrationFrame(frame);
        if (backend.currentTime - calStartRef.current >= calibrationSeconds) {
          const players = engine.finishCalibration();
          if (players > 0) {
            setPhase("running");
            captureRef.current?.applyQuality(engine.degradationAction);
          } else {
            // Not enough of anyone seen; keep calibrating a little longer.
            calStartRef.current = backend.currentTime;
          }
        }
      } else if (phaseRef.current === "running") {
        engine.ingestPose(frame);
        captureRef.current?.applyQuality(engine.degradationAction);
      }
    },
    [calibrationSeconds],
  );

  const renderLoop = useCallback(() => {
    const engine = engineRef.current;
    const backend = backendRef.current;
    const canvas = canvasRef.current;
    if (engine && backend && canvas) {
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = canvas.getContext("2d");
      } catch {
        ctx = null; // headless/jsdom has no 2D context; skip drawing.
      }
      if (ctx) {
        const state = engine.getRenderState(backend.currentTime);
        const amp = backend.voiceAmplitude();
        drawFrame(
          ctx,
          { width: canvas.width, height: canvas.height },
          state,
          show,
          { mouth: mouthShapeForAmplitude(amp), voiceAmp: amp },
        );
      }
    }
    rafRef.current = requestAnimationFrame(renderLoop);
  }, [show]);

  const start = useCallback(async () => {
    const backend = props.createBackend ? props.createBackend() : new WebAudioBackend(new AudioContext());
    await backend.unlock();
    backendRef.current = backend;

    const engine = new ArcadeEngine({
      show,
      mode,
      team,
      profile,
      consent,
      backend,
      language: props.language,
      onEvidence: (claim) => props.onEvidence(claim as CameraPoseClaim),
      onSessionEnd: (s) => props.onSessionEnd?.(s),
    });
    engineRef.current = engine;

    const startResult = engine.requestStart();
    if (!startResult.ok) {
      setPhase("need-camera");
      return;
    }

    const opts: CaptureOptions = { onFrame: handleFrame, numPoses: 4 };
    const capture = props.createCapture ? props.createCapture(opts) : new MediaPipeCapture(opts);
    captureRef.current = capture;
    calStartRef.current = backend.currentTime;
    setPhase("calibrating");
    await capture.start();
    renderLoop();
  }, [show, mode, team, profile, consent, handleFrame, renderLoop, props]);

  const finish = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const s = engine.end();
    setSummary(s);
    setPhase("ended");
    stopAll();
  }, [stopAll]);

  const live = phase === "calibrating" || phase === "running";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: show.palette.background }}>
      <CameraIndicator live={live} />

      {phase === "idle" && (
        <Center>
          <button style={BIG_BUTTON} onClick={() => void start()} aria-label="Start">
            ▶ START
          </button>
        </Center>
      )}

      {phase === "need-camera" && (
        <Center>
          <div style={{ color: show.palette.ink, font: "bold 40px system-ui", textAlign: "center" }}>
            Camera needed
          </div>
        </Center>
      )}

      {phase === "calibrating" && (
        <Center>
          <div style={{ color: show.palette.ink, font: "bold 72px system-ui", textAlign: "center" }}>
            Stand still
          </div>
        </Center>
      )}

      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{ width: "100%", height: "100%", display: phase === "running" ? "block" : "none" }}
      />

      {phase === "running" && (
        <button
          onClick={finish}
          aria-label="Finish"
          style={{ position: "absolute", bottom: 16, right: 16, ...smallButton }}
        >
          ■
        </button>
      )}

      {phase === "ended" && summary && (
        <Center>
          <div style={{ color: show.palette.ink, textAlign: "center", font: "bold 96px system-ui" }}>
            {summary.teamScore}
            <div style={{ font: "bold 32px system-ui" }}>{team.label}</div>
          </div>
        </Center>
      )}
    </div>
  );
}

const smallButton: React.CSSProperties = {
  font: "bold 32px system-ui",
  width: 72,
  height: 72,
  border: "4px solid #fff",
  background: "#111",
  color: "#fff",
  borderRadius: 16,
  cursor: "pointer",
};

function Center({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

export { summaryToClaim };
