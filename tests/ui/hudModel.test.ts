import { describe, expect, it } from 'vitest';
import {
  createProgress,
  recordCaptures,
  recordFailedAttempt,
  advanceClock,
} from '../../src/game/progress';
import { buildGameOverModel, buildHudModel, formatElapsed } from '../../src/ui/hudModel';

describe('formatElapsed', () => {
  it.each([
    [0, '00:00'],
    [0.99, '00:00'],
    [42, '00:42'],
    [61.5, '01:01'],
    [3599, '59:59'],
    [3600, '60:00'],
    [-5, '00:00'],
  ])('formats %s s as %s', (seconds, expected) => {
    expect(formatElapsed(seconds)).toBe(expected);
  });
});

describe('buildHudModel', () => {
  it('shows the initial state', () => {
    expect(buildHudModel(createProgress(8), { maxFailedAttempts: 3 })).toEqual({
      captured: 'Captured: 0 / 8',
      remaining: 'Remaining: 8',
      time: 'Time: 00:00',
      score: 'Score: 0',
      misses: 'Misses: 0 / 3',
    });
  });

  it('matches the requirements example (§5.3)', () => {
    let progress = recordCaptures(createProgress(8), 3);
    progress = advanceClock(progress, 42.3);
    progress = { ...progress, score: 450 };
    const hud = buildHudModel(progress, { maxFailedAttempts: 3 });
    expect(hud.captured).toBe('Captured: 3 / 8');
    expect(hud.remaining).toBe('Remaining: 5');
    expect(hud.time).toBe('Time: 00:42');
    expect(hud.score).toBe('Score: 450');
  });

  it('counts failed attempts against the limit', () => {
    const progress = recordFailedAttempt(recordFailedAttempt(createProgress(2), 3), 3);
    expect(buildHudModel(progress, { maxFailedAttempts: 3 }).misses).toBe('Misses: 2 / 3');
  });
});

describe('buildGameOverModel', () => {
  it('is undefined while playing', () => {
    expect(buildGameOverModel(createProgress(2))).toBeUndefined();
  });

  it('describes a victory with score and time', () => {
    const won = recordCaptures(advanceClock(createProgress(2), 75), 2);
    expect(buildGameOverModel(won)).toEqual({
      title: 'VICTORY',
      detail: 'All orbs captured!\nScore: 200   Time: 01:15',
    });
  });

  it('describes a defeat with what was captured', () => {
    const lost = recordFailedAttempt(recordCaptures(createProgress(4), 1), 0);
    const model = buildGameOverModel(lost);
    expect(model?.title).toBe('DEFEAT');
    expect(model?.detail).toContain('Captured 1 of 4');
    expect(model?.detail).toContain('Score: 100');
  });
});
