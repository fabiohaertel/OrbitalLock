import type { GameplayConfig } from './gameConfig';

/** Settings that can be overridden from the URL in development builds. */
export interface DevOverrides {
  readonly config: Partial<GameplayConfig>;
  /** Seed for reproducible orb placement. */
  readonly seed: number | undefined;
  /** Level a new game starts at (`?level=N`); undefined for level 1. */
  readonly level: number | undefined;
}

const NUMERIC_PARAMS: Readonly<Record<string, keyof GameplayConfig>> = {
  orbs: 'initialOrbCount',
  radius: 'orbRadius',
  speed: 'orbSpeed',
  maxArea: 'maxCaptureAreaRatio',
  minLength: 'minDrawingLength',
  maxFouls: 'maxFailedAttempts',
};

/**
 * Reads development overrides from a URL query string, e.g.
 * `?orbs=1&speed=20&seed=7&level=3`. Used for manual balancing and browser
 * tests; values that are not finite numbers are ignored. The config values
 * replace the level's values on every level, and are still validated by
 * `createGameplayConfig`. A level that is not an integer >= 1 is ignored.
 */
export function parseDevOverrides(search: string): DevOverrides {
  const params = new URLSearchParams(search);
  const config: Partial<Record<keyof GameplayConfig, number>> = {};

  for (const [param, key] of Object.entries(NUMERIC_PARAMS)) {
    const value = parseNumber(params.get(param));
    if (value !== undefined) config[key] = value;
  }

  const level = parseNumber(params.get('level'));
  return {
    config,
    seed: parseNumber(params.get('seed')),
    level: level !== undefined && Number.isInteger(level) && level >= 1 ? level : undefined,
  };
}

function parseNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
