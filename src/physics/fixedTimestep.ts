/** Default fixed simulation step: 120 steps per second. */
export const DEFAULT_STEP_SECONDS = 1 / 120;

/**
 * Longest frame time that is simulated. Longer gaps (e.g. after the browser tab
 * was in the background) are cut to this, so the game does not fast-forward.
 */
export const DEFAULT_MAX_FRAME_SECONDS = 0.25;

/** Absorbs floating-point error when frame times are exact multiples of the step. */
const ACCUMULATOR_SLACK = 1e-9;

/**
 * Fixed-timestep accumulator (REQUIREMENTS §7.1): turns variable frame times
 * into a whole number of equal simulation steps, so physics results do not
 * depend on the rendering frame rate.
 */
export class FixedTimestep {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  private accumulator = 0;

  constructor(stepSeconds = DEFAULT_STEP_SECONDS, maxFrameSeconds = DEFAULT_MAX_FRAME_SECONDS) {
    if (!(stepSeconds > 0) || !Number.isFinite(stepSeconds)) {
      throw new RangeError('stepSeconds must be a finite number > 0');
    }
    if (!(maxFrameSeconds >= stepSeconds) || !Number.isFinite(maxFrameSeconds)) {
      throw new RangeError('maxFrameSeconds must be a finite number >= stepSeconds');
    }
    this.stepSeconds = stepSeconds;
    this.maxFrameSeconds = maxFrameSeconds;
  }

  /**
   * Adds one frame's elapsed time and calls `step` once per whole fixed step
   * now due. Negative or non-finite frame times are ignored. Returns the number
   * of steps run.
   */
  advance(frameSeconds: number, step: (stepSeconds: number) => void): number {
    if (!Number.isFinite(frameSeconds) || frameSeconds <= 0) {
      return 0;
    }

    this.accumulator += Math.min(frameSeconds, this.maxFrameSeconds);

    let steps = 0;
    while (this.accumulator + ACCUMULATOR_SLACK >= this.stepSeconds) {
      step(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      steps++;
    }
    if (this.accumulator < 0) {
      this.accumulator = 0;
    }
    return steps;
  }
}
