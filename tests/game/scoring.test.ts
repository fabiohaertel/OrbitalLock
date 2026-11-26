import { describe, expect, it } from 'vitest';
import { captureScore, levelClearBonus } from '../../src/game/scoring';

describe('captureScore', () => {
  it('awards 100 × level per orb (D11)', () => {
    expect(captureScore(1, 1)).toBe(100);
    expect(captureScore(2, 1)).toBe(200);
    expect(captureScore(3, 4)).toBe(1200);
  });

  it('awards nothing for zero or negative counts', () => {
    expect(captureScore(0, 5)).toBe(0);
    expect(captureScore(-2, 5)).toBe(0);
  });
});

describe('levelClearBonus', () => {
  it('adds the level, unused-foul and time parts (D11)', () => {
    expect(levelClearBonus({ level: 3, foulsLeft: 2, levelSeconds: 42 })).toEqual({
      level: 1500,
      fouls: 400,
      time: 180,
      total: 2080,
    });
  });

  it('counts only whole seconds under 60 s', () => {
    expect(levelClearBonus({ level: 1, foulsLeft: 0, levelSeconds: 42.9 }).time).toBe(170);
    expect(levelClearBonus({ level: 1, foulsLeft: 0, levelSeconds: 59.5 }).time).toBe(0);
    expect(levelClearBonus({ level: 1, foulsLeft: 0, levelSeconds: 0 }).time).toBe(600);
  });

  it('gives no time bonus at or after 60 s', () => {
    expect(levelClearBonus({ level: 1, foulsLeft: 0, levelSeconds: 60 }).time).toBe(0);
    expect(levelClearBonus({ level: 1, foulsLeft: 0, levelSeconds: 600 }).time).toBe(0);
  });

  it('gives no foul bonus when no foul is left', () => {
    expect(levelClearBonus({ level: 2, foulsLeft: 0, levelSeconds: 90 })).toEqual({
      level: 1000,
      fouls: 0,
      time: 0,
      total: 1000,
    });
  });

  it('never has a negative part, and the time part never exceeds 60 s worth', () => {
    const bonus = levelClearBonus({ level: 1, foulsLeft: -3, levelSeconds: -10 });
    expect(bonus.fouls).toBe(0);
    expect(bonus.time).toBe(600);
    expect(levelClearBonus({ level: 1, foulsLeft: 0, levelSeconds: Number.NaN }).time).toBe(0);
  });
});
