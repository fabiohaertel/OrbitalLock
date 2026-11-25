import { describe, expect, it } from 'vitest';
import { COLLISION_SOUND_VOLUME, SOFT_KICK, synthesizeKick } from '../../src/audio/kickSound';

const RATE = 44_100;

function rms(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += (samples[i] as number) ** 2;
  return Math.sqrt(sum / (to - from));
}

describe('synthesizeKick (REQUIREMENTS §5.5)', () => {
  const kick = synthesizeKick(RATE);

  it('lasts the configured duration at the given sample rate', () => {
    expect(kick.length).toBe(Math.round(SOFT_KICK.durationSeconds * RATE));
    expect(synthesizeKick(48_000).length).toBe(Math.round(SOFT_KICK.durationSeconds * 48_000));
  });

  it('is short: a kick, not a sustained tone', () => {
    expect(SOFT_KICK.durationSeconds).toBeLessThanOrEqual(0.25);
  });

  it('is normalized to the configured peak and never clips', () => {
    const peak = Math.max(...Array.from(kick, Math.abs));
    expect(peak).toBeCloseTo(SOFT_KICK.peak, 5);
    expect(peak).toBeLessThanOrEqual(1);
    expect(kick.every((s) => Number.isFinite(s))).toBe(true);
  });

  it('starts and ends at silence, so playback does not click', () => {
    expect(kick[0]).toBe(0);
    expect(Math.abs(kick[kick.length - 1] as number)).toBeLessThan(0.01);
  });

  it('puts its energy in the first moments, like an impact', () => {
    const tenth = Math.floor(kick.length / 10);
    expect(rms(kick, 0, 3 * tenth)).toBeGreaterThan(10 * rms(kick, 7 * tenth, kick.length));
  });

  it('is low-pitched and muffled: few zero crossings', () => {
    // A 70–170 Hz thump crosses zero a few hundred times per second; bright noise would cross thousands.
    let crossings = 0;
    for (let i = 1; i < kick.length; i++) {
      if (Math.sign(kick[i] as number) !== Math.sign(kick[i - 1] as number)) crossings++;
    }
    expect(crossings / SOFT_KICK.durationSeconds).toBeLessThan(1200);
  });

  it('is deterministic', () => {
    expect(synthesizeKick(RATE)).toEqual(kick);
  });

  it('is played softly', () => {
    expect(COLLISION_SOUND_VOLUME).toBeGreaterThan(0);
    expect(COLLISION_SOUND_VOLUME).toBeLessThanOrEqual(0.5);
  });
});
