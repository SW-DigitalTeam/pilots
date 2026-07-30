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
} from "@sw/arcade-engine";
import type { CameraPoseClaim, ConsentGate } from "@sw/shell";
import { MediaPipeCapture } from "./capture/mediapipeCapture.js";
import type { CaptureOptions, PoseCapture } from "./capture/types.js";
import type { BrowserBackend } from "./backend.js";
import { drawFrame } from "./render/renderer.js";
import { mouthShapeForAmplitude } from "./render/mouth.js";

export interface ArcadeArenaProps {
  show: ShowConfig;
  mode: Mode;
  team: Team;
  consent: ConsentGate;
  onEvidence: (claim: CameraPoseClaim) => void;
  onSessionEnd?: (summary: SessionSummary) => void;
  profile?: InputProfile;
  language?: Language;
  calibrationSeconds?: number;
  createBackend?: () => BrowserBackend;
  createCapture?: (opts: CaptureOptions) => PoseCapture;
  cameraFacingMode?: "user" | "environment";
}

type Phase = "idle" | "instructions" | "need-camera" | "calibrating" | "running" | "ended" | "error";

const GESTURE_INFO: Record<string, { name: string; icon: string; desc: string }> = {
  jump: { name: "Jump", icon: "⬆", desc: "Jump up or raise your hands high" },
  duck: { name: "Duck", icon: "⬇", desc: "Crouch down or squat low" },
  sidestep: { name: "Step", icon: "↔", desc: "Step sideways left or right" },
  reach: { name: "Reach", icon: "✋", desc: "Reach up with both arms" },
};

export function ArcadeArena(props: ArcadeArenaProps): React.JSX.Element {
  const { show, mode, team, consent } = props;
  const profile: InputProfile = props.profile ?? "standing";
  const calibrationSeconds = props.calibrationSeconds ?? 5;

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [calFrames, setCalFrames] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [scoreBurst, setScoreBurst] = useState(0);

  const engineRef = useRef<ArcadeEngine | null>(null);
  const backendRef = useRef<BrowserBackend | null>(null);
  const captureRef = useRef<PoseCapture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const calStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  phaseRef.current = phase;

  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    captureRef.current?.stop();
    if (previewRef.current) previewRef.current.innerHTML = "";
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  const handleFrame = useCallback(
    (frame: PoseFrame) => {
      const engine = engineRef.current;
      const backend = backendRef.current;
      if (!engine || !backend) return;
      if (phaseRef.current === "calibrating") {
        engine.addCalibrationFrame(frame);
        setCalFrames(engine.calibrationFrameCount);
        if (backend.currentTime - calStartRef.current >= calibrationSeconds) {
          const players = engine.finishCalibration();
          if (players > 0) {
            setPhase("running");
            captureRef.current?.applyQuality(engine.degradationAction);
          } else {
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
      try { ctx = canvas.getContext("2d"); } catch { ctx = null; }
      if (ctx) {
        const state = engine.getRenderState(backend.currentTime);
        const amp = backend.voiceAmplitude();
        drawFrame(ctx, { width: canvas.width, height: canvas.height }, state, show, {
          mouth: mouthShapeForAmplitude(amp), voiceAmp: amp,
        });
      }
    }
    rafRef.current = requestAnimationFrame(renderLoop);
  }, [show]);

  const beginCalibration = useCallback(async () => {
    const backend = props.createBackend ? props.createBackend() : new WebAudioBackend(new AudioContext());
    await backend.unlock();
    backendRef.current = backend;

    const engine = new ArcadeEngine({
      show, mode, team, profile, consent, backend,
      language: props.language,
      onEvidence: (claim) => props.onEvidence(claim as CameraPoseClaim),
      onSessionEnd: (s) => props.onSessionEnd?.(s),
    });
    engineRef.current = engine;

    const startResult = engine.requestStart();
    if (!startResult.ok) { setPhase("need-camera"); return; }

    const opts: CaptureOptions = {
      onFrame: handleFrame, numPoses: 4,
      facingMode: props.cameraFacingMode ?? "environment",
    };
    const capture = props.createCapture ? props.createCapture(opts) : new MediaPipeCapture(opts);
    captureRef.current = capture;
    calStartRef.current = backend.currentTime;
    setPhase("calibrating");
    try {
      await capture.start();
      if (capture.video && previewRef.current) {
        capture.video.style.width = "100%";
        capture.video.style.height = "100%";
        capture.video.style.objectFit = "cover";
        capture.video.style.borderRadius = "12px";
        previewRef.current.innerHTML = "";
        previewRef.current.appendChild(capture.video);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setPhase("error");
      backendRef.current = null;
      engineRef.current = null;
      captureRef.current = null;
      return;
    }
    renderLoop();
  }, [show, mode, team, profile, consent, handleFrame, renderLoop, props]);

  const finish = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const s = engine.end();
    setSummary(s);
    setPhase("ended");
    setScoreBurst(s.teamScore);
    stopAll();
    setTimeout(() => setShowScore(true), 100);
  }, [stopAll]);

  const live = phase === "calibrating" || phase === "running";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: show.palette.background, overflow: "hidden" }}>
      <ArenaStyles />

      {live && (
        <div ref={previewRef} style={{
          position: "absolute", bottom: 24, left: 24,
          width: "min(220px, 28vw)", height: "min(160px, 20vw)",
          borderRadius: 12, border: "2px solid rgba(255,255,255,0.25)",
          boxShadow: "0 0 20px rgba(0,0,0,0.4)",
          background: "#000", overflow: "hidden", zIndex: 10,
        }}>
          <div style={{ position: "absolute", inset: 0, border: "3px dashed rgba(0,255,163,0.4)", borderRadius: 12, pointerEvents: "none", zIndex: 1 }} />
          {profile === "standing" && (
            <div style={{ position: "absolute", top: "20%", left: "25%", right: "25%", bottom: "10%", border: "2px dashed rgba(0,255,163,0.25)", borderRadius: 8, pointerEvents: "none", zIndex: 1 }} />
          )}
          {profile === "seated" && (
            <div style={{ position: "absolute", top: "10%", left: "20%", right: "20%", bottom: "50%", border: "2px dashed rgba(0,255,163,0.25)", borderRadius: 8, pointerEvents: "none", zIndex: 1 }} />
          )}
          <div style={{ position: "absolute", top: 6, left: 8, font: "600 10px system-ui", color: "rgba(255,255,255,0.5)", pointerEvents: "none", zIndex: 2 }}>
            {profile === "seated" ? "Show shoulders" : "Show full body"}
          </div>
        </div>
      )}

      {phase === "idle" && (
        <Center>
          <button className="btn-start" onClick={() => { setPhase("instructions"); }} aria-label="Start">
            START
          </button>
        </Center>
      )}

      {phase === "instructions" && (
        <Center scroll>
          <div className="instructions-panel" style={{ color: show.palette.ink, textAlign: "center", maxWidth: 640, width: "100%", padding: 16, animation: "fadeIn 0.3s ease" }}>
            <div className="instr-title" style={{ font: "bold clamp(30px, 7vw, 48px) system-ui", marginBottom: 4 }}>{show.title}</div>
            <div style={{ font: "600 clamp(14px, 3vw, 18px) system-ui", opacity: 0.5, marginBottom: 20 }}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)} mode · {profile === "seated" ? "Seated" : "Standing"}
            </div>

            <div style={{ font: "600 clamp(18px, 4vw, 22px) system-ui", marginBottom: 14 }}>How to play</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
              {show.vocabulary.map((g: string) => {
                const info = GESTURE_INFO[g];
                if (!info) return null;
                return (
                  <div key={g} style={{
                    background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 10px",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <div style={{ fontSize: "clamp(26px, 6vw, 36px)" }}>{info.icon}</div>
                    <div style={{ font: "bold clamp(16px, 3.5vw, 20px) system-ui", marginTop: 4 }}>{info.name}</div>
                    <div style={{ font: "600 clamp(11px, 2.5vw, 13px) system-ui", opacity: 0.5, marginTop: 2 }}>{info.desc}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ font: "600 clamp(13px, 3vw, 16px) system-ui", opacity: 0.6, marginBottom: 20 }}>
              A shape will appear with a cue. Do the move when the shape lights up. Stay active to earn points!
            </div>

            <button className="btn-start" onClick={() => void beginCalibration()} aria-label="Ready">
              Ready
            </button>
          </div>
        </Center>
      )}

      {phase === "need-camera" && (
        <Center>
          <div style={{ color: show.palette.ink, font: "bold 40px system-ui", textAlign: "center", animation: "fadeIn 0.3s ease" }}>
            Camera needed
          </div>
        </Center>
      )}

      {phase === "error" && (
        <Center>
          <div style={{ color: show.palette.ink, font: "bold 28px system-ui", textAlign: "center", maxWidth: 600, animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>Something went wrong</div>
            <div style={{ opacity: 0.7, fontSize: 20, wordBreak: "break-word", marginBottom: 24 }}>{errorMessage}</div>
            <button className="btn-start" onClick={() => { setPhase("idle"); setErrorMessage(""); stopAll(); }}>Try again</button>
          </div>
        </Center>
      )}

      {phase === "calibrating" && (
        <Center>
          <div style={{ color: show.palette.ink, textAlign: "center", animation: "fadeIn 0.3s ease", padding: 16 }}>
            <div style={{ font: "bold clamp(40px, 11vw, 72px) system-ui", textShadow: calFrames > 5 ? "0 0 30px rgba(124,58,237,0.4)" : "none", transition: "text-shadow 0.5s ease" }}>
              {profile === "seated" ? "Sit still" : "Stand still"}
            </div>
            <div style={{ font: "600 clamp(16px, 4vw, 22px) system-ui", opacity: 0.6, marginTop: 14 }}>
              {calFrames > 0
                ? `Detected ${calFrames} frames — hold steady`
                : profile === "seated"
                  ? "Position your shoulders in the green frame guide"
                  : "Position your full body in the green frame guide"}
            </div>
            {calFrames > 0 && (
              <div style={{ marginTop: 16, display: "flex", gap: 6, justifyContent: "center" }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: i < Math.min(5, Math.ceil(calFrames / 6)) ? "#00ffa3" : "rgba(255,255,255,0.15)",
                    boxShadow: i < Math.min(5, Math.ceil(calFrames / 6)) ? "0 0 10px rgba(0,255,163,0.6)" : "none",
                    transition: "all 0.3s ease",
                  }} />
                ))}
              </div>
            )}
          </div>
        </Center>
      )}

      <canvas ref={canvasRef} width={1280} height={720} style={{ width: "100%", height: "100%", display: phase === "running" ? "block" : "none" }} />

      {phase === "running" && (
        <button onClick={finish} aria-label="Finish" className="btn-finish">
          Finish
        </button>
      )}

      {phase === "ended" && summary && (
        <Center scroll>
          <div style={{ color: show.palette.ink, textAlign: "center", padding: 16, animation: showScore ? "scorePop 0.6s cubic-bezier(0.34,1.56,0.64,1)" : "none" }}>
            <div style={{
              font: "bold clamp(72px, 20vw, 120px) system-ui", letterSpacing: "-3px", lineHeight: 1,
              background: "linear-gradient(135deg, #fff 20%, #a78bfa 50%, #00ffa3 80%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(124,58,237,0.5))",
            }}>
              {summary.teamScore}
            </div>
            <div style={{ font: "bold clamp(24px, 6vw, 36px) system-ui", opacity: 0.7, marginTop: 8 }}>Movement Points</div>
            <div style={{ font: "600 clamp(17px, 4vw, 24px) system-ui", opacity: 0.5, marginTop: 4 }}>{team.label}</div>
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, maxWidth: 640 }}>
              {[
                { label: "Active", value: `${Math.round(summary.activeSeconds)}s` },
                { label: "Magnitude", value: summary.movementMagnitude.toFixed(2) },
                { label: "Players", value: String(summary.playersTracked) },
                { label: "Jumps", value: String(summary.gestureCounts.jump) },
                { label: "Ducks", value: String(summary.gestureCounts.duck) },
                { label: "Reaches", value: String(summary.gestureCounts.reach) },
              ].map((stat) => (
                <div key={stat.label} style={{
                  background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 16px",
                  backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ font: "600 clamp(11px, 2.5vw, 14px) system-ui", opacity: 0.5, textTransform: "uppercase", letterSpacing: "1px" }}>{stat.label}</div>
                  <div style={{ font: "bold clamp(22px, 5vw, 28px) system-ui", marginTop: 2 }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </Center>
      )}
    </div>
  );
}

function ArenaStyles(): React.JSX.Element {
  return (
    <style>{`
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scorePop {
        0% { transform: scale(0.3); opacity: 0; }
        60% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes glowPulse {
        0%,100% { box-shadow: 0 0 15px rgba(124,58,237,0.4), 0 0 30px rgba(124,58,237,0.2); }
        50% { box-shadow: 0 0 25px rgba(124,58,237,0.6), 0 0 50px rgba(124,58,237,0.3); }
      }
      .btn-start {
        font: bold clamp(38px, 9vw, 64px) system-ui, sans-serif;
        padding: clamp(16px, 4vw, 28px) clamp(40px, 9vw, 72px);
        border: none;
        background: linear-gradient(135deg, #7c3aed, #a78bfa);
        color: #fff;
        border-radius: 20px;
        cursor: pointer;
        letter-spacing: 2px;
        transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
        animation: glowPulse 2s ease-in-out infinite;
      }
      .btn-start:hover { transform: scale(1.06); }
      .btn-start:active { transform: scale(0.95); transition: all 0.1s ease; }
      .btn-finish {
        position: absolute;
        bottom: 20px; right: 20px;
        font: bold clamp(18px, 4vw, 28px) system-ui;
        padding: 10px 26px;
        border: 2px solid rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.08);
        color: #fff;
        border-radius: 14px;
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: all 0.25s ease;
        z-index: 11;
      }
      .btn-finish:hover { background: rgba(239,68,68,0.3); border-color: rgba(239,68,68,0.6); box-shadow: 0 0 20px rgba(239,68,68,0.3); }
      .btn-finish:active { transform: scale(0.93); transition: all 0.1s ease; }
    `}</style>
  );
}

function Center({ children, scroll }: { children: React.ReactNode; scroll?: boolean }): React.JSX.Element {
  if (scroll) {
    return (
      <div style={{ position: "absolute", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", zIndex: 2 }}>
        <div style={{ margin: "auto", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "16px 0" }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, overflow: "hidden" }}>
      {children}
    </div>
  );
}

export { summaryToClaim };
