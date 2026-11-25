import { describe, expect, it } from 'vitest';
import { MISS_WHISTLE_VOLUME, REFEREE_WHISTLE, synthesizeWhistle } from '../../src/audio/whistleSound';

const RATE = 44_100;

/** RMS loudness of consecutive 10 ms windows. */
function loudness(samples: Float32Array, rate: number): number[] {
  const window = Math.round(rate * 0.01);
  const result: number[] = [];
  for (let start = 0; start + window <= samples.length; start += window) {
    let sum = 0;
    for (let i = start; i < start + window; i++) sum += (samples[i] as number) ** 2;
    result.push(Math.sqrt(sum / window));
  }
  return result;
}

describe('synthesizeWhistle (REQUIREMENTS §5.5)', () => {
  const whistle = synthesizeWhistle(RATE);

  it('lasts the configured duration at the given sample rate', () => {
    expect(whistle.length).toBe(Math.round(REFEREE_WHISTLE.durationSeconds * RATE));
    expect(synthesizeWhistle(48_000).length).toBe(Math.round(REFEREE_WHISTLE.durationSeconds * 48_000));
  });

  it('is a single short blow, not a long or repeated whistle', () => {
    expect(REFEREE_WHISTLE.durationSeconds).toBeGreaterThanOrEqual(0.2);
    expect(REFEREE_WHISTLE.durationSeconds).toBeLessThanOrEqual(0.6);

    // One loud stretch: once it gets loud it stays loud until it fades out at the end.
    const levels = loudness(whistle, RATE);
    const threshold = 0.3 * Math.max(...levels);
    let rises = 0;
    for (let i = 1; i < levels.length; i++) {
      if ((levels[i - 1] as number) < threshold && (levels[i] as number) >= threshold) rises++;
    }
    expect(rises).toBeLessThanOrEqual(1);
    expect(levels[0]).toBeLessThan(threshold * 2);
    expect(levels.filter((level) => level >= threshold).length).toBeGreaterThan(levels.length * 0.6);
  });

  it('is high-pitched, like a whistle', () => {
    // A tone at f Hz crosses zero about 2f times per second.
    let crossings = 0;
    for (let i = 1; i < whistle.length; i++) {
      if (Math.sign(whistle[i] as number) !== Math.sign(whistle[i - 1] as number)) crossings++;
    }
    const pitch = crossings / REFEREE_WHISTLE.durationSeconds / 2;
    expect(pitch).toBeGreaterThan(2000);
    expect(pitch).toBeLessThan(4000);
  });

  it('flutters with the trill of a pea whistle', () => {
    // Loudness wobbles while the whistle sustains.
    const levels = loudness(whistle, RATE).slice(5, -8);
    const max = Math.max(...levels);
    const min = Math.min(...levels);
    expect(min / max).toBeLessThan(0.95);
  });

  it('is normalized to the configured peak and never clips', () => {
    const peak = Math.max(...Array.from(whistle, Math.abs));
    expect(peak).toBeCloseTo(REFEREE_WHISTLE.peak, 5);
    expect(whistle.every((s) => Number.isFinite(s))).toBe(true);
  });

  it('starts and ends at silence, so playback does not click', () => {
    expect(whistle[0]).toBe(0);
    expect(Math.abs(whistle[whistle.length - 1] as number)).toBeLessThan(0.01);
  });

  it('is deterministic', () => {
    expect(synthesizeWhistle(RATE)).toEqual(whistle);
  });

  it('is played at a moderate volume', () => {
    expect(MISS_WHISTLE_VOLUME).toBeGreaterThan(0);
    expect(MISS_WHISTLE_VOLUME).toBeLessThanOrEqual(0.5);
  });
});
