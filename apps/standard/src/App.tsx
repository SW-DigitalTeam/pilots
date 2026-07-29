import React, { useMemo, useRef, useState } from "react";
import { ConsentManager, CameraPoseProvider, type CameraPoseClaim } from "@sw/shell";
import { ArcadeArena } from "@sw/arcade-react";
import { ALL_SHOWS } from "@sw/arcade-shows";
import type { InputProfile, Mode, ShowConfig } from "@sw/arcade-engine";

/**
 * The shell. It OWNS consent and the cameraPose provider; ArcadeArena consumes
 * them. This is the reference for how a pilot mounts the package: the shell
 * grants the `camera` data class on a single operator tap, wires the provider's
 * sink (where derived-only claims go), and hands both to ArcadeArena.
 */
export function App(): React.JSX.Element {
  const consent = useMemo(() => new ConsentManager(), []);
  const provider = useMemo(
    () =>
      new CameraPoseProvider((claim: CameraPoseClaim) => {
        // The sink is the ONLY egress. In a real pilot this POSTs the derived
        // numbers to the score service; here we record them locally.
        submitted.current.push(claim);
        // eslint-disable-next-line no-console
        console.log("evidence submitted (derived numbers only):", claim);
      }),
    [],
  );
  const submitted = useRef<CameraPoseClaim[]>([]);

  const [show, setShow] = useState<ShowConfig>(ALL_SHOWS[0]!);
  const [profile, setProfile] = useState<InputProfile>("standing");
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
      <div style={{ width: "100%", height: "100%" }}>
        <ArcadeArena
          show={show}
          mode={mode}
          team={team}
          consent={consent}
          profile={profile}
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
      <div style={S.row}>
        {ALL_SHOWS.map((s) => (
          <button
            key={s.id}
            onClick={() => setShow(s)}
            style={{ ...S.card, outline: s.id === show.id ? "8px solid #fff" : "none", background: s.palette.background, color: s.palette.ink }}
          >
            <div style={{ font: "bold 34px system-ui" }}>{s.title}</div>
            <div style={{ opacity: 0.8, font: "600 18px system-ui" }}>{s.targetYears}</div>
          </button>
        ))}
      </div>

      <div style={S.row}>
        <Toggle on={profile === "standing"} onClick={() => setProfile("standing")} label="Stand" />
        <Toggle on={profile === "seated"} onClick={() => setProfile("seated")} label="Sit" />
        <input
          value={team.label}
          onChange={(e) => setTeam({ id: e.target.value.toLowerCase().replace(/\s+/g, "-"), label: e.target.value })}
          aria-label="Class name"
          style={S.input}
        />
      </div>

      <button onClick={grantAndGo} style={S.go} aria-label="Allow camera and start">
        📷 Allow camera & Start
      </button>
      <div style={S.note}>Camera stays on this device. Nothing is recorded or sent.</div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{ ...S.toggle, background: on ? "#fff" : "#111", color: on ? "#111" : "#fff" }}
    >
      {label}
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 28, alignItems: "center", justifyContent: "center", background: "#0a0a0f", padding: 24 },
  row: { display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" },
  card: { width: 260, height: 150, borderRadius: 20, border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", padding: 12 },
  toggle: { font: "bold 28px system-ui", padding: "16px 40px", border: "4px solid #fff", borderRadius: 16, cursor: "pointer" },
  input: { font: "bold 28px system-ui", padding: "12px 20px", borderRadius: 16, border: "4px solid #fff", background: "#111", color: "#fff", width: 220 },
  go: { font: "bold 44px system-ui", padding: "28px 56px", border: "8px solid #fff", background: "#00ffa3", color: "#04231a", borderRadius: 24, cursor: "pointer" },
  note: { color: "#aaa", font: "600 18px system-ui" },
};
