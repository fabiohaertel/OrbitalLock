import { describe, expect, it } from 'vitest';
import { parseDevOverrides } from '../../src/config/devOverrides';
import { createGameplayConfig } from '../../src/config/gameConfig';

describe('parseDevOverrides', () => {
  it('returns no overrides for an empty query', () => {
    expect(parseDevOverrides('')).toEqual({ config: {}, seed: undefined, level: undefined });
  });

  it('maps every supported parameter onto the gameplay config', () => {
    expect(
      parseDevOverrides('?orbs=2&radius=8&speed=30&maxArea=0.2&minLength=10&maxFouls=0&seed=7&level=4'),
    ).toEqual({
      config: {
        initialOrbCount: 2,
        orbRadius: 8,
        orbSpeed: 30,
        maxCaptureAreaRatio: 0.2,
        minDrawingLength: 10,
        maxFailedAttempts: 0,
      },
      seed: 7,
      level: 4,
    });
  });

  it('ignores a level that is not an integer >= 1', () => {
    for (const level of ['0', '-2', '1.5', 'two']) {
      expect(parseDevOverrides(`?level=${level}`).level).toBeUndefined();
    }
  });

  it('ignores unknown, empty and non-numeric values', () => {
    expect(parseDevOverrides('?orbs=lots&speed=&foo=3&radius=Infinity')).toEqual({
      config: {},
      seed: undefined,
      level: undefined,
    });
  });

  it('leaves validation to createGameplayConfig', () => {
    const { config } = parseDevOverrides('?orbs=0');
    expect(() => createGameplayConfig(config)).toThrow();
  });
});
