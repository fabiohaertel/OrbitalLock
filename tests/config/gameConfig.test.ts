import { describe, expect, it } from 'vitest';
import {
  ARENA,
  DEFAULT_GAMEPLAY_CONFIG,
  InvalidGameplayConfigError,
  createGameplayConfig,
  validateGameplayConfig,
  type GameplayConfig,
} from '../../src/config/gameConfig';

describe('DEFAULT_GAMEPLAY_CONFIG', () => {
  it('uses a 15% maximum capture area (REQUIREMENTS §4)', () => {
    expect(DEFAULT_GAMEPLAY_CONFIG.maxCaptureAreaRatio).toBe(0.15);
  });

  it('is valid', () => {
    expect(validateGameplayConfig(DEFAULT_GAMEPLAY_CONFIG)).toEqual([]);
  });

  it('is immutable', () => {
    expect(Object.isFrozen(DEFAULT_GAMEPLAY_CONFIG)).toBe(true);
    expect(Object.isFrozen(ARENA)).toBe(true);
  });
});

describe('createGameplayConfig', () => {
  it('returns the defaults when no overrides are given', () => {
    expect(createGameplayConfig()).toEqual(DEFAULT_GAMEPLAY_CONFIG);
  });

  it('applies overrides for every configurable value (REQUIREMENTS §4)', () => {
    const overrides: GameplayConfig = {
      initialOrbCount: 8,
      orbRadius: 20,
      orbSpeed: 250,
      maxCaptureAreaRatio: 0.2,
      minDrawingLength: 10,
      maxFailedAttempts: 5,
    };
    expect(createGameplayConfig(overrides)).toEqual(overrides);
  });

  it('returns a frozen config and does not mutate the defaults', () => {
    const config = createGameplayConfig({ initialOrbCount: 2 });
    expect(Object.isFrozen(config)).toBe(true);
    expect(DEFAULT_GAMEPLAY_CONFIG.initialOrbCount).toBe(6);
  });

  it('accepts boundary values', () => {
    expect(() =>
      createGameplayConfig({
        initialOrbCount: 1,
        maxCaptureAreaRatio: 1,
        minDrawingLength: 0,
        maxFailedAttempts: 0,
      }),
    ).not.toThrow();
  });

  it('throws an InvalidGameplayConfigError listing every problem', () => {
    let caught: unknown;
    try {
      createGameplayConfig({ initialOrbCount: 0, orbSpeed: -1 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidGameplayConfigError);
    expect((caught as InvalidGameplayConfigError).problems).toHaveLength(2);
  });
});

describe('validateGameplayConfig', () => {
  const invalidCases: [string, Partial<GameplayConfig>][] = [
    ['zero orbs', { initialOrbCount: 0 }],
    ['fractional orb count', { initialOrbCount: 2.5 }],
    ['zero radius', { orbRadius: 0 }],
    ['NaN radius', { orbRadius: Number.NaN }],
    ['radius too large for the arena', { orbRadius: Math.min(ARENA.width, ARENA.height) / 2 }],
    ['zero speed', { orbSpeed: 0 }],
    ['infinite speed', { orbSpeed: Number.POSITIVE_INFINITY }],
    ['zero capture ratio', { maxCaptureAreaRatio: 0 }],
    ['capture ratio above 1', { maxCaptureAreaRatio: 1.01 }],
    ['negative minimum drawing length', { minDrawingLength: -1 }],
    ['negative failure limit', { maxFailedAttempts: -1 }],
    ['fractional failure limit', { maxFailedAttempts: 1.5 }],
  ];

  it.each(invalidCases)('rejects %s', (_label, overrides) => {
    const problems = validateGameplayConfig({ ...DEFAULT_GAMEPLAY_CONFIG, ...overrides });
    expect(problems).toHaveLength(1);
  });

  it('validates the radius against a custom arena', () => {
    const smallArena = { width: 40, height: 30 };
    expect(validateGameplayConfig(DEFAULT_GAMEPLAY_CONFIG, smallArena)).toEqual([]);
    expect(
      validateGameplayConfig({ ...DEFAULT_GAMEPLAY_CONFIG, orbRadius: 15 }, smallArena),
    ).toHaveLength(1);
  });
});
