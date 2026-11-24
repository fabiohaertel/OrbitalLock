import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import { OrbPlacementError, createOrbs } from '../../src/physics/spawn';
import { createSeededRandom } from '../../src/physics/random';
import { speedOf } from './helpers';

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    expect(createSeededRandom(1)()).not.toBe(createSeededRandom(2)());
  });

  it('stays within [0, 1)', () => {
    const random = createSeededRandom(7);
    for (let i = 0; i < 10_000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('createOrbs', () => {
  const config = DEFAULT_GAMEPLAY_CONFIG;

  it('creates the configured number of active, moving orbs with unique ids', () => {
    const orbs = createOrbs(config, ARENA, createSeededRandom(1));
    expect(orbs).toHaveLength(config.initialOrbCount);
    expect(new Set(orbs.map((orb) => orb.id)).size).toBe(orbs.length);
    for (const orb of orbs) {
      expect(orb.movement).toBe('moving');
      expect(orb.capture).toBe('active');
      expect(orb.radius).toBe(config.orbRadius);
    }
  });

  it('gives every orb the configured speed', () => {
    for (const orb of createOrbs(config, ARENA, createSeededRandom(2))) {
      expect(speedOf(orb)).toBeCloseTo(config.orbSpeed, 9);
    }
  });

  it('places orbs fully inside the arena and without overlap', () => {
    const orbs = createOrbs({ ...config, initialOrbCount: 40 }, ARENA, createSeededRandom(3));
    for (const orb of orbs) {
      expect(orb.position.x).toBeGreaterThanOrEqual(orb.radius);
      expect(orb.position.x).toBeLessThanOrEqual(ARENA.width - orb.radius);
      expect(orb.position.y).toBeGreaterThanOrEqual(orb.radius);
      expect(orb.position.y).toBeLessThanOrEqual(ARENA.height - orb.radius);
    }
    for (let i = 0; i < orbs.length; i++) {
      for (let j = i + 1; j < orbs.length; j++) {
        const a = orbs[i];
        const b = orbs[j];
        if (a === undefined || b === undefined) throw new Error('unreachable');
        const gap = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
        expect(gap).toBeGreaterThanOrEqual(a.radius + b.radius);
      }
    }
  });

  it('is reproducible with the same seed', () => {
    expect(createOrbs(config, ARENA, createSeededRandom(9))).toEqual(
      createOrbs(config, ARENA, createSeededRandom(9)),
    );
  });

  it('throws when the orbs cannot fit', () => {
    const tiny = { width: 50, height: 50 };
    expect(() =>
      createOrbs({ initialOrbCount: 10, orbRadius: 12, orbSpeed: 100 }, tiny, createSeededRandom(1)),
    ).toThrow(OrbPlacementError);
  });
});
