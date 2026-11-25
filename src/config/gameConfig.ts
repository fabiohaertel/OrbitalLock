/**
 * Gameplay configuration (REQUIREMENTS §4).
 *
 * All spatial values are expressed in logical arena units. The game state
 * lives in a fixed logical coordinate space of `ARENA.width` × `ARENA.height`
 * units; rendering scales it to screen pixels (see REQUIREMENTS §11.1, D6).
 */

export interface ArenaDimensions {
  readonly width: number;
  readonly height: number;
}

/** Logical arena size in world units (16:10). Independent of screen size. */
export const ARENA: ArenaDimensions = Object.freeze({ width: 1000, height: 625 });

export interface GameplayConfig {
  /** Number of orbs placed in the arena when a game starts. Integer ≥ 1. */
  readonly initialOrbCount: number;
  /** Orb radius in arena units. */
  readonly orbRadius: number;
  /** Orb movement speed in arena units per second. */
  readonly orbSpeed: number;
  /**
   * Maximum area of a single enclosed region eligible for capture, as a
   * fraction of the total arena area, in (0, 1]. Applied per region (D5).
   */
  readonly maxCaptureAreaRatio: number;
  /** Minimum length of a drawing path in arena units. */
  readonly minDrawingLength: number;
  /**
   * Number of failed drawing attempts allowed. Defeat is triggered when the
   * number of failed attempts exceeds this value. Integer ≥ 0.
   */
  readonly maxFailedAttempts: number;
}

/**
 * Initial balancing defaults. Only `maxCaptureAreaRatio` (15%) is fixed by the
 * requirements; the other values are provisional prototype values.
 */
export const DEFAULT_GAMEPLAY_CONFIG: GameplayConfig = Object.freeze({
  initialOrbCount: 7,
  orbRadius: 12,
  orbSpeed: 250,
  maxCaptureAreaRatio: 0.15,
  minDrawingLength: 40,
  maxFailedAttempts: 3,
});

export class InvalidGameplayConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid gameplay config: ${problems.join('; ')}`);
    this.name = 'InvalidGameplayConfigError';
    this.problems = problems;
  }
}

/** Returns a list of human-readable problems; empty when the config is valid. */
export function validateGameplayConfig(
  config: GameplayConfig,
  arena: ArenaDimensions = ARENA,
): string[] {
  const problems: string[] = [];

  if (!Number.isInteger(config.initialOrbCount) || config.initialOrbCount < 1) {
    problems.push('initialOrbCount must be an integer >= 1');
  }

  if (!isPositiveFinite(config.orbRadius)) {
    problems.push('orbRadius must be a finite number > 0');
  } else if (config.orbRadius * 2 >= Math.min(arena.width, arena.height)) {
    problems.push('orbRadius must be smaller than half of the smallest arena dimension');
  }

  if (!isPositiveFinite(config.orbSpeed)) {
    problems.push('orbSpeed must be a finite number > 0');
  }

  if (!isPositiveFinite(config.maxCaptureAreaRatio) || config.maxCaptureAreaRatio > 1) {
    problems.push('maxCaptureAreaRatio must be a number in (0, 1]');
  }

  if (!Number.isFinite(config.minDrawingLength) || config.minDrawingLength < 0) {
    problems.push('minDrawingLength must be a finite number >= 0');
  }

  if (!Number.isInteger(config.maxFailedAttempts) || config.maxFailedAttempts < 0) {
    problems.push('maxFailedAttempts must be an integer >= 0');
  }

  return problems;
}

/**
 * Builds a validated, immutable gameplay config from the defaults plus the
 * given overrides. Throws `InvalidGameplayConfigError` if the result is invalid.
 */
export function createGameplayConfig(
  overrides: Partial<GameplayConfig> = {},
  arena: ArenaDimensions = ARENA,
): GameplayConfig {
  const config: GameplayConfig = { ...DEFAULT_GAMEPLAY_CONFIG, ...overrides };
  const problems = validateGameplayConfig(config, arena);
  if (problems.length > 0) {
    throw new InvalidGameplayConfigError(problems);
  }
  return Object.freeze(config);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
