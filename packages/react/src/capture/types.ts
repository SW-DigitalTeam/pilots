import type { DegradationAction, PoseFrame } from "@pwa/arcade-engine";

/**
 * The capture seam. The component depends on this interface, not on MediaPipe,
 * so tests inject a fake that emits recorded frames and the real pipeline never
 * runs in a headless environment. Frames carry only landmark numbers; the raw
 * video element never leaves this boundary.
 */
export interface PoseCapture {
  /** Begin capturing; resolves once the camera and model are live. */
  start(): Promise<void>;
  stop(): void;
  /** Apply a graceful-degradation recommendation (resolution, numPoses). */
  applyQuality(action: DegradationAction): void;
  /** The <video> element to show locally (never transmitted). */
  readonly video: HTMLVideoElement | null;
}

export interface CaptureOptions {
  onFrame: (frame: PoseFrame) => void;
  /** Up to four players. */
  numPoses?: number;
  /** Model asset + wasm locations, cached by the service worker. */
  modelAssetPath?: string;
  wasmBasePath?: string;
}
