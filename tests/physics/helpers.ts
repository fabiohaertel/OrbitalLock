import type { Orb } from '../../src/physics/orb';

let nextId = 1000;

/** Builds an active, moving orb for tests. */
export function makeOrb(
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius = 10,
  overrides: Partial<Orb> = {},
): Orb {
  return {
    id: nextId++,
    position: { x, y },
    velocity: { x: vx, y: vy },
    radius,
    movement: 'moving',
    capture: 'active',
    ...overrides,
  };
}

export function speedOf(orb: Orb): number {
  return Math.hypot(orb.velocity.x, orb.velocity.y);
}
