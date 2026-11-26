import { createGameplayConfig, type ArenaDimensions, ARENA, type GameplayConfig } from '../config/gameConfig';

/** The values a level sets; everything else comes from the base config (REQUIREMENTS D10). */
export interface LevelDefinition {
  /** Level number, starting at `FIRST_LEVEL`. */
  readonly level: number;
  readonly orbCount: number;
  /** Orb speed in arena units per second. */
  readonly orbSpeed: number;
  /** Maximum capture area per region, as a fraction of the arena area (D5). */
  readonly maxCaptureAreaRatio: number;
  /** Fouls allowed on this level; defeat when exceeded (D3). */
  readonly maxFailedAttempts: number;
}

export const FIRST_LEVEL = 1;

type LevelValues = Omit<LevelDefinition, 'level'>;

/** Levels 1–10 (REQUIREMENTS D10). Index 0 is level 1. */
export const LEVEL_TABLE: readonly LevelValues[] = Object.freeze([
  { orbCount: 3, orbSpeed: 220, maxCaptureAreaRatio: 0.15, maxFailedAttempts: 4 },
  { orbCount: 4, orbSpeed: 230, maxCaptureAreaRatio: 0.15, maxFailedAttempts: 4 },
  { orbCount: 5, orbSpeed: 240, maxCaptureAreaRatio: 0.14, maxFailedAttempts: 3 },
  { orbCount: 6, orbSpeed: 250, maxCaptureAreaRatio: 0.13, maxFailedAttempts: 3 },
  { orbCount: 7, orbSpeed: 250, maxCaptureAreaRatio: 0.12, maxFailedAttempts: 3 },
  { orbCount: 8, orbSpeed: 260, maxCaptureAreaRatio: 0.11, maxFailedAttempts: 3 },
  { orbCount: 9, orbSpeed: 270, maxCaptureAreaRatio: 0.1, maxFailedAttempts: 3 },
  { orbCount: 10, orbSpeed: 280, maxCaptureAreaRatio: 0.1, maxFailedAttempts: 2 },
  { orbCount: 11, orbSpeed: 290, maxCaptureAreaRatio: 0.09, maxFailedAttempts: 2 },
  { orbCount: 12, orbSpeed: 300, maxCaptureAreaRatio: 0.08, maxFailedAttempts: 2 },
]);

/** Hardest values any level reaches (REQUIREMENTS D10). */
export const LEVEL_LIMITS = Object.freeze({
  maxOrbCount: 16,
  maxOrbSpeed: 300,
  minCaptureAreaRatio: 0.08,
});

/**
 * Values for `level`: the table for levels 1–10; after that one more orb per
 * level up to `LEVEL_LIMITS.maxOrbCount`, with the other values of the last
 * table level. Throws a `RangeError` for anything but an integer ≥ 1.
 */
export function levelDefinition(level: number): LevelDefinition {
  if (!Number.isInteger(level) || level < FIRST_LEVEL) {
    throw new RangeError(`Level must be an integer >= ${String(FIRST_LEVEL)}, got ${String(level)}`);
  }
  const tableIndex = level - FIRST_LEVEL;
  const values = LEVEL_TABLE[tableIndex] ?? extrapolate(tableIndex);
  return Object.freeze({
    level,
    orbCount: Math.min(values.orbCount, LEVEL_LIMITS.maxOrbCount),
    orbSpeed: Math.min(values.orbSpeed, LEVEL_LIMITS.maxOrbSpeed),
    maxCaptureAreaRatio: Math.max(values.maxCaptureAreaRatio, LEVEL_LIMITS.minCaptureAreaRatio),
    maxFailedAttempts: values.maxFailedAttempts,
  });
}

function extrapolate(tableIndex: number): LevelValues {
  const lastIndex = LEVEL_TABLE.length - 1;
  const last = LEVEL_TABLE[lastIndex];
  if (last === undefined) throw new Error('LEVEL_TABLE is empty');
  return { ...last, orbCount: last.orbCount + (tableIndex - lastIndex) };
}

/**
 * Gameplay config for `level`: the base config with the level's orb count,
 * speed, maximum capture area and foul limit (REQUIREMENTS §4, D10). Validated
 * by `createGameplayConfig`.
 */
export function levelConfig(level: number, base: GameplayConfig, arena: ArenaDimensions = ARENA): GameplayConfig {
  const definition = levelDefinition(level);
  return createGameplayConfig(
    {
      ...base,
      initialOrbCount: definition.orbCount,
      orbSpeed: definition.orbSpeed,
      maxCaptureAreaRatio: definition.maxCaptureAreaRatio,
      maxFailedAttempts: definition.maxFailedAttempts,
    },
    arena,
  );
}
