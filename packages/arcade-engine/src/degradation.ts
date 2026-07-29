/**
 * Graceful degradation ladder. When detection FPS sits below the floor for long
 * enough we step DOWN one rung at a time — never a technical error on screen:
 *   0 full  ->  1 lower capture resolution  ->  2 fewer numPoses  ->  3 single player
 * and we recover a rung only after a sustained good stretch, so it never
 * flip-flops. The capture layer reads `level` each frame and acts on it.
 */
export type DegradationLevel = 0 | 1 | 2 | 3;

export interface DegradationAction {
  captureScale: number;
  numPoses: number;
}

const LADDER: Record<DegradationLevel, DegradationAction> = {
  0: { captureScale: 1.0, numPoses: 4 },
  1: { captureScale: 0.75, numPoses: 4 },
  2: { captureScale: 0.75, numPoses: 2 },
  3: { captureScale: 0.6, numPoses: 1 },
};

export class DegradationController {
  private fps = 30;
  private belowSince: number | null = null;
  private aboveSince: number | null = null;
  private level: DegradationLevel = 0;

  constructor(
    private readonly floor = 15,
    private readonly ceiling = 25,
    /** Seconds below floor before stepping down. */
    private readonly downAfter = 2,
    /** Seconds above ceiling before stepping up. */
    private readonly upAfter = 5,
  ) {}

  /** Feed instantaneous FPS and wall-clock seconds; returns the current level. */
  update(instantFps: number, now: number): DegradationLevel {
    this.fps += 0.2 * (instantFps - this.fps); // EMA

    if (this.fps < this.floor) {
      this.aboveSince = null;
      this.belowSince ??= now;
      if (now - this.belowSince >= this.downAfter && this.level < 3) {
        this.level = (this.level + 1) as DegradationLevel;
        this.belowSince = now;
      }
    } else if (this.fps > this.ceiling) {
      this.belowSince = null;
      this.aboveSince ??= now;
      if (now - this.aboveSince >= this.upAfter && this.level > 0) {
        this.level = (this.level - 1) as DegradationLevel;
        this.aboveSince = now;
      }
    } else {
      this.belowSince = null;
      this.aboveSince = null;
    }
    return this.level;
  }

  get action(): DegradationAction {
    return LADDER[this.level];
  }

  get currentLevel(): DegradationLevel {
    return this.level;
  }

  get smoothedFps(): number {
    return this.fps;
  }
}
