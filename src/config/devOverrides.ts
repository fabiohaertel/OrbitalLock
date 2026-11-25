import type { GameplayConfig } from './gameConfig';

/** Settings that can be overridden from the URL in development builds. */
export interface DevOverrides {
  readonly config: Partial<GameplayConfig>;
  /** Seed for reproducible orb placement. */
  readonly seed: number | undefined;
}

const NUMERIC_PARAMS: Readonly<Record<string, keyof GameplayConfig>> = {
  orbs: 'initialOrbCount',
  radius: 'orbRadius',
  speed: 'orbSpeed',
  maxArea: 'maxCaptureAreaRatio',
  minLength: 'minDrawingLength',
  maxMisses: 'maxFailedAttempts',
};

/**
 * Reads development overrides from a URL query string, e.g.
 * `?orbs=1&speed=20&seed=7`. Used for manual balancing and browser tests;
 * values that are not finite numbers are ignored. The result is still
 * validated by `createGameplayConfig`.
 */
export function parseDevOverrides(search: string): DevOverrides {
  const params = new URLSearchParams(search);
  const config: Partial<Record<keyof GameplayConfig, number>> = {};

  for (const [param, key] of Object.entries(NUMERIC_PARAMS)) {
    const value = parseNumber(params.get(param));
    if (value !== undefined) config[key] = value;
  }

  return { config, seed: parseNumber(params.get('seed')) };
}

function parseNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
