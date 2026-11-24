import { describe, expect, it } from 'vitest';
import { extractFaces } from '../../src/geometry/planarGraph';
import { polygonArea } from '../../src/geometry/polygon';
import {
  detectRegions,
  itemsInRegion,
  regionContainsPoint,
  regionsBoundedByWall,
  type Region,
  type RegionWall,
} from '../../src/geometry/regions';
import { vec, type Vec2 } from '../../src/geometry/vector';

const arena = { width: 1000, height: 625 };
const arenaArea = arena.width * arena.height;

let nextId = 1;
function wall(...points: [number, number][]): RegionWall {
  return { id: nextId++, path: points.map(([x, y]) => vec(x, y)) };
}

function closedSquare(x: number, y: number, size: number): RegionWall {
  return wall([x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]);
}

function totalArea(regions: readonly Region[]): number {
  return regions.reduce((sum, region) => sum + region.area, 0);
}

function regionAt(regions: readonly Region[], point: Vec2): Region {
  const matches = regions.filter((region) => regionContainsPoint(region, point));
  expect(matches).toHaveLength(1);
  return matches[0] as Region;
}

function sortedAreas(regions: readonly Region[]): number[] {
  return regions.map((region) => region.area).sort((a, b) => a - b);
}

describe('detectRegions — basics', () => {
  it('treats the empty arena as a single region', () => {
    const regions = detectRegions(arena, []);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.area).toBeCloseTo(arenaArea, 6);
    expect(regions[0]?.holes).toEqual([]);
    expect(regions[0]?.wallIds.size).toBe(0);
  });

  it('splits the arena with a boundary-to-boundary vertical wall', () => {
    const regions = detectRegions(arena, [wall([300, 0], [300, 625])]);
    expect(sortedAreas(regions)).toEqual([300 * 625, 700 * 625]);
  });

  it('cuts off a corner with a diagonal wall', () => {
    const regions = detectRegions(arena, [wall([0, 100], [100, 0])]);
    expect(regions).toHaveLength(2);
    expect(regionAt(regions, vec(20, 20)).area).toBeCloseTo(5000, 6);
    expect(totalArea(regions)).toBeCloseTo(arenaArea, 6);
  });

  it('splits into four regions with two crossing walls', () => {
    const regions = detectRegions(arena, [wall([500, 0], [500, 625]), wall([0, 300], [1000, 300])]);
    expect(sortedAreas(regions)).toEqual([500 * 300, 500 * 300, 500 * 325, 500 * 325]);
  });

  it('handles a T-junction where one wall ends on another', () => {
    const regions = detectRegions(arena, [wall([500, 0], [500, 625]), wall([0, 300], [500, 300])]);
    expect(sortedAreas(regions)).toEqual([500 * 300, 500 * 325, 500 * 625]);
  });

  it('handles walls that overlap along the same line', () => {
    const regions = detectRegions(arena, [wall([400, 0], [400, 400]), wall([400, 200], [400, 625])]);
    expect(sortedAreas(regions)).toEqual([400 * 625, 600 * 625]);
  });

  it('merges endpoints that are within epsilon of a wall', () => {
    const regions = detectRegions(arena, [
      wall([500, 0], [500, 625]),
      wall([0, 300], [500 - 1e-9, 300]),
    ]);
    expect(regions).toHaveLength(3);
  });

  it('keeps bounded faces positively oriented', () => {
    const faces = extractFaces([
      { segment: { a: vec(0, 0), b: vec(10, 0) }, wallId: undefined },
      { segment: { a: vec(10, 0), b: vec(10, 10) }, wallId: undefined },
      { segment: { a: vec(10, 10), b: vec(0, 10) }, wallId: undefined },
      { segment: { a: vec(0, 10), b: vec(0, 0) }, wallId: undefined },
    ]);
    expect(faces.map((face) => face.signedArea).sort((a, b) => a - b)).toEqual([-100, 100]);
  });
});

describe('detectRegions — closed loops and islands', () => {
  it('finds a closed square floating in the arena, and subtracts it from the surrounding region', () => {
    const square = closedSquare(200, 200, 100);
    const regions = detectRegions(arena, [square]);
    expect(regions).toHaveLength(2);

    const inner = regionAt(regions, vec(250, 250));
    expect(inner.area).toBeCloseTo(10_000, 6);
    expect(inner.holes).toEqual([]);

    const outer = regionAt(regions, vec(50, 50));
    expect(outer.holes).toHaveLength(1);
    expect(outer.area).toBeCloseTo(arenaArea - 10_000, 6);
    expect(regionContainsPoint(outer, vec(250, 250))).toBe(false);
  });

  it('computes the area of a free-form closed polygon', () => {
    const outline: [number, number][] = [[300, 100], [420, 160], [380, 300], [260, 260], [300, 100]];
    const regions = detectRegions(arena, [wall(...outline)]);
    const expected = polygonArea(outline.slice(0, -1).map(([x, y]) => vec(x, y)));
    expect(regionAt(regions, vec(340, 200)).area).toBeCloseTo(expected, 6);
    expect(totalArea(regions)).toBeCloseTo(arenaArea, 6);
  });

  it('splits a self-crossing figure-eight into two regions', () => {
    const regions = detectRegions(arena, [
      wall([300, 300], [400, 400], [400, 300], [300, 400], [300, 300]),
    ]);
    expect(regions).toHaveLength(3);
    expect(regionAt(regions, vec(310, 350)).area).toBeCloseTo(2500, 6);
    expect(regionAt(regions, vec(390, 350)).area).toBeCloseTo(2500, 6);
    expect(totalArea(regions)).toBeCloseTo(arenaArea, 6);
  });

  it('assigns nested islands to the smallest region containing them', () => {
    const regions = detectRegions(arena, [closedSquare(100, 100, 300), closedSquare(200, 200, 50)]);
    expect(regions).toHaveLength(3);
    const ring = regionAt(regions, vec(120, 120));
    expect(ring.holes).toHaveLength(1);
    expect(ring.area).toBeCloseTo(300 * 300 - 50 * 50, 6);
    expect(regionAt(regions, vec(225, 225)).area).toBeCloseTo(2500, 6);
    expect(regionAt(regions, vec(50, 50)).area).toBeCloseTo(arenaArea - 300 * 300, 6);
  });

  it('closes a region with a loop drawn against the arena edge', () => {
    const regions = detectRegions(arena, [wall([0, 100], [100, 100], [100, 0])]);
    expect(regionAt(regions, vec(50, 50)).area).toBeCloseTo(10_000, 6);
  });
});

describe('detectRegions — loose ends', () => {
  it('ignores a wall that dangles from the arena edge', () => {
    const regions = detectRegions(arena, [wall([0, 300], [400, 300])]);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.area).toBeCloseTo(arenaArea, 6);
    expect(regions[0]?.wallIds.size).toBe(0);
  });

  it('ignores a free-floating open wall', () => {
    const regions = detectRegions(arena, [wall([200, 200], [400, 300], [500, 200])]);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.area).toBeCloseTo(arenaArea, 6);
  });

  it('ignores a tail sticking out of a closed loop', () => {
    const regions = detectRegions(arena, [
      wall([200, 200], [300, 200], [300, 300], [200, 300], [200, 200], [150, 150]),
    ]);
    expect(regionAt(regions, vec(250, 250)).area).toBeCloseTo(10_000, 6);
    expect(totalArea(regions)).toBeCloseTo(arenaArea, 6);
  });

  it('ignores the overshoot of a wall drawn past another wall', () => {
    const regions = detectRegions(arena, [wall([500, 0], [500, 625]), wall([0, 300], [550, 300])]);
    expect(sortedAreas(regions)).toEqual([500 * 300, 500 * 325, 500 * 625]);
  });
});

describe('orbs in regions', () => {
  const orbs = [
    { id: 1, position: vec(250, 250) },
    { id: 2, position: vec(260, 270) },
    { id: 3, position: vec(50, 50) },
  ];

  it('identifies which orbs belong to each region', () => {
    const regions = detectRegions(arena, [closedSquare(200, 200, 100)]);
    expect(itemsInRegion(regionAt(regions, vec(250, 250)), orbs).map((orb) => orb.id)).toEqual([1, 2]);
    expect(itemsInRegion(regionAt(regions, vec(50, 50)), orbs).map((orb) => orb.id)).toEqual([3]);
  });

  it('finds no orbs in an empty region', () => {
    const regions = detectRegions(arena, [closedSquare(600, 300, 100)]);
    expect(itemsInRegion(regionAt(regions, vec(650, 350)), orbs)).toEqual([]);
  });

  it('does not count an orb on a wall as inside', () => {
    const regions = detectRegions(arena, [closedSquare(200, 200, 100)]);
    const onWall = [{ id: 9, position: vec(200, 250) }];
    for (const region of regions) {
      expect(itemsInRegion(region, onWall)).toEqual([]);
    }
  });
});

describe('regionsBoundedByWall', () => {
  it('returns both halves when a wall splits a region', () => {
    const divider = wall([300, 0], [300, 625]);
    const regions = detectRegions(arena, [divider]);
    expect(regionsBoundedByWall(regions, divider.id)).toHaveLength(2);
  });

  it('returns the loop interior and the region it was cut out of', () => {
    const divider = wall([600, 0], [600, 625]);
    const loop = closedSquare(100, 100, 100);
    const regions = detectRegions(arena, [divider, loop]);
    const touched = regionsBoundedByWall(regions, loop.id);
    expect(touched).toHaveLength(2);
    expect(sortedAreas(touched)).toEqual([10_000, 600 * 625 - 10_000]);
  });

  it('returns nothing for a wall that encloses nothing', () => {
    const dangling = wall([0, 300], [400, 300]);
    expect(regionsBoundedByWall(detectRegions(arena, [dangling]), dangling.id)).toEqual([]);
  });
});
