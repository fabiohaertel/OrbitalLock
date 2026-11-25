import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import { FixedTimestep } from '../../src/physics/fixedTimestep';
import type { Orb } from '../../src/physics/orb';
import { createSeededRandom } from '../../src/physics/random';
import { stepPhysics, type PhysicsEnvironment } from '../../src/physics/simulation';
import { createOrbs } from '../../src/physics/spawn';
import { speedOf } from './helpers';

/**
 * Largest overlap allowed after collision resolution, as a fraction of the orb
 * radius. Pairs are resolved one after another, so in a crowd, pushing one
 * pair apart can briefly push an orb into a third. The overlap grows with
 * speed: with 30 crowded orbs over 20 s, the worst seen across 20 seeds was
 * about 9% of the radius at 160 units/s, 12% at 200, 14.5% at the default
 * 250 and 20% at 320. It lasts until the next step and is invisible on screen.
 */
const OVERLAP_TOLERANCE_RATIO = 0.2;

function simulate(orbs: readonly Orb[], environment: PhysicsEnvironment, seconds: number, fps = 60) {
  const timestep = new FixedTimestep();
  const frames = Math.round(seconds * fps);
  let worstOverlap = 0;
  let escaped = 0;

  for (let frame = 0; frame < frames; frame++) {
    timestep.advance(1 / fps, (dt) => {
      stepPhysics(orbs, environment, dt);
    });

    for (const orb of orbs) {
      const { x, y } = orb.position;
      const r = orb.radius;
      if (x < r - 1e-9 || x > ARENA.width - r + 1e-9 || y < r - 1e-9 || y > ARENA.height - r + 1e-9) {
        escaped++;
      }
    }
    for (let i = 0; i < orbs.length; i++) {
      for (let j = i + 1; j < orbs.length; j++) {
        const a = orbs[i] as Orb;
        const b = orbs[j] as Orb;
        const gap = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
        worstOverlap = Math.max(worstOverlap, a.radius + b.radius - gap);
      }
    }
  }
  return { worstOverlap, escaped };
}

describe('physics simulation (integration)', () => {
  it('keeps many orbs inside the arena without significant overlap', () => {
    const orbs = createOrbs(
      { ...DEFAULT_GAMEPLAY_CONFIG, initialOrbCount: 30 },
      ARENA,
      createSeededRandom(2026),
    );
    const { worstOverlap, escaped } = simulate(orbs, { arena: ARENA, walls: [] }, 20);
    expect(escaped).toBe(0);
    expect(worstOverlap).toBeLessThan(DEFAULT_GAMEPLAY_CONFIG.orbRadius * OVERLAP_TOLERANCE_RATIO);
    for (const orb of orbs) {
      expect(speedOf(orb)).toBeCloseTo(DEFAULT_GAMEPLAY_CONFIG.orbSpeed, 6);
    }
  });

  it('keeps orbs on their side of a wall that splits the arena', () => {
    const divider = { a: { x: 500, y: 0 }, b: { x: 500, y: ARENA.height } };
    const environment: PhysicsEnvironment = { arena: ARENA, walls: [divider] };
    const orbs = createOrbs(
      { ...DEFAULT_GAMEPLAY_CONFIG, initialOrbCount: 12 },
      ARENA,
      createSeededRandom(7),
    ).filter((orb) => Math.abs(orb.position.x - 500) > orb.radius);
    const sides = orbs.map((orb) => Math.sign(orb.position.x - 500));

    simulate(orbs, environment, 20);

    orbs.forEach((orb, index) => {
      expect(Math.sign(orb.position.x - 500)).toBe(sides[index]);
    });
  });

  it('is deterministic: same seed, same frames, same result', () => {
    const run = () => {
      const orbs = createOrbs(DEFAULT_GAMEPLAY_CONFIG, ARENA, createSeededRandom(5));
      simulate(orbs, { arena: ARENA, walls: [] }, 5);
      return orbs.map((orb) => orb.position);
    };
    expect(run()).toEqual(run());
  });

  it('gives identical results at different frame rates', () => {
    const run = (fps: number) => {
      const orbs = createOrbs(DEFAULT_GAMEPLAY_CONFIG, ARENA, createSeededRandom(11));
      simulate(orbs, { arena: ARENA, walls: [] }, 3, fps);
      return orbs.map((orb) => orb.position);
    };
    const at30 = run(30);
    const at120 = run(120);
    at30.forEach((position, index) => {
      expect(position.x).toBeCloseTo((at120[index] as { x: number }).x, 6);
      expect(position.y).toBeCloseTo((at120[index] as { y: number }).y, 6);
    });
  });
});
