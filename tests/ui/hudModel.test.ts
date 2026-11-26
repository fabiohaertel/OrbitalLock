import { describe, expect, it } from 'vitest';
import {
  createProgress,
  recordCaptures,
  recordFailedAttempt,
  advanceClock,
} from '../../src/game/progress';
import { MAX_FOUL_PIPS, buildEndScreenModel, buildHudModel, formatElapsed } from '../../src/ui/hudModel';

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
  it('shows the initial state as label/value cards with plain-text equivalents', () => {
    const hud = buildHudModel(createProgress(8), { maxFailedAttempts: 3 });
    expect(hud.level).toEqual({ label: 'LEVEL', value: '1', text: 'Level: 1' });
    expect(hud.captured).toEqual({ label: 'CAPTURED', value: '0/8', text: 'Captured: 0 / 8' });
    expect(hud.remaining).toEqual({ label: 'REMAINING', value: '8', text: 'Remaining: 8' });
    expect(hud.time).toEqual({ label: 'TIME', value: '00:00', text: 'Time: 00:00' });
    expect(hud.score).toEqual({ label: 'SCORE', value: '0', text: 'Score: 0' });
    expect(hud.fouls).toEqual({
      label: 'FOULS',
      value: '0/3',
      text: 'Fouls: 0 / 3',
      used: 0,
      max: 3,
      showPips: true,
      danger: false,
    });
  });

  it('matches the requirements example (§5.3)', () => {
    let progress = recordCaptures(createProgress(5, 3), 3, 3);
    progress = advanceClock(progress, 42.3);
    progress = { ...progress, score: 4650 };
    const hud = buildHudModel(progress, { maxFailedAttempts: 3 });
    expect(hud.level.value).toBe('3');
    expect(hud.captured.value).toBe('3/5');
    expect(hud.remaining.value).toBe('2');
    expect(hud.time.value).toBe('00:42');
    expect(hud.score.value).toBe('4650');
    expect(hud.captured.text).toBe('Captured: 3 / 5');
    expect(hud.time.text).toBe('Time: 00:42');
  });

  it('counts failed attempts against the limit', () => {
    const progress = recordFailedAttempt(recordFailedAttempt(createProgress(2), 3), 3);
    const fouls = buildHudModel(progress, { maxFailedAttempts: 3 }).fouls;
    expect(fouls.text).toBe('Fouls: 2 / 3');
    expect(fouls.used).toBe(2);
    expect(fouls.danger).toBe(false);
  });

  it('warns (danger) when the next foul loses the game', () => {
    let progress = createProgress(2);
    for (let i = 0; i < 3; i++) progress = recordFailedAttempt(progress, 3);
    expect(progress.status).toBe('playing');
    expect(buildHudModel(progress, { maxFailedAttempts: 3 }).fouls.danger).toBe(true);
  });

  it('is in danger from the start when no foul is allowed', () => {
    expect(buildHudModel(createProgress(2), { maxFailedAttempts: 0 }).fouls.danger).toBe(true);
  });

  it('stops warning once the game is over', () => {
    const lost = recordFailedAttempt(createProgress(2), 0);
    expect(lost.status).toBe('defeat');
    expect(buildHudModel(lost, { maxFailedAttempts: 0 }).fouls.danger).toBe(false);
  });

  it('draws one pip per allowed foul, and falls back to text for large or zero limits', () => {
    const progress = createProgress(2);
    expect(buildHudModel(progress, { maxFailedAttempts: MAX_FOUL_PIPS }).fouls.showPips).toBe(true);
    expect(buildHudModel(progress, { maxFailedAttempts: MAX_FOUL_PIPS + 1 }).fouls.showPips).toBe(false);
    expect(buildHudModel(progress, { maxFailedAttempts: 0 }).fouls.showPips).toBe(false);
  });
});

describe('buildEndScreenModel', () => {
  it('is undefined while playing', () => {
    expect(buildEndScreenModel(createProgress(2))).toBeUndefined();
  });

  it('shows the level-clear bonus parts and a "NEXT LEVEL" button (§5.6, D11)', () => {
    let progress = advanceClock(createProgress(2, 3), 42.5);
    progress = recordFailedAttempt(progress, 3);
    progress = recordCaptures(progress, 2, 3);
    const model = buildEndScreenModel(progress);
    expect(model?.result).toBe('levelComplete');
    expect(model?.title).toBe('LEVEL 3 CLEAR');
    // 1500 + 2 × 200 + 17 × 10 = 2070; score 2 × 300 + 2070.
    expect(model?.subtitle).toBe('Bonus +2070 · Score 2670');
    expect(model?.stats.map((stat) => [stat.label, stat.value])).toEqual([
      ['LEVEL', '+1500'],
      ['FOULS', '+400'],
      ['TIME', '+170'],
    ]);
    expect(model?.button).toEqual({ label: 'NEXT LEVEL', action: 'nextLevel' });
  });

  it('shows a defeat with the score, level reached and total time, and "PLAY AGAIN"', () => {
    const lost = recordFailedAttempt(recordCaptures({ ...advanceClock(createProgress(4, 2), 75), totalSeconds: 135 }, 1, 0), 0);
    const model = buildEndScreenModel(lost);
    expect(model?.result).toBe('defeat');
    expect(model?.title).toBe('DEFEAT');
    expect(model?.subtitle).toBe('Too many fouls.');
    expect(model?.stats.map((stat) => [stat.label, stat.value])).toEqual([
      ['SCORE', '200'],
      ['LEVEL', '2'],
      ['TIME', '02:15'],
    ]);
    expect(model?.button).toEqual({ label: 'PLAY AGAIN', action: 'restart' });
  });
});
