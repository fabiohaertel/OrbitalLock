import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import type { Wall } from '../../src/drawing/wall';
import { WallBuilder, createWallBuilderOptions } from '../../src/drawing/wallBuilder';
import { createSeededRandom } from '../../src/physics/random';
import { detectRegions, regionContainsPoint, regionsBoundedByWall } from '../../src/geometry/regions';

const arenaArea = ARENA.width * ARENA.height;

/** Draws a stroke through the given points with the real wall builder (snapping included). */
function buildWall(builder: WallBuilder, walls: readonly Wall[], points: [number, number][]): Wall {
  const input = (x: number, y: number) => ({ pointerId: 1, position: { x, y }, isPrimary: true });
  const [first, ...rest] = points;
  if (first === undefined) throw new Error('need points');
  builder.begin(input(...first));
  let previous = first;
  for (const point of rest) {
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      builder.move(input(previous[0] + (point[0] - previous[0]) * t, previous[1] + (point[1] - previous[1]) * t), []);
    }
    previous = point;
  }
  const outcome = builder.end(input(...previous), [], walls);
  if (outcome?.kind !== 'wallCreated') throw new Error(`wall not created: ${JSON.stringify(outcome)}`);
  return outcome.wall;
}

describe('region detection with walls built from strokes (integration)', () => {
  it('keeps regions consistent as walls are added one by one', () => {
    const builder = new WallBuilder(ARENA, createWallBuilderOptions(DEFAULT_GAMEPLAY_CONFIG));
    const strokes: [number, number][][] = [
      [[500, 8], [500, 617]], // vertical, snapped to both edges
      [[8, 300], [494, 300]], // left half split, snapped to edge and wall
      [[506, 120], [992, 480]], // diagonal across the right half
      [[150, 400], [300, 400], [300, 550], [150, 550], [153, 404]], // closed loop
      [[700, 500], [760, 580], [640, 590]], // dangling: encloses nothing
    ];
    const expectedCounts = [2, 3, 4, 5, 5];

    const walls: Wall[] = [];
    strokes.forEach((stroke, index) => {
      const wall = buildWall(builder, walls, stroke);
      walls.push(wall);
      const regions = detectRegions(ARENA, walls);

      expect(regions).toHaveLength(expectedCounts[index] as number);
      const total = regions.reduce((sum, region) => sum + region.area, 0);
      expect(total).toBeCloseTo(arenaArea, 3);
      for (const region of regions) {
        expect(region.area).toBeGreaterThan(0);
      }
    });

    const loop = walls[3] as Wall;
    const regions = detectRegions(ARENA, walls);
    expect(regionsBoundedByWall(regions, loop.id).map((r) => Math.round(r.area)).sort((a, b) => a - b)).toEqual([
      150 * 150,
      500 * 325 - 150 * 150,
    ]);
  });

  it('places every random point in exactly one region', () => {
    const builder = new WallBuilder(ARENA, createWallBuilderOptions(DEFAULT_GAMEPLAY_CONFIG));
    const walls: Wall[] = [];
    for (const stroke of [
      [[330, 8], [330, 617]],
      [[8, 200], [992, 410]],
      [[600, 60], [700, 60], [650, 160], [602, 64]],
    ] as [number, number][][]) {
      walls.push(buildWall(builder, walls, stroke));
    }
    const regions = detectRegions(ARENA, walls);
    const random = createSeededRandom(99);

    for (let i = 0; i < 500; i++) {
      const point = { x: random() * ARENA.width, y: random() * ARENA.height };
      const containing = regions.filter((region) => regionContainsPoint(region, point));
      expect(containing.length).toBeLessThanOrEqual(1);
      // Points exactly on a wall belong to no region; a random point virtually never is.
      expect(containing).toHaveLength(1);
    }
  });
});
