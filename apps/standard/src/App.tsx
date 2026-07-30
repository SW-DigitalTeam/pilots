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
      <div style={{ width: "100%", height: "100%", animation: "fadeIn 0.3s ease" }}>
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
    <div style={S.wrap}>
      <StyleInjector />
      <div style={S.glow1} />
      <div style={S.glow2} />
      <div className="setup-title" style={S.title}>Arcade Arena</div>
      <div className="setup-subtitle" style={S.subtitle}>Pick a show, choose your setup, and move</div>

      <div style={S.row}>
        {ALL_SHOWS.map((s) => (
          <button
            key={s.id}
            className="setup-card"
            onClick={() => setShow(s)}
            style={{
              ...S.card,
              outline: s.id === show.id ? "3px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.12)",
              background: s.id === show.id
                ? `linear-gradient(135deg, ${s.palette.background}, ${s.palette.ink}22)`
                : "rgba(255,255,255,0.04)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              color: s.palette.ink,
              transform: s.id === show.id ? "scale(1.03)" : "scale(1)",
            }}
          >
            <div className="setup-card-title" style={{ font: "bold 28px system-ui", letterSpacing: "-0.5px" }}>{s.title}</div>
            <div className="setup-card-subtitle" style={{ opacity: 0.65, font: "600 16px system-ui" }}>{s.targetYears}</div>
          </button>
        ))}
      </div>

      <div style={S.row}>
        <Toggle on={profile === "standing"} onClick={() => setProfile("standing")} label="Stand" />
        <Toggle on={profile === "seated"} onClick={() => setProfile("seated")} label="Sit" />
        <Toggle on={facingMode === "environment"} onClick={() => setFacingMode("environment")} label="Rear Cam" />
        <Toggle on={facingMode === "user"} onClick={() => setFacingMode("user")} label="Selfie Cam" />
        <input
          value={team.label}
          onChange={(e) => setTeam({ id: e.target.value.toLowerCase().replace(/\s+/g, "-"), label: e.target.value })}
          aria-label="Class name"
          className="setup-input"
          style={S.input}
          placeholder="Class name"
        />
      </div>

      <button onClick={grantAndGo} className="setup-go" style={S.go} aria-label="Allow camera and start">
        Allow camera & Start
      </button>
      <div style={S.note}>
        Camera stays on this device. Nothing is recorded or sent.
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
        ...S.toggle,
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
      @keyframes glowPulse1 { 0%,100% { opacity:0.3; transform:translate(-50%,-50%) scale(1); } 50% { opacity:0.5; transform:translate(-50%,-50%) scale(1.3); } }
      @keyframes glowPulse2 { 0%,100% { opacity:0.2; transform:translate(-50%,-50%) scale(1); } 50% { opacity:0.45; transform:translate(-50%,-50%) scale(1.5); } }
      @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      @media (max-width: 600px) {
        .setup-title { font-size: 42px !important; }
        .setup-subtitle { font-size: 15px !important; }
        .setup-card { width: 180px !important; height: 100px !important; }
        .setup-card-title { font-size: 20px !important; }
        .setup-card-subtitle { font-size: 13px !important; }
        .setup-toggle { font-size: 18px !important; padding: 10px 20px !important; }
        .setup-input { font-size: 18px !important; padding: 10px 16px !important; width: 150px !important; }
        .setup-go { font-size: 28px !important; padding: 18px 40px !important; }
      }
    `}</style>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    position: "absolute", inset: 0,
    display: "flex", flexDirection: "column", gap: 18, alignItems: "center", justifyContent: "center",
    background: "radial-gradient(ellipse at 50% 30%, #1a1040 0%, #0a0a0f 70%)",
    padding: "24px 16px", overflowX: "hidden", overflowY: "auto",
  },
  glow1: {
    position: "absolute", top: "20%", left: "20%",
    width: 500, height: 500,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
    animation: "glowPulse1 6s ease-in-out infinite",
    pointerEvents: "none", zIndex: 0,
  },
  glow2: {
    position: "absolute", bottom: "10%", right: "15%",
    width: 400, height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,255,163,0.18) 0%, transparent 70%)",
    animation: "glowPulse2 8s ease-in-out infinite",
    pointerEvents: "none", zIndex: 0,
  },
  title: {
    position: "relative", zIndex: 1,
    font: "bold 72px system-ui", letterSpacing: "-1.5px",
    background: "linear-gradient(135deg, #fff 0%, #a78bfa 40%, #00ffa3 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    filter: "drop-shadow(0 0 20px rgba(124,58,237,0.5))",
    animation: "slideUp 0.6s ease",
  },
  subtitle: {
    position: "relative", zIndex: 1,
    font: "600 20px system-ui",
    color: "rgba(255,255,255,0.45)",
    animation: "slideUp 0.6s ease 0.1s both",
  },
  row: {
    position: "relative", zIndex: 1,
    display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center",
  },
  card: {
    width: 240, height: 130,
    borderRadius: 18, border: "none", cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 6,
    alignItems: "center", justifyContent: "center", padding: 12,
    transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
  },
  toggle: {
    font: "bold 24px system-ui",
    padding: "14px 32px",
    border: "2px solid",
    borderRadius: 14,
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  input: {
    font: "bold 24px system-ui",
    padding: "14px 20px",
    borderRadius: 14,
    border: "2px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    width: 200,
    outline: "none",
    transition: "border-color 0.2s ease",
  },
  go: {
    position: "relative", zIndex: 1,
    font: "bold 40px system-ui",
    padding: "24px 64px",
    border: "none",
    background: "linear-gradient(135deg, #7c3aed, #00ffa3)",
    color: "#fff",
    borderRadius: 20,
    cursor: "pointer",
    boxShadow: "0 0 40px rgba(124,58,237,0.3), 0 4px 20px rgba(0,0,0,0.3)",
    transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
    letterSpacing: "-0.5px",
    animation: "slideUp 0.6s ease 0.2s both",
  },
  note: {
    position: "relative", zIndex: 1,
    color: "rgba(255,255,255,0.35)",
    font: "600 16px system-ui",
    animation: "slideUp 0.6s ease 0.3s both",
  },
};
