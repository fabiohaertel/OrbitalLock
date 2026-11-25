import { describe, expect, it } from 'vitest';
import {
  POINTS_PER_CAPTURED_ORB,
  advanceClock,
  createProgress,
  recordCaptures,
  recordFailedAttempt,
  remainingAttempts,
} from '../../src/game/progress';

describe('createProgress', () => {
  it('starts playing with zeroed counters', () => {
    expect(createProgress(6)).toEqual({
      status: 'playing',
      totalOrbs: 6,
      capturedOrbs: 0,
      failedAttempts: 0,
      score: 0,
      elapsedSeconds: 0,
    });
  });
});

describe('recordFailedAttempt', () => {
  it('counts failures and triggers defeat only when the limit is exceeded', () => {
    let progress = createProgress(3);
    for (let i = 1; i <= 3; i++) {
      progress = recordFailedAttempt(progress, 3);
      expect(progress.failedAttempts).toBe(i);
      expect(progress.status).toBe('playing');
    }
    progress = recordFailedAttempt(progress, 3);
    expect(progress.failedAttempts).toBe(4);
    expect(progress.status).toBe('defeat');
  });

  it('with a limit of 0, the first failure is a defeat', () => {
    expect(recordFailedAttempt(createProgress(1), 0).status).toBe('defeat');
  });

  it('does nothing once the game is over', () => {
    const lost = recordFailedAttempt(createProgress(1), 0);
    expect(recordFailedAttempt(lost, 0)).toBe(lost);
  });
});

describe('recordCaptures', () => {
  it('adds captured orbs and 100 points per orb', () => {
    const progress = recordCaptures(createProgress(5), 2);
    expect(progress.capturedOrbs).toBe(2);
    expect(progress.score).toBe(2 * POINTS_PER_CAPTURED_ORB);
    expect(POINTS_PER_CAPTURED_ORB).toBe(100);
    expect(progress.status).toBe('playing');
  });

  it('triggers victory when every orb is captured', () => {
    let progress = recordCaptures(createProgress(3), 1);
    progress = recordCaptures(progress, 2);
    expect(progress.capturedOrbs).toBe(3);
    expect(progress.status).toBe('victory');
  });

  it('ignores zero captures and captures after the game is over', () => {
    const start = createProgress(1);
    expect(recordCaptures(start, 0)).toBe(start);
    const won = recordCaptures(start, 1);
    expect(recordCaptures(won, 1)).toBe(won);
  });
});

describe('advanceClock', () => {
  it('runs while playing', () => {
    expect(advanceClock(advanceClock(createProgress(1), 0.5), 0.25).elapsedSeconds).toBeCloseTo(0.75, 12);
  });

  it('stops on victory or defeat', () => {
    const won = recordCaptures(createProgress(1), 1);
    expect(advanceClock(won, 1)).toBe(won);
    const lost = recordFailedAttempt(createProgress(1), 0);
    expect(advanceClock(lost, 1)).toBe(lost);
  });

  it('ignores non-positive time', () => {
    const start = createProgress(1);
    expect(advanceClock(start, 0)).toBe(start);
    expect(advanceClock(start, -1)).toBe(start);
  });
});

describe('remainingAttempts', () => {
  it('counts down and never goes below zero', () => {
    let progress = createProgress(1);
    expect(remainingAttempts(progress, 2)).toBe(2);
    progress = recordFailedAttempt(progress, 2);
    expect(remainingAttempts(progress, 2)).toBe(1);
    progress = recordFailedAttempt(recordFailedAttempt(progress, 2), 2);
    expect(remainingAttempts(progress, 2)).toBe(0);
  });
});
