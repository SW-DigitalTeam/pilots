import { FakeAudioBackend, type PoseFrame } from "@pwa/arcade-engine";
import type { BrowserBackend } from "./backend.js";
import type { CaptureOptions, PoseCapture } from "./capture/types.js";

/** A deterministic, silent backend for component/integration tests. */
export class FakeBrowserBackend extends FakeAudioBackend implements BrowserBackend {
  amplitude = 0;
  async unlock(): Promise<void> {
    /* already "running" */
  }
  voiceAmplitude(): number {
    return this.amplitude;
  }
}

/**
 * A capture that replays supplied frames on start(). The test advances the
 * backend clock and pumps frames, exercising the real component lifecycle
 * without a camera or MediaPipe.
 */
export class FakePoseCapture implements PoseCapture {
  video: HTMLVideoElement | null = null;
  private opts: CaptureOptions;

  constructor(opts: CaptureOptions) {
    this.opts = opts;
  }
  async start(): Promise<void> {
    /* frames are pushed manually via emit() */
  }
  stop(): void {
    /* no-op */
  }
  applyQuality(): void {
    /* no-op */
  }
  emit(frame: PoseFrame): void {
    this.opts.onFrame(frame);
  }
}
