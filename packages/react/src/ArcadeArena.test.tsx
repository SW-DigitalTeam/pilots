import React from "react";
import { describe, expect, it, beforeAll, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ConsentManager, validateCameraPoseClaim, type CameraPoseClaim } from "@pwa/shell";
import type { PoseFrame, ShowConfig } from "@pwa/arcade-engine";
import { buildPose } from "@pwa/arcade-engine/replay";
import { ArcadeArena } from "./ArcadeArena.js";
import { FakeBrowserBackend, FakePoseCapture } from "./testing.js";
import type { CaptureOptions } from "./capture/types.js";

beforeAll(() => {
  // jsdom lacks rAF; a no-op (never re-schedules) is enough for the lifecycle.
  globalThis.requestAnimationFrame = vi.fn(() => 0) as unknown as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = vi.fn();
  // jsdom has no 2D context; a permissive stub lets the real renderer run so
  // drawFrame is exercised (and silences jsdom's not-implemented noise).
  const ctxStub = new Proxy({}, { get: () => () => undefined, set: () => true });
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctxStub,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const SHOW: ShowConfig = {
  id: "t",
  title: "T",
  aesthetic: "x",
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
    { id: "c1", textEn: "one", textMi: "tahi", durationBeats: 2, category: "count-in" },
    { id: "j1", textEn: "jump", textMi: "peke", durationBeats: 2, category: "call", gesture: "jump" },
    { id: "p1", textEn: "yes", textMi: "ka pai", durationBeats: 1, category: "praise" },
  ],
  character: { name: "T", bodyColor: "#f0f", accentColor: "#0ff" },
  vocabulary: ["jump", "reach", "duck", "sidestep"],
  modes: { follow: { leadBars: 1, callEveryBars: 2 } },
  supportedProfiles: ["standing", "seated"],
};

function harness() {
  const consent = new ConsentManager();
  const backend = new FakeBrowserBackend();
  backend.advanceTo(0);
  let capture: FakePoseCapture | null = null;
  const claims: CameraPoseClaim[] = [];
  const ui = (
    <ArcadeArena
      show={SHOW}
      mode="follow"
      team={{ id: "room-12", label: "Room 12" }}
      consent={consent}
      calibrationSeconds={1}
      onEvidence={(c) => claims.push(c)}
      createBackend={() => backend}
      createCapture={(opts: CaptureOptions) => {
        capture = new FakePoseCapture(opts);
        return capture;
      }}
    />
  );
  return { consent, backend, ui, claims, getCapture: () => capture! };
}

describe("ArcadeArena — integration critic", () => {
  it("refuses to start without camera consent", async () => {
    const { ui } = harness();
    render(ui);
    fireEvent.click(screen.getByLabelText("Start"));
    await waitFor(() => expect(screen.getByText("Camera needed")).toBeTruthy());
    cleanup();
  });

  it("shows the persistent camera indicator once running", async () => {
    const { ui, consent } = harness();
    consent.grant("camera", "class movement game");
    render(ui);
    fireEvent.click(screen.getByLabelText("Start"));
    await waitFor(() => expect(screen.getByText("Stand still")).toBeTruthy());
    expect(screen.getByText("Camera on. Nothing is recorded or sent.")).toBeTruthy();
    cleanup();
  });

  it("runs the full lifecycle and emits a valid cameraPose claim", async () => {
    const { ui, consent, backend, claims, getCapture } = harness();
    consent.grant("camera", "class movement game");
    render(ui);
    fireEvent.click(screen.getByLabelText("Start"));
    await waitFor(() => expect(screen.getByText("Stand still")).toBeTruthy());

    const capture = getCapture();
    // Calibration: still frames while the clock crosses calibrationSeconds=1s.
    let t = 0;
    for (let i = 0; i < 40; i++) {
      t += 0.04;
      backend.advanceTo(t);
      capture.emit({ timestampMs: Math.round(t * 1000), poses: [buildPose({ cx: 0.5 })] });
    }
    await waitFor(() => expect(screen.getByLabelText("Finish")).toBeTruthy());

    // Gameplay: periodic jumps to accrue score + a gesture count.
    for (let i = 0; i < 200; i++) {
      t += 0.04;
      backend.advanceTo(t);
      const ph = i % 25;
      const dy = ph < 3 ? -(ph / 3) * 0.18 : ph < 7 ? -0.18 + ((ph - 3) / 4) * 0.18 : 0;
      const frame: PoseFrame = { timestampMs: Math.round(t * 1000), poses: [buildPose({ cx: 0.5, dy })] };
      capture.emit(frame);
    }

    fireEvent.click(screen.getByLabelText("Finish"));
    await waitFor(() => expect(claims.length).toBe(1));
    const result = validateCameraPoseClaim(claims[0]);
    expect(result.errors).toEqual([]);
    expect(claims[0]!.teamScore).toBeGreaterThan(0);
    expect(claims[0]!.gestureCounts.jump).toBeGreaterThan(0);
    cleanup();
  });
});
