import type { AudioBackend } from "@pwa/arcade-engine";

/** A backend the component can unlock on a gesture and read amplitude from. */
export interface BrowserBackend extends AudioBackend {
  unlock(): Promise<void>;
  voiceAmplitude(): number;
}
