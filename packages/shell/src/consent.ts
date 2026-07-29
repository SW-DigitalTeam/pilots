/**
 * Data-class consent — owned by the shell, never by an activity.
 *
 * A "data class" is a category of on-device signal an activity may derive
 * numbers from. `camera` means: the activity may read webcam frames *locally*
 * to compute derived numbers. It does NOT grant permission to transmit or
 * store frames — that is forbidden unconditionally by the privacy rules and
 * is not a consent the shell can hand out.
 *
 * Arcade Arena calls into this; it must not build its own consent UI or state.
 */

export type DataClass = "camera" | "microphone" | "location";

export interface ConsentRecord {
  dataClass: DataClass;
  grantedAt: number;
  /** Free-text scope shown to the operator, e.g. "class movement game". */
  purpose: string;
}

export type ConsentListener = (dataClass: DataClass, granted: boolean) => void;

/**
 * The minimal surface an activity is allowed to see. An activity receives a
 * `ConsentGate`, never the full manager — it can ask and it can watch, but it
 * cannot grant on its own behalf.
 */
export interface ConsentGate {
  has(dataClass: DataClass): boolean;
  /** Fires on grant and on revoke. Returns an unsubscribe fn. */
  subscribe(listener: ConsentListener): () => void;
}

export class ConsentManager implements ConsentGate {
  private readonly records = new Map<DataClass, ConsentRecord>();
  private readonly listeners = new Set<ConsentListener>();

  has(dataClass: DataClass): boolean {
    return this.records.has(dataClass);
  }

  get(dataClass: DataClass): ConsentRecord | undefined {
    return this.records.get(dataClass);
  }

  grant(dataClass: DataClass, purpose: string): void {
    if (this.records.has(dataClass)) return;
    this.records.set(dataClass, { dataClass, grantedAt: Date.now(), purpose });
    this.emit(dataClass, true);
  }

  /** Revoking mid-session must stop the activity; the gate notifies it. */
  revoke(dataClass: DataClass): void {
    if (!this.records.delete(dataClass)) return;
    this.emit(dataClass, false);
  }

  subscribe(listener: ConsentListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(dataClass: DataClass, granted: boolean): void {
    for (const l of this.listeners) l(dataClass, granted);
  }
}
