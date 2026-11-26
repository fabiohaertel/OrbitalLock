import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG, createGameplayConfig } from '../../src/config/gameConfig';
import { FIRST_LEVEL, LEVEL_LIMITS, LEVEL_TABLE, levelConfig, levelDefinition } from '../../src/game/levels';
import { createSeededRandom } from '../../src/physics/random';
import { createOrbs } from '../../src/physics/spawn';

describe('levelDefinition', () => {
  it('follows the D10 table for levels 1–10', () => {
    const rows = [
      [3, 220, 0.15, 4],
      [4, 230, 0.15, 4],
      [5, 240, 0.14, 3],
      [6, 250, 0.13, 3],
      [7, 250, 0.12, 3],
      [8, 260, 0.11, 3],
      [9, 270, 0.1, 3],
      [10, 280, 0.1, 2],
      [11, 290, 0.09, 2],
      [12, 300, 0.08, 2],
    ];
    expect(LEVEL_TABLE).toHaveLength(rows.length);
    rows.forEach(([orbCount, orbSpeed, maxCaptureAreaRatio, maxFailedAttempts], i) => {
      expect(levelDefinition(i + 1)).toEqual({ level: i + 1, orbCount, orbSpeed, maxCaptureAreaRatio, maxFailedAttempts });
    });
  });

  it('starts at level 1', () => {
    expect(FIRST_LEVEL).toBe(1);
  });

  it('adds one orb per level after level 10 and keeps the other values', () => {
    expect(levelDefinition(11)).toEqual({ level: 11, orbCount: 13, orbSpeed: 300, maxCaptureAreaRatio: 0.08, maxFailedAttempts: 2 });
    expect(levelDefinition(14).orbCount).toBe(16);
  });

  it('never goes past the limits, even at very high levels', () => {
    for (const level of [15, 16, 17, 50, 1000, 1_000_000]) {
      const definition = levelDefinition(level);
      expect(definition.orbCount).toBe(LEVEL_LIMITS.maxOrbCount);
      expect(definition.orbSpeed).toBe(LEVEL_LIMITS.maxOrbSpeed);
      expect(definition.maxCaptureAreaRatio).toBe(LEVEL_LIMITS.minCaptureAreaRatio);
      expect(definition.maxFailedAttempts).toBe(2);
    }
  });

  it('never gets easier from one level to the next', () => {
    for (let level = 1; level < 30; level++) {
      const current = levelDefinition(level);
      const next = levelDefinition(level + 1);
      expect(next.orbCount).toBeGreaterThanOrEqual(current.orbCount);
      expect(next.orbSpeed).toBeGreaterThanOrEqual(current.orbSpeed);
      expect(next.maxCaptureAreaRatio).toBeLessThanOrEqual(current.maxCaptureAreaRatio);
      expect(next.maxFailedAttempts).toBeLessThanOrEqual(current.maxFailedAttempts);
    }
  });

  it('rejects anything but an integer >= 1', () => {
    for (const level of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => levelDefinition(level)).toThrow(RangeError);
    }
  });

  it('is deterministic and immutable', () => {
    expect(levelDefinition(7)).toEqual(levelDefinition(7));
    expect(Object.isFrozen(levelDefinition(7))).toBe(true);
  });
});

describe('levelConfig', () => {
  it("sets the level's four values and keeps the rest of the base config", () => {
    const base = createGameplayConfig({ orbRadius: 10, minDrawingLength: 30 });
    expect(levelConfig(3, base)).toEqual({
      initialOrbCount: 5,
      orbRadius: 10,
      orbSpeed: 240,
      maxCaptureAreaRatio: 0.14,
      minDrawingLength: 30,
      maxFailedAttempts: 3,
    });
  });

  it('gives a valid, frozen config for every level up to well past the limits', () => {
    for (let level = 1; level <= 40; level++) {
      const config = levelConfig(level, DEFAULT_GAMEPLAY_CONFIG);
      expect(Object.isFrozen(config)).toBe(true);
      expect(config.orbRadius).toBe(DEFAULT_GAMEPLAY_CONFIG.orbRadius);
    }
  });

  it('rejects invalid levels', () => {
    expect(() => levelConfig(0, DEFAULT_GAMEPLAY_CONFIG)).toThrow(RangeError);
  });
});

describe('spawning the hardest level', () => {
  it('always places the maximum number of orbs without overlap', () => {
    const config = levelConfig(100, DEFAULT_GAMEPLAY_CONFIG);
    expect(config.initialOrbCount).toBe(LEVEL_LIMITS.maxOrbCount);
    for (let seed = 1; seed <= 200; seed++) {
      expect(createOrbs(config, ARENA, createSeededRandom(seed))).toHaveLength(LEVEL_LIMITS.maxOrbCount);
    }
  });
});
