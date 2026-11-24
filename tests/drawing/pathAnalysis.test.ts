import { describe, expect, it } from 'vitest';
import {
  closestPointOnArenaBoundary,
  findSelfIntersections,
  findTouchedOrb,
  snapEndpoint,
} from '../../src/drawing/pathAnalysis';
import { wallSegments, type Wall } from '../../src/drawing/wall';
import type { Segment } from '../../src/geometry/segment';
import { vec } from '../../src/geometry/vector';
import { makeOrb } from '../physics/helpers';

const arena = { width: 1000, height: 625 };

describe('findTouchedOrb', () => {
  const path = [vec(100, 100), vec(300, 100), vec(300, 300)];

  it('finds an orb the path passes through', () => {
    const orb = makeOrb(200, 100, 0, 0, 10);
    expect(findTouchedOrb(path, [orb])).toBe(orb);
  });

  it('finds an orb within its radius of the path, including exact contact', () => {
    expect(findTouchedOrb(path, [makeOrb(200, 109, 0, 0, 10)])).toBeDefined();
    expect(findTouchedOrb(path, [makeOrb(200, 110, 0, 0, 10)])).toBeDefined();
    expect(findTouchedOrb(path, [makeOrb(310, 200, 0, 0, 10)])).toBeDefined();
  });

  it('ignores orbs that are clear of the path', () => {
    expect(findTouchedOrb(path, [makeOrb(200, 111, 0, 0, 10)])).toBeUndefined();
    expect(findTouchedOrb(path, [makeOrb(200, 200, 0, 0, 10)])).toBeUndefined();
  });

  it('ignores captured orbs', () => {
    const captured = makeOrb(200, 100, 0, 0, 10, { capture: 'captured', movement: 'stopped' });
    expect(findTouchedOrb(path, [captured])).toBeUndefined();
  });

  it('checks a single-point path against orb radius', () => {
    expect(findTouchedOrb([vec(50, 50)], [makeOrb(55, 50, 0, 0, 10)])).toBeDefined();
    expect(findTouchedOrb([vec(50, 50)], [makeOrb(70, 50, 0, 0, 10)])).toBeUndefined();
    expect(findTouchedOrb([], [makeOrb(50, 50, 0, 0, 10)])).toBeUndefined();
  });
});

describe('closestPointOnArenaBoundary', () => {
  it('picks the nearest edge', () => {
    expect(closestPointOnArenaBoundary(vec(5, 300), arena)).toEqual(vec(0, 300));
    expect(closestPointOnArenaBoundary(vec(990, 300), arena)).toEqual(vec(1000, 300));
    expect(closestPointOnArenaBoundary(vec(500, 3), arena)).toEqual(vec(500, 0));
    expect(closestPointOnArenaBoundary(vec(500, 620), arena)).toEqual(vec(500, 625));
  });
});

describe('snapEndpoint', () => {
  const existing: Segment[] = [{ a: vec(200, 100), b: vec(200, 500) }];

  it('snaps to the arena boundary within the snap distance', () => {
    expect(snapEndpoint(vec(500, 10), [], arena, 15)).toEqual({ point: vec(500, 0), anchor: 'boundary' });
  });

  it('snaps to an existing wall within the snap distance', () => {
    expect(snapEndpoint(vec(210, 300), existing, arena, 15)).toEqual({
      point: vec(200, 300),
      anchor: 'wall',
    });
  });

  it('snaps to a wall end when that is the closest point', () => {
    expect(snapEndpoint(vec(205, 90), existing, arena, 15)).toEqual({
      point: vec(200, 100),
      anchor: 'wall',
    });
  });

  it('prefers whichever target is closer', () => {
    const nearEdge: Segment[] = [{ a: vec(100, 12), b: vec(900, 12) }];
    expect(snapEndpoint(vec(500, 9), nearEdge, arena, 15).anchor).toBe('wall');
    expect(snapEndpoint(vec(500, 4), nearEdge, arena, 15).anchor).toBe('boundary');
  });

  it('leaves the point free when nothing is close enough', () => {
    expect(snapEndpoint(vec(500, 300), existing, arena, 15)).toEqual({
      point: vec(500, 300),
      anchor: 'free',
    });
  });
});

describe('findSelfIntersections', () => {
  it('finds the crossing of a figure-eight', () => {
    const figureEight = [vec(0, 0), vec(100, 100), vec(100, 0), vec(0, 100), vec(0, 0)];
    const crossings = findSelfIntersections(figureEight, true);
    expect(crossings).toHaveLength(1);
    expect(crossings[0]?.x).toBeCloseTo(50, 9);
    expect(crossings[0]?.y).toBeCloseTo(50, 9);
  });

  it('finds no crossings in a simple closed square', () => {
    const square = [vec(0, 0), vec(100, 0), vec(100, 100), vec(0, 100), vec(0, 0)];
    expect(findSelfIntersections(square, true)).toEqual([]);
  });

  it('finds no crossings in an open L-shape or a straight line', () => {
    expect(findSelfIntersections([vec(0, 0), vec(100, 0), vec(100, 100)], false)).toEqual([]);
    expect(findSelfIntersections([vec(0, 0), vec(100, 0)], false)).toEqual([]);
  });

  it('finds an open path that loops over itself', () => {
    const loop = [vec(0, 50), vec(100, 50), vec(80, 0), vec(60, 100)];
    expect(findSelfIntersections(loop, false)).toHaveLength(1);
  });
});

describe('wallSegments', () => {
  it('flattens wall paths into segments', () => {
    const walls: Wall[] = [
      {
        id: 1,
        path: [vec(0, 0), vec(10, 0), vec(10, 10)],
        closed: false,
        startAnchor: 'free',
        endAnchor: 'free',
        selfIntersections: [],
      },
      {
        id: 2,
        path: [vec(50, 50), vec(60, 60)],
        closed: false,
        startAnchor: 'free',
        endAnchor: 'free',
        selfIntersections: [],
      },
    ];
    expect(wallSegments(walls)).toEqual([
      { a: vec(0, 0), b: vec(10, 0) },
      { a: vec(10, 0), b: vec(10, 10) },
      { a: vec(50, 50), b: vec(60, 60) },
    ]);
    expect(wallSegments([])).toEqual([]);
  });
});
