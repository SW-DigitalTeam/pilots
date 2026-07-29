/**
 * The single clock everything hangs off. Times are derived from *indices*
 * (beat/step), never accumulated from wall-clock ticks, so no drift can build
 * up no matter how jittery the scheduling timer is. Visuals read the same
 * `beatAtTime`, which is why audio and animation can never desync.
 */
export class Transport {
  readonly secondsPerBeat: number;
  readonly secondsPerStep: number;

  constructor(
    readonly bpm: number,
    readonly beatsPerBar: number,
    readonly stepsPerBeat: number,
    /** AudioContext.currentTime at which step 0 begins. */
    readonly startTime: number,
  ) {
    this.secondsPerBeat = 60 / bpm;
    this.secondsPerStep = this.secondsPerBeat / stepsPerBeat;
  }

  get stepsPerBar(): number {
    return this.beatsPerBar * this.stepsPerBeat;
  }

  timeAtStep(step: number): number {
    return this.startTime + step * this.secondsPerStep;
  }

  timeAtBeat(beat: number): number {
    return this.startTime + beat * this.secondsPerBeat;
  }

  timeAtBar(bar: number): number {
    return this.timeAtBeat(bar * this.beatsPerBar);
  }

  beatAtTime(time: number): number {
    return (time - this.startTime) / this.secondsPerBeat;
  }

  stepAtTime(time: number): number {
    return (time - this.startTime) / this.secondsPerStep;
  }
}
