import type { Cue, GestureId } from "@pwa/arcade-engine";

/**
 * Builds a show's cue bank from per-show English personality pools, mapped onto
 * a small set of CORRECT core te reo Māori phrases. The te reo here is limited
 * to well-established words/phrases; the recording script (docs/VOICE_SCRIPT.md)
 * flags that a kaiako must review and voice the final te reo — it must never be
 * machine-generated. Ids and durationBeats are stable so real recordings drop
 * straight in over these placeholders.
 */
export interface ShowVoice {
  slug: string;
  calls: Record<GestureId, string[]>;
  praise: string[];
  encourage: string[];
  countIn: string[];
  transition: string[];
  idle: string[];
}

// Correct core te reo. Calls use the move word; the rest rotate correct phrases.
const TEREO_CALL: Record<GestureId, string> = {
  jump: "Peke!",
  duck: "Piko!",
  reach: "Toro!",
  sidestep: "Taha!",
};
const TEREO_PRAISE = ["Ka pai!", "Tino pai!", "Ka rawe!", "Mīharo!"];
const TEREO_ENCOURAGE = ["Kia kaha!", "Kia kaha rā!", "Kōkiri!"];
const TEREO_COUNT = ["Tahi, rua!", "Rua, toru!"];
const TEREO_TRANSITION = ["Anō!", "Kia rite!"];
const TEREO_IDLE = ["Kei te pai?", "Kia kaha!"];

const DURATION: Record<Cue["category"], number> = {
  call: 2,
  praise: 1,
  encourage: 2,
  "count-in": 1,
  transition: 1,
  idle: 2,
};

function mk(
  slug: string,
  category: Cue["category"],
  index: number,
  textEn: string,
  textMi: string,
  gesture?: GestureId,
): Cue {
  const id = gesture
    ? `${slug}-call-${gesture}-${index}`
    : `${slug}-${category}-${index}`;
  return { id, textEn, textMi, durationBeats: DURATION[category], category, gesture };
}

export function buildCues(voice: ShowVoice): Cue[] {
  const cues: Cue[] = [];
  const gestures: GestureId[] = ["jump", "duck", "reach", "sidestep"];

  for (const g of gestures) {
    voice.calls[g].forEach((en, i) => cues.push(mk(voice.slug, "call", i, en, TEREO_CALL[g], g)));
  }
  voice.praise.forEach((en, i) =>
    cues.push(mk(voice.slug, "praise", i, en, TEREO_PRAISE[i % TEREO_PRAISE.length]!)),
  );
  voice.encourage.forEach((en, i) =>
    cues.push(mk(voice.slug, "encourage", i, en, TEREO_ENCOURAGE[i % TEREO_ENCOURAGE.length]!)),
  );
  voice.countIn.forEach((en, i) =>
    cues.push(mk(voice.slug, "count-in", i, en, TEREO_COUNT[i % TEREO_COUNT.length]!)),
  );
  voice.transition.forEach((en, i) =>
    cues.push(mk(voice.slug, "transition", i, en, TEREO_TRANSITION[i % TEREO_TRANSITION.length]!)),
  );
  voice.idle.forEach((en, i) =>
    cues.push(mk(voice.slug, "idle", i, en, TEREO_IDLE[i % TEREO_IDLE.length]!)),
  );
  return cues;
}
