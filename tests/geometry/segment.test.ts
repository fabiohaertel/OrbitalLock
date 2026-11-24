import { describe, expect, it } from 'vitest';
import {
  closestPointOnSegment,
  distancePointToSegment,
  distancePointToSegmentSquared,
  intersectSegments,
  type Segment,
  type SegmentIntersection,
} from '../../src/geometry/segment';
import { vec, type Vec2 } from '../../src/geometry/vector';

function seg(ax: number, ay: number, bx: number, by: number): Segment {
  return { a: vec(ax, ay), b: vec(bx, by) };
}

function expectPoint(result: SegmentIntersection, point: Vec2): { t: number; u: number } {
  if (result.kind !== 'point') {
    throw new Error(`expected a point intersection, got ${result.kind}`);
  }
  expect(result.point.x).toBeCloseTo(point.x, 9);
  expect(result.point.y).toBeCloseTo(point.y, 9);
  return { t: result.t, u: result.u };
}

function expectOverlap(result: SegmentIntersection, start: Vec2, end: Vec2): void {
  if (result.kind !== 'overlap') {
    throw new Error(`expected an overlap, got ${result.kind}`);
  }
  expect(result.start.x).toBeCloseTo(start.x, 9);
  expect(result.start.y).toBeCloseTo(start.y, 9);
  expect(result.end.x).toBeCloseTo(end.x, 9);
  expect(result.end.y).toBeCloseTo(end.y, 9);
}

describe('closestPointOnSegment / distancePointToSegment', () => {
  const horizontal = seg(0, 0, 10, 0);

  it('projects onto the interior of the segment', () => {
    expect(closestPointOnSegment(vec(4, 3), horizontal)).toEqual(vec(4, 0));
    expect(distancePointToSegment(vec(4, 3), horizontal)).toBe(3);
    expect(distancePointToSegmentSquared(vec(4, 3), horizontal)).toBe(9);
  });

  it('clamps to the nearest endpoint beyond the segment', () => {
    expect(closestPointOnSegment(vec(-3, 4), horizontal)).toEqual(vec(0, 0));
    expect(distancePointToSegment(vec(-3, 4), horizontal)).toBe(5);
    expect(distancePointToSegment(vec(13, -4), horizontal)).toBe(5);
  });

  it('is zero for a point on the segment', () => {
    expect(distancePointToSegment(vec(7, 0), horizontal)).toBe(0);
  });

  it('works on diagonal segments', () => {
    expect(distancePointToSegment(vec(0, 10), seg(0, 0, 10, 10))).toBeCloseTo(Math.SQRT2 * 5, 12);
  });

  it('handles a zero-length segment as a point', () => {
    const point = seg(2, 2, 2, 2);
    expect(closestPointOnSegment(vec(5, 6), point)).toEqual(vec(2, 2));
    expect(distancePointToSegment(vec(5, 6), point)).toBe(5);
  });
});

describe('intersectSegments', () => {
  it('finds a proper crossing', () => {
    const { t, u } = expectPoint(intersectSegments(seg(0, 0, 10, 10), seg(0, 10, 10, 0)), vec(5, 5));
    expect(t).toBeCloseTo(0.5, 12);
    expect(u).toBeCloseTo(0.5, 12);
  });

  it('reports parameters along each segment', () => {
    const { t, u } = expectPoint(intersectSegments(seg(0, 0, 10, 0), seg(2, -1, 2, 3)), vec(2, 0));
    expect(t).toBeCloseTo(0.2, 12);
    expect(u).toBeCloseTo(0.25, 12);
  });

  it('returns none when the lines cross outside the segments', () => {
    expect(intersectSegments(seg(0, 0, 1, 1), seg(3, 0, 2, 1)).kind).toBe('none');
  });

  it('returns none for parallel, non-collinear segments', () => {
    expect(intersectSegments(seg(0, 0, 10, 0), seg(0, 1, 10, 1)).kind).toBe('none');
  });

  it('returns none for collinear, disjoint segments', () => {
    expect(intersectSegments(seg(0, 0, 4, 0), seg(5, 0, 9, 0)).kind).toBe('none');
  });

  it('reports a collinear overlap regardless of direction', () => {
    expectOverlap(intersectSegments(seg(0, 0, 10, 0), seg(4, 0, 15, 0)), vec(4, 0), vec(10, 0));
    expectOverlap(intersectSegments(seg(0, 0, 10, 0), seg(15, 0, 4, 0)), vec(4, 0), vec(10, 0));
    expectOverlap(intersectSegments(seg(0, 0, 10, 10), seg(2, 2, 6, 6)), vec(2, 2), vec(6, 6));
  });

  it('reports collinear segments touching end to end as a point', () => {
    const { t, u } = expectPoint(intersectSegments(seg(0, 0, 5, 0), seg(5, 0, 9, 0)), vec(5, 0));
    expect(t).toBeCloseTo(1, 12);
    expect(u).toBeCloseTo(0, 12);
  });

  it('reports endpoints touching at an angle', () => {
    expectPoint(intersectSegments(seg(0, 0, 5, 5), seg(5, 5, 10, 0)), vec(5, 5));
  });

  it('reports a T-junction (endpoint on the interior of the other segment)', () => {
    const { t, u } = expectPoint(intersectSegments(seg(0, 0, 10, 0), seg(5, 0, 5, 7)), vec(5, 0));
    expect(t).toBeCloseTo(0.5, 12);
    expect(u).toBeCloseTo(0, 12);
  });

  it('treats a near-miss within epsilon as touching', () => {
    const almost = seg(5, 1e-9, 5, 7);
    expectPoint(intersectSegments(seg(0, 0, 10, 0), almost), vec(5, 0));
    expect(intersectSegments(seg(0, 0, 10, 0), seg(5, 0.5, 5, 7)).kind).toBe('none');
    expectPoint(intersectSegments(seg(0, 0, 10, 0), seg(5, 0.5, 5, 7), 0.6), vec(5, 0));
  });

  it('is symmetric in its arguments', () => {
    const first = seg(1, 2, 8, 9);
    const second = seg(1, 9, 9, 1);
    const ab = intersectSegments(first, second);
    const ba = intersectSegments(second, first);
    if (ab.kind !== 'point' || ba.kind !== 'point') {
      throw new Error('expected point intersections');
    }
    expect(ab.point.x).toBeCloseTo(ba.point.x, 12);
    expect(ab.point.y).toBeCloseTo(ba.point.y, 12);
    expect(ab.t).toBeCloseTo(ba.u, 12);
  });

  it('handles zero-length segments', () => {
    expectPoint(intersectSegments(seg(3, 0, 3, 0), seg(0, 0, 10, 0)), vec(3, 0));
    expectPoint(intersectSegments(seg(0, 0, 10, 0), seg(3, 0, 3, 0)), vec(3, 0));
    expect(intersectSegments(seg(3, 1, 3, 1), seg(0, 0, 10, 0)).kind).toBe('none');
    expectPoint(intersectSegments(seg(2, 2, 2, 2), seg(2, 2, 2, 2)), vec(2, 2));
    expect(intersectSegments(seg(2, 2, 2, 2), seg(3, 3, 3, 3)).kind).toBe('none');
  });

  it('works at arena scale with nearly parallel segments that do cross', () => {
    const result = intersectSegments(seg(0, 0, 1000, 1), seg(0, 1, 1000, 0));
    expectPoint(result, vec(500, 0.5));
  });
});
