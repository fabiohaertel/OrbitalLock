import { describe, expect, it } from 'vitest';
import { GOAL_SOUND, GOAL_SOUND_VOLUME, goalSoundDuration, synthesizeGoal } from '../../src/audio/goalSound';
import { COLLISION_SOUND_VOLUME, SOFT_KICK } from '../../src/audio/kickSound';
import { FOUL_WHISTLE_VOLUME, REFEREE_WHISTLE } from '../../src/audio/whistleSound';

const RATE = 44_100;

/** Samples from `start` to `end` seconds. */
function slice(samples: Float32Array, start: number, end: number): Float32Array {
  return samples.subarray(Math.round(start * RATE), Math.round(end * RATE));
}

/** Estimated pitch: a tone at f Hz crosses zero about 2f times per second. */
function pitch(samples: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if (Math.sign(samples[i] as number) !== Math.sign(samples[i - 1] as number)) crossings++;
  }
  return crossings / (samples.length / RATE) / 2;
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

/** Two-pole high-pass (two cascaded one-pole stages) at `cutoff` Hz. */
function highPass(samples: Float32Array, cutoff: number): Float32Array {
  const k = Math.exp((-2 * Math.PI * cutoff) / RATE);
  let out = Float32Array.from(samples);
  for (let stage = 0; stage < 2; stage++) {
    const input = out;
    out = new Float32Array(input.length);
    let low = 0;
    for (let i = 0; i < input.length; i++) {
      low = (1 - k) * (input[i] as number) + k * low;
      out[i] = (input[i] as number) - low;
    }
  }
  return out;
}

/** Strongest normalized autocorrelation over lags of 2–10 ms: close to 1 for a steady tone. */
function periodicity(samples: Float32Array): number {
  let energy = 0;
  for (const s of samples) energy += s * s;
  let best = 0;
  for (let lag = Math.round(0.002 * RATE); lag <= Math.round(0.01 * RATE); lag++) {
    let sum = 0;
    for (let i = lag; i < samples.length; i++) sum += (samples[i] as number) * (samples[i - lag] as number);
    best = Math.max(best, sum / energy);
  }
  return best;
}

describe('synthesizeGoal: a stadium crowd shouting "ahhh" (REQUIREMENTS §5.5)', () => {
  const goal = synthesizeGoal(RATE);
  const duration = goalSoundDuration();
  const sustain = slice(goal, GOAL_SOUND.attackSeconds, duration - GOAL_SOUND.releaseSeconds);

  it('lasts at most two seconds', () => {
    expect(duration).toBeGreaterThanOrEqual(1.2);
    expect(duration).toBeLessThanOrEqual(2);
    expect(goal.length).toBe(Math.round(duration * RATE));
    expect(synthesizeGoal(48_000).length).toBe(Math.round(duration * 48_000));
  });

  it('swells up, holds, then dies away', () => {
    const start = rms(slice(goal, 0, 0.08));
    const loud = rms(sustain);
    const end = rms(slice(goal, duration - 0.15, duration));
    expect(start).toBeLessThan(loud * 0.5);
    expect(end).toBeLessThan(loud * 0.3);
    expect(end).toBeGreaterThan(0);
  });

  it('sounds like many voices, not a single steady tone', () => {
    expect(GOAL_SOUND.voices).toBeGreaterThanOrEqual(20);
    expect(periodicity(sustain)).toBeLessThan(0.6);
  });

  it('is shaped like an "ah" vowel: energy in the voice range, little hiss above it', () => {
    const [first] = GOAL_SOUND.formants;
    expect(first?.frequency).toBeGreaterThanOrEqual(600);
    expect(first?.frequency).toBeLessThanOrEqual(900);
    expect(rms(highPass(sustain, 5000))).toBeLessThan(rms(sustain) * 0.2);
  });

  it('is mid-pitched: above the kick, below the whistle', () => {
    expect(pitch(sustain)).toBeGreaterThan(SOFT_KICK.startFrequency * 2);
    expect(pitch(sustain)).toBeLessThan(REFEREE_WHISTLE.frequency / 2);
  });

  it('is normalized to the configured peak and never clips', () => {
    const peak = Math.max(...Array.from(goal, Math.abs));
    expect(peak).toBeCloseTo(GOAL_SOUND.peak, 5);
    expect(goal.every((s) => Number.isFinite(s))).toBe(true);
  });

  it('starts and ends at silence, so playback does not click', () => {
    expect(goal[0]).toBe(0);
    expect(Math.abs(goal[goal.length - 1] as number)).toBeLessThan(0.01);
  });

  it('is deterministic', () => {
    expect(synthesizeGoal(RATE)).toEqual(goal);
  });

  it('is played at a moderate volume, like the other sounds', () => {
    expect(GOAL_SOUND_VOLUME).toBeGreaterThan(0);
    expect(GOAL_SOUND_VOLUME).toBeLessThanOrEqual(Math.max(COLLISION_SOUND_VOLUME, FOUL_WHISTLE_VOLUME) * 1.5);
  });
});
