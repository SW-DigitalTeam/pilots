import type { DegradationAction, Landmark, Pose, PoseFrame } from "@sw/arcade-engine";
import type { CaptureOptions, PoseCapture } from "./types.js";

/**
 * MediaPipe PoseLandmarker capture.
 *
 * The video element is read directly by the model on-device; no frame is ever
 * copied to a canvas for export, encoded, or sent anywhere. Landmarks are
 * mirrored to display space here (x -> 1 - x) so "right in the room is right on
 * screen" holds for both rendering and gesture logic. Detection runs on its own
 * rAF; the game renders separately, so frame drops degrade smoothly.
 *
 * This file is browser-only and intentionally uses a dynamic import so the
 * package can be consumed (and tested) without the optional MediaPipe dep.
 */
export class MediaPipeCapture implements PoseCapture {
  video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: unknown = null;
  private running = false;
  private numPoses: number;
  private captureScale = 1;

  constructor(private readonly opts: CaptureOptions) {
    this.numPoses = opts.numPoses ?? 4;
  }

  async start(): Promise<void> {
    const vision = (await import("@mediapipe/tasks-vision")) as unknown as MediaPipeModule;
    const fileset = await vision.FilesetResolver.forVisionTasks(
      this.opts.wasmBasePath ?? "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    );
    this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          this.opts.modelAssetPath ??
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: this.numPoses,
    });

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 640, height: 480,
        facingMode: this.opts.facingMode ?? "environment",
      },
      audio: false,
    });
    const video = document.createElement("video");
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    this.video = video;
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
  }

  applyQuality(action: DegradationAction): void {
    this.captureScale = action.captureScale;
    // numPoses can only be lowered live without recreating the model cheaply;
    // we clamp here and the detector honours the smaller count.
    this.numPoses = Math.min(this.numPoses, action.numPoses);
  }

  private loop = (): void => {
    if (!this.running || !this.video) return;
    const landmarker = this.landmarker as PoseLandmarkerLike | null;
    if (landmarker) {
      const ts = performance.now();
      const result = landmarker.detectForVideo(this.video, ts);
      this.opts.onFrame(toFrame(result, ts));
    }
    requestAnimationFrame(this.loop);
  };
}

function toFrame(result: DetectResult, ts: number): PoseFrame {
  const poses: Pose[] = (result.landmarks ?? []).map((lms) => ({
    landmarks: lms.map(
      (l): Landmark => ({ x: 1 - l.x, y: l.y, z: l.z ?? 0, visibility: l.visibility ?? 1 }),
    ),
  }));
  return { timestampMs: ts, poses };
}

// Minimal structural types so we don't hard-depend on the optional package.
interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}
interface DetectResult {
  landmarks?: NormalizedLandmark[][];
}
interface PoseLandmarkerLike {
  detectForVideo(video: HTMLVideoElement, ts: number): DetectResult;
}
interface MediaPipeModule {
  FilesetResolver: { forVisionTasks(base: string): Promise<unknown> };
  PoseLandmarker: {
    createFromOptions(fileset: unknown, options: unknown): Promise<PoseLandmarkerLike>;
  };
}
