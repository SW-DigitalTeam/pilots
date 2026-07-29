import { describe, expect, it } from "vitest";
import { ArcadeEngine, CueBank, FakeAudioBackend, type GestureId } from "@sw/arcade-engine";
import { ConsentManager } from "@sw/shell";
import { ALL_SHOWS, PURE_SHAPES, YEAR_7_8, YEAR_9_10 } from "./index.js";

describe("shows — three complete, distinct shows", () => {
  it("there are exactly three", () => {
    expect(ALL_SHOWS.length).toBe(3);
  });

  it("each has a substantial, varied cue bank (>= 60 lines)", () => {
    for (const show of ALL_SHOWS) {
      expect(show.cues.length).toBeGreaterThanOrEqual(60);
      const ids = new Set(show.cues.map((c) => c.id));
      expect(ids.size).toBe(show.cues.length); // no duplicate ids
    }
  });

  it("every vocabulary gesture has >=2 call cues so rotation never repeats", () => {
    for (const show of ALL_SHOWS) {
      for (const g of show.vocabulary) {
        const calls = show.cues.filter((c) => c.category === "call" && c.gesture === g);
        expect(calls.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("has count-in, praise and encourage lines for the director", () => {
    for (const show of ALL_SHOWS) {
      for (const cat of ["count-in", "praise", "encourage"] as const) {
        expect(show.cues.some((c) => c.category === cat)).toBe(true);
      }
    }
  });

  it("all bilingual: every cue has English and te reo text", () => {
    for (const show of ALL_SHOWS) {
      for (const c of show.cues) {
        expect(c.textEn.length).toBeGreaterThan(0);
        expect(c.textMi.length).toBeGreaterThan(0);
      }
    }
  });

  it("every show supports seated as a first-class profile", () => {
    for (const show of ALL_SHOWS) {
      expect(show.supportedProfiles).toContain("seated");
      expect(show.supportedProfiles).toContain("standing");
    }
  });

  it("the three are genuinely distinct directions, not palette swaps", () => {
    const bpms = new Set(ALL_SHOWS.map((s) => s.music.bpm));
    expect(bpms.size).toBe(3); // different tempos/feels
    const backgrounds = new Set(ALL_SHOWS.map((s) => s.palette.background));
    expect(backgrounds.size).toBe(3);
    // Exactly one is deliberately character-free.
    expect(ALL_SHOWS.filter((s) => s.character === null).length).toBe(1);
    expect(PURE_SHAPES.character).toBeNull();
    expect(YEAR_7_8.character).not.toBeNull();
    expect(YEAR_9_10.character).not.toBeNull();
  });

  it("every colour cue is paired with a distinct shape (projector-safe)", () => {
    for (const show of ALL_SHOWS) {
      const gestures = Object.keys(show.palette.gesture) as GestureId[];
      const shapes = new Set(gestures.map((g) => show.palette.gesture[g].shape));
      expect(shapes.size).toBe(gestures.length); // shape alone disambiguates
    }
  });

  it("cue rotation on a real bank never repeats a call consecutively", () => {
    for (const show of ALL_SHOWS) {
      const bank = new CueBank(show.cues, mulberry(show.id.length + 3));
      for (const g of show.vocabulary) {
        let last = "";
        for (let i = 0; i < 50; i++) {
          const cue = bank.pickCall(g)!;
          expect(cue.id).not.toBe(last);
          last = cue.id;
        }
      }
    }
  });

  it("each show drives a real engine without error", () => {
    for (const show of ALL_SHOWS) {
      const consent = new ConsentManager();
      consent.grant("camera", "class movement game");
      const backend = new FakeAudioBackend();
      backend.advanceTo(1);
      const engine = new ArcadeEngine({
        show,
        mode: Object.keys(show.modes)[0] as "follow",
        team: { id: "room-12", label: "Room 12" },
        profile: "standing",
        consent,
        backend,
      });
      expect(engine.requestStart().ok).toBe(true);
    }
  });
});

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
