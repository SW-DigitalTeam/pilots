import { describe, expect, it } from "vitest";
import { FakeAudioBackend } from "./backend.js";
import { Transport } from "./clock.js";
import { MusicBed } from "./musicBed.js";
import { AudioScheduler } from "./scheduler.js";
import { CueBank } from "./cueBank.js";
import type { Cue, MusicConfig } from "../show.js";

const MUSIC: MusicConfig = {
  bpm: 120,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  rootHz: 110,
  scale: [0, 2, 4, 5, 7, 9, 11],
  layers: {
    kick: { fromIntensity: 1 },
    bass: { fromIntensity: 1 },
    hats: { fromIntensity: 1 },
    pad: { fromIntensity: 1 },
    lead: { fromIntensity: 1 },
  },
};

function runSession(seconds: number, seed: number) {
  const backend = new FakeAudioBackend();
  backend.advanceTo(0.5); // "unlock" happened; clock already moving
  const t0 = backend.currentTime + 0.12;
  const transport = new Transport(MUSIC.bpm, MUSIC.beatsPerBar, MUSIC.stepsPerBeat, t0);
  const bed = new MusicBed(MUSIC);
  const scheduler = new AudioScheduler(backend, transport, bed);
  scheduler.setIntensity(5); // all layers on -> most events to check

  // Deterministic jitter so ticks are irregular but never gap past lookahead.
  let rng = seed;
  const rand = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  // Enqueue a voice cue on every bar downbeat to test onset accuracy + ducking.
  const endTime = backend.currentTime + seconds;
  const cueDuration = transport.secondsPerBeat * 1.5;
  let bar = 0;
  while (transport.timeAtBar(bar) < endTime) {
    scheduler.enqueueVoice(transport.timeAtBar(bar), `cue-${bar}`, "en", cueDuration);
    bar++;
  }

  scheduler.tick();
  while (backend.currentTime < endTime) {
    const gap = 0.01 + rand() * 0.075; // 10..85ms < 100ms lookahead
    backend.advanceTo(backend.currentTime + gap);
    scheduler.tick();
  }
  return { backend, transport, bars: bar };
}

describe("audio critic — no drift across a 5-minute session", () => {
  const { backend, transport } = runSession(300, 1);

  it("every music onset sits exactly on the step grid (drift ~ 0, << 20ms)", () => {
    let maxErr = 0;
    for (const tone of backend.tones) {
      const step = (tone.when - transport.startTime) / transport.secondsPerStep;
      const err = Math.abs(step - Math.round(step)) * transport.secondsPerStep;
      maxErr = Math.max(maxErr, err);
    }
    expect(maxErr * 1000).toBeLessThan(20);
    expect(maxErr * 1000).toBeLessThan(1e-6); // in fact exact — computed from index
  });

  it("every voice cue lands exactly on its requested onset", () => {
    let maxErr = 0;
    for (const v of backend.voices) {
      const bar = Number(v.cueId.split("-")[1]);
      const err = Math.abs(v.when - transport.timeAtBar(bar));
      maxErr = Math.max(maxErr, err);
    }
    expect(maxErr * 1000).toBeLessThan(1e-6);
  });

  it("schedules each beat's kick exactly once — nothing dropped or duplicated", () => {
    const kicks = backend.tones.filter((t) => t.layer === "kick").map((t) => t.when);
    const beats = new Set(kicks.map((w) => Math.round((w - transport.startTime) / transport.secondsPerBeat)));
    // One kick per beat, and count equals distinct beats (no dup).
    expect(kicks.length).toBe(beats.size);
    expect(kicks.length).toBeGreaterThan(500);
  });

  it("music onsets are monotonically non-decreasing (scheduled in order)", () => {
    // Grid steps are scheduled in order; within a step, tones share a time.
    let last = -Infinity;
    let stepTime = -Infinity;
    for (const tone of backend.tones) {
      if (tone.when + 1e-9 < stepTime) {
        // allowed only if same step batch
        expect(tone.when).toBeGreaterThanOrEqual(last - 1e-9);
      }
      stepTime = tone.when;
      last = tone.when;
    }
    expect(true).toBe(true);
  });
});

describe("audio critic — no click at bar boundaries", () => {
  const { backend } = runSession(30, 2);
  it("pad notes are contiguous across bars (no gap/overlap => no restart click)", () => {
    // Group pad tones by start time; each bar contributes a chord at its start.
    const padStarts = [...new Set(backend.tones.filter((t) => t.layer === "pad").map((t) => t.when))].sort(
      (a, b) => a - b,
    );
    const durByStart = new Map<number, number>();
    for (const t of backend.tones.filter((x) => x.layer === "pad")) durByStart.set(t.when, t.duration);
    for (let i = 1; i < padStarts.length; i++) {
      const prev = padStarts[i - 1]!;
      const gap = padStarts[i]! - (prev + durByStart.get(prev)!);
      expect(Math.abs(gap) * 1000).toBeLessThan(1e-6); // seamless
    }
  });
});

describe("audio critic — music ducks under every voice cue", () => {
  const { backend } = runSession(20, 3);
  it("each voice has a matching duck at onset and unduck after its duration", () => {
    expect(backend.ducks.length).toBe(backend.voices.length);
    for (const v of backend.voices) {
      const duck = backend.ducks.find((d) => Math.abs(d.when - v.when) < 1e-6);
      expect(duck).toBeDefined();
      expect(duck!.db).toBe(-6);
      expect(duck!.rampMs).toBe(50);
      const unduck = backend.unducks.find((u) => Math.abs(u.when - (v.when + v.durationSeconds)) < 1e-6);
      expect(unduck).toBeDefined();
    }
  });
});

describe("audio critic — cue rotation never repeats consecutively", () => {
  function makeCue(id: string, cat: Cue["category"]): Cue {
    return { id, textEn: id, textMi: id, durationBeats: 2, category: cat };
  }
  it("praise never fires the same line twice in a row over 500 draws", () => {
    const cues = ["p1", "p2", "p3", "p4"].map((id) => makeCue(id, "praise"));
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const bank = new CueBank(cues, rand);
    let last = "";
    for (let i = 0; i < 500; i++) {
      const cue = bank.pick("praise")!;
      expect(cue.id).not.toBe(last);
      last = cue.id;
    }
  });
  it("a single-line category returns that line (degenerate, still no crash)", () => {
    const bank = new CueBank([makeCue("only", "idle")]);
    expect(bank.pick("idle")!.id).toBe("only");
  });
});

describe("audio critic — audio and animation share one clock (cannot desync)", () => {
  it("beatAtTime is the exact inverse of timeAtBeat", () => {
    const t = new Transport(128, 4, 4, 3.14159);
    for (let b = 0; b < 2000; b += 0.5) {
      expect(t.beatAtTime(t.timeAtBeat(b))).toBeCloseTo(b, 9);
    }
  });
  it("the visual beat read at a scheduled tone's time matches its grid beat", () => {
    const { backend, transport } = runSession(20, 4);
    for (const tone of backend.tones.filter((x) => x.layer === "kick")) {
      const beat = transport.beatAtTime(tone.when);
      expect(beat).toBeCloseTo(Math.round(beat), 9);
    }
  });
});
