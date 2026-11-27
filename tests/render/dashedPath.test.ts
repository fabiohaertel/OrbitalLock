import { describe, expect, it } from 'vitest';
import { polylineLength } from '../../src/geometry/polyline';
import type { Vec2 } from '../../src/geometry/vector';
import { dashSegments, pointAlongPath, slicePath } from '../../src/render/dashedPath';

const straight: Vec2[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
];
/** An L: 100 right, then 100 down (200 long). */
const corner: Vec2[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
];

function litLength(dashes: Vec2[][]): number {
  return dashes.reduce((sum, dash) => sum + polylineLength(dash), 0);
}

describe('slicePath (REQUIREMENTS §5.4)', () => {
  it('cuts the part between two distances, mid-segment', () => {
    expect(slicePath(straight, 20, 70)).toEqual([
      { x: 20, y: 0 },
      { x: 70, y: 0 },
    ]);
  });

  it('bends around corners', () => {
    expect(slicePath(corner, 90, 120)).toEqual([
      { x: 90, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 20 },
    ]);
  });

  it('clamps to the path and returns nothing for empty or reversed ranges', () => {
    expect(slicePath(corner, -50, 500)).toEqual(corner);
    expect(slicePath(corner, 80, 80)).toEqual([]);
    expect(slicePath(corner, 120, 90)).toEqual([]);
    expect(slicePath(corner, 300, 400)).toEqual([]);
    expect(slicePath([], 0, 10)).toEqual([]);
    expect(slicePath([{ x: 1, y: 1 }], 0, 10)).toEqual([]);
  });
});

describe('dashSegments: the dashed chalk line (REQUIREMENTS §5.4)', () => {
  it('lights about dash / (dash + gap) of the path, in dashes no longer than `dash`', () => {
    const dashes = dashSegments(corner, 10, 5, 0);
    // 13 whole periods (195) plus a last dash cut short at the tip.
    expect(litLength(dashes)).toBeCloseTo(13 * 10 + 5, 9);
    expect(Math.abs(litLength(dashes) - (200 * 10) / 15)).toBeLessThan(10);
    for (const dash of dashes) expect(polylineLength(dash)).toBeLessThanOrEqual(10 + 1e-9);
  });

  it('follows the path, including across corners', () => {
    // Offset 5: one dash runs from 95 to 105, wrapping the corner at 100.
    const wrapping = dashSegments(corner, 10, 5, 5).find((dash) => dash.length === 3);
    expect(wrapping).toEqual([
      { x: 95, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 5 },
    ]);
  });

  it('slides the dashes towards the tip as the offset grows, repeating every period', () => {
    expect(dashSegments(straight, 10, 5, 0)[0]?.[0]?.x).toBeCloseTo(0, 9);
    expect(dashSegments(straight, 10, 5, 4)[1]?.[0]?.x).toBeCloseTo(19, 9);
    expect(dashSegments(straight, 10, 5, 15)).toEqual(dashSegments(straight, 10, 5, 0));
    expect(dashSegments(straight, 10, 5, -11)).toEqual(dashSegments(straight, 10, 5, 4));
  });

  it('draws a solid line when there is no gap, and nothing for degenerate input', () => {
    expect(dashSegments(corner, 10, 0, 3)).toEqual([corner]);
    expect(dashSegments([], 10, 5, 0)).toEqual([]);
    expect(dashSegments([{ x: 0, y: 0 }], 10, 5, 0)).toEqual([]);
    expect(dashSegments(corner, 0, 5, 0)).toEqual([]);
  });
});

describe('pointAlongPath', () => {
  it('finds the point at a distance, clamped to the ends', () => {
    expect(pointAlongPath(corner, 150)).toEqual({ x: 100, y: 50 });
    expect(pointAlongPath(corner, -5)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(corner, 999)).toEqual({ x: 100, y: 100 });
    expect(pointAlongPath([], 5)).toBeUndefined();
  });
});
