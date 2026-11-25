/**
 * Phase 10 stress test: many orbs, many walls of every kind (wall-to-wall
 * lines, acute wedges, closed loops, strokes leaving the arena), drawn while
 * the orbs keep moving. After every frame the world must still be consistent:
 * no orb escapes the arena or crosses a wall, no active orb enters captured
 * space, and the regions still tile the arena.
 */
import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG, type GameplayConfig } from '../../src/config/gameConfig';
import type { PointerInput } from '../../src/drawing/drawingSession';
import { wallSegments } from '../../src/drawing/wall';
import { detectRegions, regionContainsPoint, type Region } from '../../src/geometry/regions';
import { distancePointToSegment } from '../../src/geometry/segment';
import type { Vec2 } from '../../src/geometry/vector';
import { createSeededRandom, type RandomSource } from '../../src/physics/random';
import { createOrbs } from '../../src/physics/spawn';
import { GameWorld } from '../../src/world/gameWorld';

const FRAME = 1 / 60;
const ARENA_AREA = ARENA.width * ARENA.height;

function input(point: Vec2): PointerInput {
  return { pointerId: 1, position: point, isPrimary: true };
}

/** A random stroke: a free polyline, an acute wedge or a closed loop; may reach past the arena. */
function randomStroke(random: RandomSource): Vec2[] {
  const style = random();
  const cx = random() * ARENA.width;
  const cy = random() * ARENA.height;
  if (style < 0.3) {
    const corners = 3 + Math.floor(random() * 5);
    const size = 30 + random() * 200;
    const loop = Array.from({ length: corners }, (_, i) => {
      const angle = (i / corners) * Math.PI * 2;
      return { x: cx + Math.cos(angle) * size, y: cy + Math.sin(angle) * size };
    });
    return [...loop, loop[0] as Vec2];
  }
  if (style < 0.6) {
    const angle = random() * Math.PI * 2;
    const spread = 0.05 + random() * 0.3;
    const reach = 100 + random() * 300;
    const arm = (a: number) => ({ x: cx + Math.cos(a) * reach, y: cy + Math.sin(a) * reach });
    return [arm(angle - spread), { x: cx, y: cy }, arm(angle + spread)];
  }
  const count = 2 + Math.floor(random() * 6);
  return Array.from({ length: count }, () => ({
    x: random() * ARENA.width * 1.1 - 50,
    y: random() * ARENA.height * 1.1 - 30,
  }));
}

/** Drags the pointer along the stroke and releases it, with no time passing. */
function drawStroke(world: GameWorld, stroke: readonly Vec2[]): boolean {
  const [first, ...rest] = stroke;
  if (first === undefined) return false;
  world.pointerDown(input(first));
  let previous = first;
  for (const point of rest) {
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      world.pointerMove(input({ x: previous.x + (point.x - previous.x) * t, y: previous.y + (point.y - previous.y) * t }));
    }
    previous = point;
  }
  return world.pointerUp(input(previous)).some((event) => event.kind === 'wallCreated');
}

function regionIndexOf(regions: readonly Region[], point: Vec2): number {
  return regions.findIndex((region) => regionContainsPoint(region, point));
}

interface StressResult {
  /** Every broken invariant; empty when the world stayed consistent. */
  readonly problems: readonly string[];
  readonly walls: number;
  readonly capturedOrbs: number;
}

/** Runs a seeded game for up to `seconds`, drawing a random stroke every 40 frames. */
function stressRun(seed: number, config: Partial<GameplayConfig>, seconds: number): StressResult {
  const random = createSeededRandom(seed);
  const world = new GameWorld({
    config: { ...DEFAULT_GAMEPLAY_CONFIG, maxFailedAttempts: 1_000_000, ...config },
    spawnOrbs: (cfg, arena) => createOrbs(cfg, arena, createSeededRandom(seed * 31)),
  });
  const problems: string[] = [];

  let regions: Region[] = [];
  const homeRegion = new Map<number, number>();
  const recordRegions = () => {
    regions = detectRegions(ARENA, world.walls);
    const total = regions.reduce((sum, region) => sum + region.area, 0);
    if (Math.abs(total - ARENA_AREA) > 1e-3) problems.push(`regions cover ${String(total)} of ${String(ARENA_AREA)}`);
    homeRegion.clear();
    for (const orb of world.orbs) {
      if (orb.capture === 'active') homeRegion.set(orb.id, regionIndexOf(regions, orb.position));
    }
  };
  recordRegions();

  for (let frame = 0; frame < seconds * 60 && world.status === 'playing' && problems.length === 0; frame++) {
    if (frame % 40 === 0 && drawStroke(world, randomStroke(random))) recordRegions();
    world.update(FRAME);

    const segments = wallSegments(world.walls);
    for (const orb of world.orbs) {
      const { x, y } = orb.position;
      const at = `seed ${String(seed)}, frame ${String(frame)}, orb ${String(orb.id)}`;
      if (!Number.isFinite(x) || !Number.isFinite(y)) problems.push(`${at}: position is not finite`);
      if (orb.capture !== 'active') continue;

      const r = orb.radius - 1e-6;
      if (x < r || y < r || x > ARENA.width - r || y > ARENA.height - r) problems.push(`${at}: left the arena`);
      if (world.capturedRegions.some((region) => regionContainsPoint(region, orb.position))) {
        problems.push(`${at}: entered a captured region`);
      }
      // Overlaps are resolved every sub-step; an orb never ends a frame deep inside a wall.
      if (segments.some((segment) => distancePointToSegment(orb.position, segment) < orb.radius * 0.5)) {
        problems.push(`${at}: deep inside a wall`);
      }
      // Walls are impassable: without a new wall, an orb stays in its region.
      const region = regionIndexOf(regions, orb.position);
      if (region !== -1 && region !== homeRegion.get(orb.id)) problems.push(`${at}: crossed a wall`);
    }
  }
  const capturedOrbs = world.orbs.filter((orb) => orb.capture === 'captured').length;
  return { problems, walls: world.walls.length, capturedOrbs };
}

/** The run stayed consistent, and it really exercised walls and captures. */
function expectConsistent(result: StressResult): void {
  expect(result.problems).toEqual([]);
  expect(result.walls).toBeGreaterThanOrEqual(5);
  expect(result.capturedOrbs).toBeGreaterThan(0);
}

describe('stress: many orbs and walls', () => {
  it.each([1, 2, 3, 4])('stays consistent with the default config (seed %i)', (seed) => {
    expectConsistent(stressRun(seed, { initialOrbCount: 25 }, 60));
  });

  it.each([5, 6])('stays consistent with many fast orbs (seed %i)', (seed) => {
    expectConsistent(stressRun(seed, { initialOrbCount: 40, orbSpeed: 400 }, 40));
  });

  it.each([7, 9])('stays consistent with large orbs and small capture areas (seed %i)', (seed) => {
    expectConsistent(
      stressRun(seed, { initialOrbCount: 30, orbRadius: 25, orbSpeed: 300, maxCaptureAreaRatio: 0.05 }, 40),
    );
  });
});
