import type { Cue, CueCategory, Language } from "../show.js";
import type { GestureId } from "../types.js";

/**
 * Owns cue selection and, crucially, rotation. The same praise line firing
 * twice in a row is exactly what makes these games feel cheap, so each category
 * draws from a shuffle bag that never repeats the previous pick — even across
 * bag refills. `call` cues are additionally indexed by gesture.
 */
export class CueBank {
  private readonly byCategory = new Map<CueCategory, Cue[]>();
  private readonly bags = new Map<CueCategory, Cue[]>();
  private readonly last = new Map<CueCategory, string>();
  private readonly callByGesture = new Map<GestureId, Cue[]>();
  private readonly callBag = new Map<GestureId, Cue[]>();
  private readonly lastCall = new Map<GestureId, string>();

  constructor(
    private readonly cues: Cue[],
    private readonly rng: () => number = Math.random,
  ) {
    for (const cue of cues) {
      push(this.byCategory, cue.category, cue);
      if (cue.category === "call" && cue.gesture) push(this.callByGesture, cue.gesture, cue);
    }
  }

  has(category: CueCategory): boolean {
    return (this.byCategory.get(category)?.length ?? 0) > 0;
  }

  /** Next cue from a category, never repeating the previous one. */
  pick(category: CueCategory): Cue | null {
    const pool = this.byCategory.get(category);
    if (!pool || pool.length === 0) return null;
    if (pool.length === 1) return pool[0]!;
    let bag = this.bags.get(category);
    if (!bag || bag.length === 0) {
      bag = this.freshBag(pool, this.last.get(category));
      this.bags.set(category, bag);
    }
    const cue = bag.pop()!;
    this.last.set(category, cue.id);
    return cue;
  }

  /** Next `call` cue for a gesture, never repeating the previous one. */
  pickCall(gesture: GestureId): Cue | null {
    const pool = this.callByGesture.get(gesture);
    if (!pool || pool.length === 0) return null;
    if (pool.length === 1) return pool[0]!;
    let bag = this.callBag.get(gesture);
    if (!bag || bag.length === 0) {
      bag = this.freshBag(pool, this.lastCall.get(gesture));
      this.callBag.set(gesture, bag);
    }
    const cue = bag.pop()!;
    this.lastCall.set(gesture, cue.id);
    return cue;
  }

  text(cue: Cue, lang: Language): string {
    return lang === "mi" ? cue.textMi : cue.textEn;
  }

  buffer(cue: Cue, lang: Language): AudioBuffer | undefined {
    return cue.buffer?.[lang];
  }

  get size(): number {
    return this.cues.length;
  }

  /** Shuffled copy whose LAST element (popped first) is not `avoidId`. */
  private freshBag(pool: Cue[], avoidId: string | undefined): Cue[] {
    const bag = shuffle(pool, this.rng);
    if (avoidId && bag[bag.length - 1]!.id === avoidId && bag.length > 1) {
      // Swap the tail so we don't repeat across the bag boundary.
      const tmp = bag[bag.length - 1]!;
      bag[bag.length - 1] = bag[0]!;
      bag[0] = tmp;
    }
    return bag;
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}
