/**
 * Phase 10 performance check (REQUIREMENTS §7.1 "drawing and geometry
 * calculations must not cause noticeable frame drops"): a busy frame with
 * many orbs, about 1,000 wall segments and a long drawing in progress, and the
 * region rebuild that follows a committed wall.
 *
 * Budgets are generous multiples of desktop timings (a busy frame is about
 * 1 ms, a region rebuild about 20 ms), so the test only fails on a real
 * regression, not on a slow CI machine. Mobile CPUs are roughly 4× slower.
 */
import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import { findTouchedOrb } from '../../src/drawing/pathAnalysis';
import { detectRegions, type RegionWall } from '../../src/geometry/regions';
import type { Segment } from '../../src/geometry/segment';
import type { Vec2 } from '../../src/geometry/vector';
import { DEFAULT_STEP_SECONDS } from '../../src/physics/fixedTimestep';
import { createSeededRandom } from '../../src/physics/random';
import { stepPhysics } from '../../src/physics/simulation';
import { createOrbs } from '../../src/physics/spawn';

/** 40 random freehand walls of 25 points: 960 segments with many crossings. */
function freehandWalls(): RegionWall[] {
  const random = createSeededRandom(3);
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  return Array.from({ length: 40 }, (_, index) => {
    let x = random() * ARENA.width;
    let y = random() * ARENA.height;
    const path: Vec2[] = [{ x, y }];
    for (let i = 0; i < 24; i++) {
      x = clamp(x + (random() - 0.5) * 80, ARENA.width);
      y = clamp(y + (random() - 0.5) * 80, ARENA.height);
      path.push({ x, y });
    }
    return { id: index + 1, path };
  });
}

function segmentsOf(walls: readonly RegionWall[]): Segment[] {
  return walls.flatMap((wall) => wall.path.slice(1).map((b, i) => ({ a: wall.path[i] as Vec2, b })));
}

/** Average milliseconds per run of `work`, after one warm-up run. */
function averageMs(runs: number, work: () => void): number {
  work();
  const start = performance.now();
  for (let i = 0; i < runs; i++) work();
  return (performance.now() - start) / runs;
}

describe('frame budget', () => {
  const walls = freehandWalls();
  const segments = segmentsOf(walls);

  it('simulates a 60 fps frame with 60 orbs, ~1,000 wall segments and a long drawing in well under a frame', () => {
    expect(segments.length).toBeGreaterThan(900);
    const orbs = createOrbs({ ...DEFAULT_GAMEPLAY_CONFIG, initialOrbCount: 60 }, ARENA, createSeededRandom(1));
    // A slow stroke around much of the arena: 1,500 points.
    const drawing = Array.from({ length: 1500 }, (_, i) => ({
      x: 500 + Math.cos(i / 100) * 300,
      y: 300 + Math.sin(i / 100) * 200,
    }));
    const stepsPerFrame = Math.round(1 / 60 / DEFAULT_STEP_SECONDS);

    const frameMs = averageMs(60, () => {
      for (let s = 0; s < stepsPerFrame; s++) {
        stepPhysics(orbs, { arena: ARENA, walls: segments }, DEFAULT_STEP_SECONDS);
        findTouchedOrb(drawing, orbs);
      }
    });
    // A 60 fps frame lasts 16.7 ms and also has to render.
    expect(frameMs).toBeLessThan(8);
  });

  it('rebuilds the regions of ~1,000 wall segments fast enough for a one-off step after a wall', () => {
    const rebuildMs = averageMs(3, () => detectRegions(ARENA, walls));
    expect(rebuildMs).toBeLessThan(150);
  });
});
