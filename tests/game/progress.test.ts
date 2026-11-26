import { describe, expect, it } from 'vitest';
import {
  advanceClock,
  createProgress,
  recordCaptures,
  recordFailedAttempt,
  remainingAttempts,
  startLevel,
} from '../../src/game/progress';

describe('createProgress', () => {
  it('starts playing level 1 with zeroed counters', () => {
    expect(createProgress(6)).toEqual({
      status: 'playing',
      level: 1,
      totalOrbs: 6,
      capturedOrbs: 0,
      failedAttempts: 0,
      score: 0,
      elapsedSeconds: 0,
      totalSeconds: 0,
      levelBonus: undefined,
    });
  });

  it('can start at another level', () => {
    expect(createProgress(6, 4).level).toBe(4);
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

  it('does nothing once the game is over or the level is cleared', () => {
    const lost = recordFailedAttempt(createProgress(1), 0);
    expect(recordFailedAttempt(lost, 0)).toBe(lost);
    const cleared = recordCaptures(createProgress(1), 1, 3);
    expect(recordFailedAttempt(cleared, 3)).toBe(cleared);
  });
});

describe('recordCaptures', () => {
  it('adds captured orbs and 100 × level points per orb (D11)', () => {
    const progress = recordCaptures(createProgress(5), 2, 3);
    expect(progress.capturedOrbs).toBe(2);
    expect(progress.score).toBe(200);
    expect(progress.status).toBe('playing');
    expect(progress.levelBonus).toBeUndefined();

    expect(recordCaptures(createProgress(5, 3), 2, 3).score).toBe(600);
  });

  it('clears the level when every orb is captured and adds the level-clear bonus', () => {
    let progress = createProgress(3, 2);
    progress = recordFailedAttempt(progress, 3);
    progress = advanceClock(progress, 42.5);
    progress = recordCaptures(progress, 1, 3);
    progress = recordCaptures(progress, 2, 3);
    expect(progress.capturedOrbs).toBe(3);
    expect(progress.status).toBe('levelComplete');
    // Level 2: 500 × 2; 2 fouls left × 200; 17 whole seconds under 60 × 10.
    expect(progress.levelBonus).toEqual({ level: 1000, fouls: 400, time: 170, total: 1570 });
    expect(progress.score).toBe(3 * 200 + 1570);
  });

  it('ignores zero captures and captures after the level is over', () => {
    const start = createProgress(1);
    expect(recordCaptures(start, 0, 3)).toBe(start);
    const cleared = recordCaptures(start, 1, 3);
    expect(recordCaptures(cleared, 1, 3)).toBe(cleared);
    const lost = recordFailedAttempt(createProgress(2), 0);
    expect(recordCaptures(lost, 1, 0)).toBe(lost);
  });
});

describe('startLevel', () => {
  it("resets the level's counters and clock and keeps the score and total time (D10)", () => {
    let progress = advanceClock(createProgress(2), 30);
    progress = recordFailedAttempt(progress, 3);
    progress = recordCaptures(progress, 2, 3);
    expect(progress.status).toBe('levelComplete');

    const next = startLevel(progress, 2, 4);
    expect(next).toEqual({
      status: 'playing',
      level: 2,
      totalOrbs: 4,
      capturedOrbs: 0,
      failedAttempts: 0,
      score: progress.score,
      elapsedSeconds: 0,
      totalSeconds: 30,
      levelBonus: undefined,
    });
  });

  it('does nothing unless the level was cleared', () => {
    const playing = createProgress(2);
    expect(startLevel(playing, 2, 4)).toBe(playing);
    const lost = recordFailedAttempt(playing, 0);
    expect(startLevel(lost, 2, 4)).toBe(lost);
  });
});

describe('advanceClock', () => {
  it("runs the level's and the game's clocks while playing", () => {
    const progress = advanceClock(advanceClock(createProgress(1), 0.5), 0.25);
    expect(progress.elapsedSeconds).toBeCloseTo(0.75, 12);
    expect(progress.totalSeconds).toBeCloseTo(0.75, 12);
  });

  it('stops when the level is cleared or the game is lost', () => {
    const cleared = recordCaptures(createProgress(1), 1, 3);
    expect(advanceClock(cleared, 1)).toBe(cleared);
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
