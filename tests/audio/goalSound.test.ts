import { describe, expect, it } from 'vitest';
import { GOAL_SOUND, GOAL_SOUND_VOLUME, goalSoundDuration, synthesizeGoal } from '../../src/audio/goalSound';
import { COLLISION_SOUND_VOLUME, SOFT_KICK } from '../../src/audio/kickSound';
import { MISS_WHISTLE_VOLUME, REFEREE_WHISTLE } from '../../src/audio/whistleSound';

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

/** Start time of each note of the arpeggio, in seconds. */
function noteStarts(): number[] {
  return GOAL_SOUND.notes.map((_, index) => GOAL_SOUND.swishSeconds + index * GOAL_SOUND.noteSeconds);
}

describe('synthesizeGoal (REQUIREMENTS §5.5)', () => {
  const goal = synthesizeGoal(RATE);

  it('is about half a second long', () => {
    expect(goalSoundDuration()).toBeGreaterThanOrEqual(0.4);
    expect(goalSoundDuration()).toBeLessThanOrEqual(0.7);
    expect(goal.length).toBe(Math.round(goalSoundDuration() * RATE));
    expect(synthesizeGoal(48_000).length).toBe(Math.round(goalSoundDuration() * 48_000));
  });

  it('opens with a noisy swish, brighter than the notes that follow', () => {
    const swish = slice(goal, 0.01, GOAL_SOUND.swishSeconds * 0.6);
    const notes = slice(goal, GOAL_SOUND.swishSeconds, goal.length / RATE);
    expect(rms(swish)).toBeGreaterThan(0.02);
    // Noise crosses zero far more often than the arpeggio's tones.
    expect(pitch(swish)).toBeGreaterThan(2 * pitch(notes));
  });

  it('plays a rising C-major arpeggio (C, E, G)', () => {
    const [c, e, g] = GOAL_SOUND.notes;
    expect(GOAL_SOUND.notes).toHaveLength(3);
    expect((e ?? 0) / (c ?? 1)).toBeCloseTo(2 ** (4 / 12), 3); // major third
    expect((g ?? 0) / (c ?? 1)).toBeCloseTo(2 ** (7 / 12), 3); // perfect fifth

    const starts = noteStarts();
    const measured = GOAL_SOUND.notes.map((_, index) => {
      const start = (starts[index] ?? 0) + 0.01;
      return pitch(slice(goal, start, start + GOAL_SOUND.noteSeconds - 0.025));
    });
    measured.forEach((value, index) => {
      expect(value).toBeCloseTo(GOAL_SOUND.notes[index] ?? 0, -1); // within ~5 Hz
    });
    expect(measured[1]).toBeGreaterThan(measured[0] ?? Infinity);
    expect(measured[2]).toBeGreaterThan(measured[1] ?? Infinity);
  });

  it('lets the last note ring out and fade', () => {
    const lastStart = noteStarts().at(-1) ?? 0;
    const early = rms(slice(goal, lastStart + 0.01, lastStart + 0.06));
    const late = rms(slice(goal, goal.length / RATE - 0.06, goal.length / RATE - 0.01));
    expect(late).toBeLessThan(early * 0.3);
    expect(late).toBeGreaterThan(0);
  });

  it('is mid-pitched: above the kick, below the whistle', () => {
    const notes = slice(goal, GOAL_SOUND.swishSeconds, goal.length / RATE);
    expect(pitch(notes)).toBeGreaterThan(SOFT_KICK.startFrequency * 2);
    expect(pitch(notes)).toBeLessThan(REFEREE_WHISTLE.frequency / 2);
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
    expect(GOAL_SOUND_VOLUME).toBeLessThanOrEqual(Math.max(COLLISION_SOUND_VOLUME, MISS_WHISTLE_VOLUME) * 1.5);
  });
});
