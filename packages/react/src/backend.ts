import type { AudioBackend } from "@sw/arcade-engine";

/** A backend the component can unlock on a gesture, read amplitude from, and
 * decode audio buffers with. */
export interface BrowserBackend extends AudioBackend {
  /** The underlying AudioContext (used to decode music track files). */
  readonly ctx: AudioContext;
  unlock(): Promise<void>;
  voiceAmplitude(): number;
}
