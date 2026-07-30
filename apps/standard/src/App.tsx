import React, { useMemo, useRef, useState } from "react";
import { ConsentManager, CameraPoseProvider, type CameraPoseClaim } from "@sw/shell";
import { ArcadeArena } from "@sw/arcade-react";
import { ALL_SHOWS } from "@sw/arcade-shows";
import type { InputProfile, Mode, ShowConfig } from "@sw/arcade-engine";
import { supabase } from "./supabase";

export function App(): React.JSX.Element {
  const consent = useMemo(() => new ConsentManager(), []);
  const provider = useMemo(
    () =>
      new CameraPoseProvider((claim: CameraPoseClaim) => {
        submitted.current.push(claim);
        console.log("evidence submitted (derived numbers only):", claim);

        supabase
          .from("claims")
          .insert({
            provider: claim.provider,
            schema_version: claim.schemaVersion,
            team_id: claim.team.id,
            team_label: claim.team.label,
            show: claim.show,
            mode: claim.mode,
            input_profile: claim.inputProfile,
            started_at: claim.startedAt,
            ended_at: claim.endedAt,
            active_seconds: claim.activeSeconds,
            movement_magnitude: claim.movementMagnitude,
            team_score: claim.teamScore,
            gesture_counts: claim.gestureCounts,
            players_tracked: claim.playersTracked,
          })
          .then(({ error }) => {
            if (error) console.error("supabase insert failed:", error);
          });
      }),
    [],
  );
  const submitted = useRef<CameraPoseClaim[]>([]);

  const [show, setShow] = useState<ShowConfig>(ALL_SHOWS[0]!);
  const [profile, setProfile] = useState<InputProfile>("standing");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [team, setTeam] = useState({ id: "room-12", label: "Room 12" });
  const [ready, setReady] = useState(false);
  const [, force] = useState(0);

  const grantAndGo = () => {
    consent.grant("camera", "class movement game");
    setReady(true);
  };

  const mode: Mode = (Object.keys(show.modes)[0] as Mode) ?? "follow";

  if (ready) {
    return (
      <div style={{ position: "fixed", inset: 0, animation: "fadeIn 0.3s ease" }}>
        <ArcadeArena
          show={show}
          mode={mode}
          team={team}
          consent={consent}
          profile={profile}
          cameraFacingMode={facingMode}
          onEvidence={(claim) => {
            provider.submit(claim);
            force((n) => n + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="setup-outer">
      <StyleInjector />
      <div className="setup-bg" />
      <div className="setup-inner">
        <div className="setup-title">Arcade Arena</div>
        <div className="setup-subtitle">Pick a show, choose your setup, and move</div>

        <div className="setup-cards">
          {ALL_SHOWS.map((s) => (
            <button
              key={s.id}
              className="setup-card"
              onClick={() => setShow(s)}
              style={{
                outline: s.id === show.id ? "3px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.12)",
                background:
                  s.id === show.id
                    ? `linear-gradient(135deg, ${s.palette.background}, ${s.palette.ink}22)`
                    : "rgba(255,255,255,0.04)",
                color: s.palette.ink,
                transform: s.id === show.id ? "scale(1.02)" : "scale(1)",
              }}
            >
              <div className="setup-card-title">{s.title}</div>
              <div className="setup-card-subtitle">{s.targetYears}</div>
            </button>
          ))}
        </div>

        <div className="setup-controls">
          <div className="setup-toggles">
            <Toggle on={profile === "standing"} onClick={() => setProfile("standing")} label="Stand" />
            <Toggle on={profile === "seated"} onClick={() => setProfile("seated")} label="Sit" />
          </div>
          <div className="setup-toggles">
            <Toggle on={facingMode === "environment"} onClick={() => setFacingMode("environment")} label="Rear Cam" />
            <Toggle on={facingMode === "user"} onClick={() => setFacingMode("user")} label="Selfie Cam" />
          </div>
          <input
            value={team.label}
            onChange={(e) => setTeam({ id: e.target.value.toLowerCase().replace(/\s+/g, "-"), label: e.target.value })}
            aria-label="Class name"
            className="setup-input"
            placeholder="Class name"
          />
        </div>

        <button onClick={grantAndGo} className="setup-go" aria-label="Allow camera and start">
          Allow camera & Start
        </button>
        <div className="setup-note">Camera stays on this device. Nothing is recorded or sent.</div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }): React.JSX.Element {
  return (
    <button
      className="setup-toggle"
      onClick={onClick}
      style={{
        background: on ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
        borderColor: on ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
        color: on ? "#fff" : "rgba(255,255,255,0.5)",
        boxShadow: on ? "0 0 20px rgba(255,255,255,0.1)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function StyleInjector(): React.JSX.Element {
  return (
    <style>{`
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes glowPulse { 0%,100% { opacity:0.35; transform:translate(-50%,-50%) scale(1); } 50% { opacity:0.6; transform:translate(-50%,-50%) scale(1.25); } }
      @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }

      /* Scrollable container — the inner uses margin:auto so it centers when
         short and scrolls naturally when taller than the viewport. */
      .setup-outer {
        position: fixed;
        inset: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        display: flex;
        flex-direction: column;
      }
      .setup-bg {
        position: fixed;
        inset: 0;
        z-index: 0;
        background: radial-gradient(ellipse at 50% 25%, #1a1040 0%, #0a0a0f 70%);
        pointer-events: none;
      }
      .setup-bg::before, .setup-bg::after {
        content: "";
        position: absolute;
        border-radius: 50%;
        animation: glowPulse 7s ease-in-out infinite;
      }
      .setup-bg::before {
        top: 8%; left: 0%; width: 60vmax; height: 60vmax;
        background: radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%);
      }
      .setup-bg::after {
        bottom: -10%; right: -10%; width: 55vmax; height: 55vmax;
        background: radial-gradient(circle, rgba(0,255,163,0.15) 0%, transparent 70%);
        animation-delay: -3.5s;
      }
      .setup-inner {
        position: relative;
        z-index: 1;
        margin: auto;
        width: 100%;
        max-width: 720px;
        padding: 32px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }

      .setup-title {
        font: bold clamp(40px, 9vw, 72px) system-ui;
        letter-spacing: -1.5px;
        background: linear-gradient(135deg, #fff 0%, #a78bfa 40%, #00ffa3 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 0 20px rgba(124,58,237,0.5));
        animation: slideUp 0.5s ease;
        text-align: center;
      }
      .setup-subtitle {
        font: 600 clamp(14px, 3vw, 20px) system-ui;
        color: rgba(255,255,255,0.45);
        animation: slideUp 0.5s ease 0.08s both;
        text-align: center;
      }

      .setup-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        width: 100%;
        animation: slideUp 0.5s ease 0.14s both;
      }
      .setup-card {
        min-height: 108px;
        border-radius: 18px;
        border: none;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
        justify-content: center;
        padding: 14px 10px;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
      }
      .setup-card:active { transform: scale(0.97) !important; }
      .setup-card-title { font: bold clamp(18px, 3.5vw, 26px) system-ui; letter-spacing: -0.5px; text-align: center; }
      .setup-card-subtitle { opacity: 0.65; font: 600 clamp(12px, 2.5vw, 15px) system-ui; }

      .setup-controls {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        width: 100%;
        animation: slideUp 0.5s ease 0.2s both;
      }
      .setup-toggles { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
      .setup-toggle {
        font: bold clamp(17px, 3vw, 22px) system-ui;
        padding: 12px 26px;
        border: 2px solid;
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .setup-toggle:active { transform: scale(0.95); }
      .setup-input {
        font: bold clamp(17px, 3vw, 22px) system-ui;
        padding: 12px 18px;
        border-radius: 14px;
        border: 2px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.05);
        color: #fff;
        width: min(260px, 100%);
        outline: none;
        transition: border-color 0.2s ease;
        text-align: center;
      }
      .setup-input:focus { border-color: rgba(124,58,237,0.7); }

      .setup-go {
        font: bold clamp(26px, 5vw, 40px) system-ui;
        padding: clamp(16px, 3vw, 24px) clamp(36px, 8vw, 64px);
        border: none;
        background: linear-gradient(135deg, #7c3aed, #00ffa3);
        color: #fff;
        border-radius: 20px;
        cursor: pointer;
        box-shadow: 0 0 40px rgba(124,58,237,0.3), 0 4px 20px rgba(0,0,0,0.3);
        transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
        letter-spacing: -0.5px;
        animation: slideUp 0.5s ease 0.26s both;
      }
      .setup-go:hover { transform: scale(1.04); }
      .setup-go:active { transform: scale(0.96); }
      .setup-note {
        color: rgba(255,255,255,0.35);
        font: 600 clamp(13px, 2.5vw, 16px) system-ui;
        animation: slideUp 0.5s ease 0.32s both;
        text-align: center;
        padding-bottom: 12px;
      }
    `}</style>
  );
}
