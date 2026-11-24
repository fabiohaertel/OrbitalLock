import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_FRAME_SECONDS,
  DEFAULT_STEP_SECONDS,
  FixedTimestep,
} from '../../src/physics/fixedTimestep';

function countSteps(timestep: FixedTimestep, frames: readonly number[]): number {
  let total = 0;
  for (const frame of frames) {
    total += timestep.advance(frame, () => undefined);
  }
  return total;
}

describe('FixedTimestep', () => {
  it('uses 120 steps per second and a 0.25 s frame cap by default', () => {
    const timestep = new FixedTimestep();
    expect(timestep.stepSeconds).toBe(DEFAULT_STEP_SECONDS);
    expect(DEFAULT_STEP_SECONDS).toBeCloseTo(1 / 120, 12);
    expect(timestep.maxFrameSeconds).toBe(DEFAULT_MAX_FRAME_SECONDS);
  });

  it('always passes the fixed step length to the callback', () => {
    const timestep = new FixedTimestep(0.01);
    const seen: number[] = [];
    timestep.advance(0.035, (dt) => seen.push(dt));
    expect(seen).toEqual([0.01, 0.01, 0.01]);
  });

  it('runs the same number of steps regardless of frame rate', () => {
    const second = 1;
    const at30fps = countSteps(new FixedTimestep(), Array<number>(30).fill(second / 30));
    const at60fps = countSteps(new FixedTimestep(), Array<number>(60).fill(second / 60));
    const at144fps = countSteps(new FixedTimestep(), Array<number>(144).fill(second / 144));
    expect(at30fps).toBe(120);
    expect(at60fps).toBe(120);
    expect(at144fps).toBe(120);
  });

  it('carries leftover time over to later frames', () => {
    const timestep = new FixedTimestep(0.01);
    expect(timestep.advance(0.004, () => undefined)).toBe(0);
    expect(timestep.advance(0.004, () => undefined)).toBe(0);
    expect(timestep.advance(0.004, () => undefined)).toBe(1);
  });

  it('caps long frames so the simulation does not fast-forward', () => {
    const timestep = new FixedTimestep(0.01, 0.1);
    expect(timestep.advance(5, () => undefined)).toBe(10);
  });

  it('ignores zero, negative and non-finite frame times', () => {
    const timestep = new FixedTimestep(0.01);
    for (const frame of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(timestep.advance(frame, () => undefined)).toBe(0);
    }
    expect(timestep.advance(0.01, () => undefined)).toBe(1);
  });

  it('rejects invalid construction parameters', () => {
    expect(() => new FixedTimestep(0)).toThrow(RangeError);
    expect(() => new FixedTimestep(-1)).toThrow(RangeError);
    expect(() => new FixedTimestep(0.1, 0.05)).toThrow(RangeError);
    expect(() => new FixedTimestep(0.1, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
