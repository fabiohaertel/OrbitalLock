import { describe, expect, it } from 'vitest';
import type { Segment } from '../../src/geometry/segment';
import { isPhysicallyActive } from '../../src/physics/orb';
import {
  resolveArenaBounds,
  resolveOrbCollisions,
  resolveWallCollision,
  stepPhysics,
  type PhysicsEnvironment,
} from '../../src/physics/simulation';
import { makeOrb, speedOf } from './helpers';

const arena = { width: 200, height: 100 };
const open: PhysicsEnvironment = { arena, walls: [] };

function wall(ax: number, ay: number, bx: number, by: number): Segment {
  return { a: { x: ax, y: ay }, b: { x: bx, y: by } };
}

describe('movement', () => {
  it('moves active orbs in a straight line using delta time', () => {
    const orb = makeOrb(50, 50, 30, -20);
    stepPhysics([orb], open, 0.5);
    expect(orb.position.x).toBeCloseTo(65, 9);
    expect(orb.position.y).toBeCloseTo(40, 9);
    expect(orb.velocity).toEqual({ x: 30, y: -20 });
  });

  it('does nothing for zero or negative steps', () => {
    const orb = makeOrb(50, 50, 30, 0);
    stepPhysics([orb], open, 0);
    stepPhysics([orb], open, -1);
    expect(orb.position).toEqual({ x: 50, y: 50 });
  });

  it('gives the same result for one large step as for many small ones', () => {
    const big = makeOrb(30, 30, 47, 23);
    const small = makeOrb(30, 30, 47, 23);
    stepPhysics([big], open, 0.4);
    for (let i = 0; i < 40; i++) {
      stepPhysics([small], open, 0.01);
    }
    expect(big.position.x).toBeCloseTo(small.position.x, 6);
    expect(big.position.y).toBeCloseTo(small.position.y, 6);
  });
});

describe('arena boundaries', () => {
  it.each([
    ['left', makeOrb(5, 50, -10, 0), { x: 10, y: 50 }, { x: 10, y: 0 }],
    ['right', makeOrb(195, 50, 10, 0), { x: 190, y: 50 }, { x: -10, y: 0 }],
    ['top', makeOrb(100, 3, 0, -10), { x: 100, y: 10 }, { x: 0, y: 10 }],
    ['bottom', makeOrb(100, 98, 0, 10), { x: 100, y: 90 }, { x: 0, y: -10 }],
  ])('bounces off the %s edge', (_edge, orb, position, velocity) => {
    resolveArenaBounds(orb, arena);
    expect(orb.position).toEqual(position);
    expect(orb.velocity).toEqual(velocity);
  });

  it('bounces off a corner on both axes', () => {
    const orb = makeOrb(2, 1, -10, -5);
    resolveArenaBounds(orb, arena);
    expect(orb.position).toEqual({ x: 10, y: 10 });
    expect(orb.velocity).toEqual({ x: 10, y: 5 });
  });

  it('does not flip velocity already pointing away from the edge', () => {
    const orb = makeOrb(5, 50, 10, 0);
    resolveArenaBounds(orb, arena);
    expect(orb.velocity).toEqual({ x: 10, y: 0 });
  });

  it('keeps a fast orb inside the arena over a long step', () => {
    const orb = makeOrb(100, 50, 5000, 3000);
    stepPhysics([orb], open, 1);
    expect(orb.position.x).toBeGreaterThanOrEqual(orb.radius);
    expect(orb.position.x).toBeLessThanOrEqual(arena.width - orb.radius);
    expect(orb.position.y).toBeGreaterThanOrEqual(orb.radius);
    expect(orb.position.y).toBeLessThanOrEqual(arena.height - orb.radius);
    expect(speedOf(orb)).toBeCloseTo(Math.hypot(5000, 3000), 6);
  });
});

describe('wall collisions', () => {
  it('reflects off a wall segment hit head-on', () => {
    const orb = makeOrb(95, 50, 10, 0);
    resolveWallCollision(orb, wall(100, 0, 100, 100));
    expect(orb.position.x).toBeCloseTo(90, 9);
    expect(orb.velocity.x).toBeCloseTo(-10, 9);
    expect(orb.velocity.y).toBeCloseTo(0, 9);
  });

  it('reflects off a diagonal wall with angle in = angle out', () => {
    // Wall along y = x; an orb above it (screen y-down) moving down leaves moving right (+x).
    const orb = makeOrb(52, 45, 0, 10);
    resolveWallCollision(orb, wall(0, 0, 100, 100));
    expect(orb.velocity.x).toBeCloseTo(10, 9);
    expect(orb.velocity.y).toBeCloseTo(0, 9);
    expect(speedOf(orb)).toBeCloseTo(10, 9);
  });

  it('treats a wall end as a rounded corner', () => {
    // Orb approaching the end point (100, 50) of a wall from straight beyond it.
    const orb = makeOrb(100, 42, 0, 10);
    resolveWallCollision(orb, wall(100, 50, 100, 90));
    expect(orb.position.y).toBeCloseTo(40, 9);
    expect(orb.velocity.y).toBeCloseTo(-10, 9);
  });

  it('pushes the orb out without reflecting when it is moving away', () => {
    const orb = makeOrb(95, 50, -10, 0);
    resolveWallCollision(orb, wall(100, 0, 100, 100));
    expect(orb.position.x).toBeCloseTo(90, 9);
    expect(orb.velocity).toEqual({ x: -10, y: 0 });
  });

  it('pushes an orb centered exactly on a wall back against its motion', () => {
    const orb = makeOrb(100, 50, 10, 0);
    resolveWallCollision(orb, wall(100, 0, 100, 100));
    expect(orb.position.x).toBeCloseTo(90, 9);
    expect(orb.velocity.x).toBeCloseTo(-10, 9);
  });

  it('ignores walls the orb does not touch', () => {
    const orb = makeOrb(50, 50, 10, 0);
    resolveWallCollision(orb, wall(100, 0, 100, 100));
    expect(orb.position).toEqual({ x: 50, y: 50 });
    expect(orb.velocity).toEqual({ x: 10, y: 0 });
  });

  it('never tunnels through a thin wall, even at very high speed', () => {
    const environment: PhysicsEnvironment = { arena, walls: [wall(100, 0, 100, 100)] };
    for (const speed of [100, 1_000, 10_000, 100_000]) {
      const orb = makeOrb(50, 50, speed, speed * 0.1);
      for (let i = 0; i < 120; i++) {
        stepPhysics([orb], environment, 1 / 60);
        expect(orb.position.x).toBeLessThanOrEqual(100 - orb.radius + 1e-6);
      }
    }
  });

  it('stays out of a concave corner formed by two walls', () => {
    const environment: PhysicsEnvironment = {
      arena,
      walls: [wall(60, 20, 120, 80), wall(120, 80, 180, 20)],
    };
    const orb = makeOrb(120, 30, 0, 80);
    for (let i = 0; i < 240; i++) {
      stepPhysics([orb], environment, 1 / 120);
      for (const segment of environment.walls) {
        const ax = segment.b.x - segment.a.x;
        const ay = segment.b.y - segment.a.y;
        const t = Math.max(
          0,
          Math.min(
            1,
            ((orb.position.x - segment.a.x) * ax + (orb.position.y - segment.a.y) * ay) /
              (ax * ax + ay * ay),
          ),
        );
        const dx = orb.position.x - (segment.a.x + ax * t);
        const dy = orb.position.y - (segment.a.y + ay * t);
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(orb.radius - 1e-6);
      }
    }
    expect(speedOf(orb)).toBeCloseTo(80, 6);
  });
});

describe('orb–orb collisions', () => {
  it('reverses two equal orbs colliding head-on', () => {
    const a = makeOrb(50, 50, 10, 0);
    const b = makeOrb(68, 50, -10, 0);
    resolveOrbCollisions([a, b]);
    expect(a.velocity.x).toBeCloseTo(-10, 9);
    expect(b.velocity.x).toBeCloseTo(10, 9);
    expect(b.position.x - a.position.x).toBeCloseTo(20, 9);
  });

  it('conserves momentum when equal orbs keep equal speeds', () => {
    const a = makeOrb(50, 50, 10, 0);
    const b = makeOrb(68, 50, -10, 0);
    resolveOrbCollisions([a, b]);
    expect(a.velocity.x + b.velocity.x).toBeCloseTo(0, 9);
    expect(a.velocity.y + b.velocity.y).toBeCloseTo(0, 9);
  });

  it('deflects orbs in an angled collision while each keeps its own speed', () => {
    const a = makeOrb(50, 50, 10, 0);
    const b = makeOrb(65, 60, -10, 0);
    const before = { a: a.velocity, b: b.velocity };
    resolveOrbCollisions([a, b]);
    expect(a.velocity).not.toEqual(before.a);
    expect(b.velocity).not.toEqual(before.b);
    expect(speedOf(a)).toBeCloseTo(10, 9);
    expect(speedOf(b)).toBeCloseTo(10, 9);
    // After the collision they are no longer approaching each other.
    const nx = b.position.x - a.position.x;
    const ny = b.position.y - a.position.y;
    const closing = (b.velocity.x - a.velocity.x) * nx + (b.velocity.y - a.velocity.y) * ny;
    expect(closing).toBeGreaterThanOrEqual(0);
  });

  it('gives a stationary-target collision a direction change, not a speed change', () => {
    // b is moving slowly away at a right angle; a hits it from the side.
    const a = makeOrb(50, 50, 20, 0);
    const b = makeOrb(69, 50, 0, 5);
    resolveOrbCollisions([a, b]);
    expect(speedOf(a)).toBeCloseTo(20, 9);
    expect(speedOf(b)).toBeCloseTo(5, 9);
    expect(b.velocity.x).toBeGreaterThan(0);
  });

  it('separates overlapping orbs that are already moving apart without changing velocity', () => {
    const a = makeOrb(50, 50, -10, 0);
    const b = makeOrb(60, 50, 10, 0);
    resolveOrbCollisions([a, b]);
    expect(b.position.x - a.position.x).toBeCloseTo(20, 9);
    expect(a.velocity).toEqual({ x: -10, y: 0 });
    expect(b.velocity).toEqual({ x: 10, y: 0 });
  });

  it('moves a heavier orb less when separating', () => {
    const small = makeOrb(50, 50, 0, 0, 10);
    const large = makeOrb(70, 50, 0, 0, 20);
    resolveOrbCollisions([small, large]);
    expect(large.position.x - 70).toBeLessThan(50 - small.position.x);
    expect(large.position.x - small.position.x).toBeCloseTo(30, 9);
  });

  it('handles coincident centers deterministically', () => {
    const a = makeOrb(50, 50, 10, 0);
    const b = makeOrb(50, 50, -10, 0);
    resolveOrbCollisions([a, b]);
    expect(Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)).toBeCloseTo(20, 9);
    expect(Number.isFinite(a.velocity.x) && Number.isFinite(b.velocity.x)).toBe(true);
  });

  it('collides orbs during a physics step', () => {
    const a = makeOrb(60, 50, 40, 0);
    const b = makeOrb(140, 50, -40, 0);
    for (let i = 0; i < 120; i++) {
      stepPhysics([a, b], open, 1 / 120);
    }
    expect(a.velocity.x).toBeLessThan(0);
    expect(b.velocity.x).toBeGreaterThan(0);
  });
});

describe('captured and stopped orbs', () => {
  it('are not physically active', () => {
    expect(isPhysicallyActive(makeOrb(0, 0, 0, 0))).toBe(true);
    expect(isPhysicallyActive(makeOrb(0, 0, 0, 0, 10, { capture: 'captured' }))).toBe(false);
    expect(isPhysicallyActive(makeOrb(0, 0, 0, 0, 10, { movement: 'stopped' }))).toBe(false);
  });

  it('do not move', () => {
    const captured = makeOrb(50, 50, 30, 30, 10, { capture: 'captured', movement: 'stopped' });
    stepPhysics([captured], open, 1);
    expect(captured.position).toEqual({ x: 50, y: 50 });
  });

  it('do not collide with active orbs', () => {
    const captured = makeOrb(100, 50, 0, 0, 10, { capture: 'captured', movement: 'stopped' });
    const active = makeOrb(60, 50, 60, 0);
    for (let i = 0; i < 120; i++) {
      stepPhysics([captured, active], open, 1 / 120);
    }
    // The active orb passed straight through the captured orb's position.
    expect(active.position.x).toBeCloseTo(120, 6);
    expect(active.velocity).toEqual({ x: 60, y: 0 });
    expect(captured.position).toEqual({ x: 100, y: 50 });
  });
});
