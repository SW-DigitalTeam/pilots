import { describe, expect, it } from "vitest";
import { ConsentManager, validateCameraPoseClaim } from "@pwa/shell";
import { ArcadeEngine } from "./engine.js";
import { FakeAudioBackend } from "./audio/backend.js";
import { buildPose } from "./replay/skeleton.js";
import type { Cue, ShowConfig } from "./show.js";
import type { PoseFrame } from "./types.js";

function cue(id: string, category: Cue["category"], gesture?: Cue["gesture"]): Cue {
  return { id, textEn: id, textMi: id, durationBeats: 2, category, gesture };
}

const TEST_SHOW: ShowConfig = {
  id: "test-show",
  title: "Test",
  aesthetic: "test",
  targetYears: "n/a",
  defaultLanguage: "en",
  palette: {
    background: "#000",
    ink: "#fff",
    accent: "#ff0",
    gesture: {
      jump: { color: "#f00", shape: "triangle" },
      sidestep: { color: "#0f0", shape: "chevron" },
      duck: { color: "#00f", shape: "bar" },
      reach: { color: "#ff0", shape: "diamond" },
    },
  },
  music: {
    bpm: 120,
    beatsPerBar: 4,
    stepsPerBeat: 4,
    rootHz: 110,
    scale: [0, 2, 4, 5, 7, 9, 11],
    layers: {
      kick: { fromIntensity: 1 },
      bass: { fromIntensity: 2 },
      hats: { fromIntensity: 2 },
      pad: { fromIntensity: 3 },
      lead: { fromIntensity: 4 },
    },
  },
  cues: [
    cue("count-1", "count-in"),
    cue("call-jump-1", "call", "jump"),
    cue("call-jump-2", "call", "jump"),
    cue("call-duck-1", "call", "duck"),
    cue("call-reach-1", "call", "reach"),
    cue("call-side-1", "call", "sidestep"),
    cue("praise-1", "praise"),
    cue("praise-2", "praise"),
    cue("encourage-1", "encourage"),
  ],
  character: { name: "Testo", bodyColor: "#f0f", accentColor: "#0ff" },
  vocabulary: ["jump", "duck", "reach", "sidestep"],
  modes: { follow: { leadBars: 1, callEveryBars: 2 } },
  supportedProfiles: ["standing", "seated"],
};

function stillFrames(fps: number, seconds: number, cx = 0.5): PoseFrame[] {
  const dt = 1 / fps;
  const frames: PoseFrame[] = [];
  for (let t = 0; t <= seconds + 1e-9; t += dt) {
    frames.push({ timestampMs: Math.round(t * 1000), poses: [buildPose({ cx })] });
  }
  return frames;
}

function setup() {
  const consent = new ConsentManager();
  const backend = new FakeAudioBackend();
  backend.advanceTo(1.0);
  let claim: ReturnType<typeof import("./evidence.js").summaryToClaim> | null = null;
  const engine = new ArcadeEngine({
    show: TEST_SHOW,
    mode: "follow",
    team: { id: "room-12", label: "Room 12" },
    profile: "standing",
    consent,
    backend,
    onEvidence: (c) => {
      claim = c;
    },
    rng: () => 0.5,
  });
  return { consent, backend, engine, getClaim: () => claim };
}

describe("engine — consent gate", () => {
  it("refuses to start without camera consent", () => {
    const { engine } = setup();
    const r = engine.requestStart();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no-consent");
    expect(engine.currentPhase).toBe("idle");
  });

  it("starts once camera consent is granted", () => {
    const { engine, consent } = setup();
    consent.grant("camera", "class movement game");
    expect(engine.requestStart().ok).toBe(true);
    expect(engine.currentPhase).toBe("calibrating");
  });

  it("ends immediately if consent is revoked mid-session", () => {
    const { engine, consent, backend } = setup();
    consent.grant("camera", "x");
    engine.requestStart();
    for (const f of stillFrames(25, 1.6)) engine.addCalibrationFrame(f);
    expect(engine.finishCalibration()).toBeGreaterThanOrEqual(1);
    expect(engine.currentPhase).toBe("running");
    backend.advanceTo(2.0);
    consent.revoke("camera");
    expect(engine.currentPhase).toBe("ended");
  });
});

describe("engine — anticipatory cues", () => {
  it("fires each call exactly one bar (leadBars) before its scoring window", () => {
    const { engine, consent, backend } = setup();
    consent.grant("camera", "x");
    engine.requestStart();
    for (const f of stillFrames(25, 1.6)) engine.addCalibrationFrame(f);
    engine.finishCalibration();

    // Known transport origin: backend was at 1.0s, t0 = currentTime + 0.12.
    const t0 = 1.12;
    const secondsPerBar = 2; // 120bpm, 4/4

    let t = backend.currentTime;
    for (let i = 0; i < 350; i++) {
      t += 0.04;
      backend.advanceTo(t);
      engine.ingestPose({ timestampMs: Math.round(t * 1000), poses: [buildPose({ cx: 0.5 })] });
    }

    const onsets = backend.voices
      .filter((v) => v.cueId.startsWith("call-"))
      .map((v) => v.when)
      .sort((a, b) => a - b);
    expect(onsets.length).toBeGreaterThanOrEqual(3);

    // Calls target bars 2,4,6,... windows open at t0 + bar*2s. leadBars=1, so
    // the earliest call onset is one bar earlier: t0 + (2-1)*2s = t0 + 2s.
    expect(onsets[0]!).toBeCloseTo(t0 + secondsPerBar, 2);
    // callEveryBars=2 => successive calls are 2 bars (4s) apart.
    for (let i = 1; i < onsets.length; i++) {
      expect(onsets[i]! - onsets[i - 1]!).toBeCloseTo(2 * secondsPerBar, 2);
    }
  });
});

describe("engine — session summary and evidence", () => {
  it("emits a valid, derived-only cameraPose claim on end", () => {
    const { engine, consent, backend, getClaim } = setup();
    consent.grant("camera", "x");
    engine.requestStart();
    for (const f of stillFrames(25, 1.6)) engine.addCalibrationFrame(f);
    engine.finishCalibration();

    // Player does periodic jumps to accrue movement + a gesture count.
    let t = backend.currentTime;
    for (let i = 0; i < 200; i++) {
      t += 0.04;
      backend.advanceTo(t);
      const phase = i % 25;
      const dy = phase < 3 ? -(phase / 3) * 0.18 : phase < 7 ? -0.18 + ((phase - 3) / 4) * 0.18 : 0;
      engine.ingestPose({ timestampMs: Math.round(t * 1000), poses: [buildPose({ cx: 0.5, dy })] });
    }
    const summary = engine.end();
    expect(summary.teamScore).toBeGreaterThan(0);
    expect(summary.activeSeconds).toBeGreaterThan(0);
    expect(summary.gestureCounts.jump).toBeGreaterThan(0);

    const claim = getClaim();
    expect(claim).not.toBeNull();
    const result = validateCameraPoseClaim(claim);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("end() is idempotent", () => {
    const { engine, consent } = setup();
    consent.grant("camera", "x");
    engine.requestStart();
    for (const f of stillFrames(25, 1.6)) engine.addCalibrationFrame(f);
    engine.finishCalibration();
    const a = engine.end();
    const b = engine.end();
    expect(b.endedAt).toBe(a.endedAt);
  });
});
