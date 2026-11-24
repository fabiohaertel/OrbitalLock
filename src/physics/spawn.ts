import type { ArenaDimensions, GameplayConfig } from '../config/gameConfig';
import { distanceSquared, type Vec2 } from '../geometry/vector';
import type { Orb } from './orb';
import type { RandomSource } from './random';

/** Attempts per orb before giving up on finding a free spot. */
const MAX_PLACEMENT_ATTEMPTS = 1000;

export class OrbPlacementError extends Error {
  constructor(placed: number, requested: number) {
    super(`Could only place ${String(placed)} of ${String(requested)} orbs without overlap`);
    this.name = 'OrbPlacementError';
  }
}

/**
 * Creates `config.initialOrbCount` active, moving orbs at random, non-overlapping
 * positions fully inside the arena. Each orb moves at `config.orbSpeed` in a
 * random direction. Pass a seeded `random` for reproducible placement.
 */
export function createOrbs(
  config: Pick<GameplayConfig, 'initialOrbCount' | 'orbRadius' | 'orbSpeed'>,
  arena: ArenaDimensions,
  random: RandomSource = Math.random,
): Orb[] {
  const radius = config.orbRadius;
  const minGapSq = (2 * radius) ** 2;
  const orbs: Orb[] = [];

  for (let id = 0; id < config.initialOrbCount; id++) {
    const position = findFreePosition(orbs, radius, minGapSq, arena, random);
    if (position === undefined) {
      throw new OrbPlacementError(orbs.length, config.initialOrbCount);
    }
    const angle = random() * Math.PI * 2;
    orbs.push({
      id,
      position,
      velocity: { x: Math.cos(angle) * config.orbSpeed, y: Math.sin(angle) * config.orbSpeed },
      radius,
      movement: 'moving',
      capture: 'active',
    });
  }

  return orbs;
}

function findFreePosition(
  placed: readonly Orb[],
  radius: number,
  minGapSq: number,
  arena: ArenaDimensions,
  random: RandomSource,
): Vec2 | undefined {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const candidate = {
      x: radius + random() * (arena.width - 2 * radius),
      y: radius + random() * (arena.height - 2 * radius),
    };
    if (placed.every((orb) => distanceSquared(orb.position, candidate) >= minGapSq)) {
      return candidate;
    }
  }
  return undefined;
}
