import { describe, expect, it } from 'vitest';
import {
  clipPolygonToXRange,
  locatePointInPolygon,
  polygonArea,
  signedPolygonArea,
  type Polygon,
} from '../../src/geometry/polygon';
import { vec } from '../../src/geometry/vector';

const square: Polygon = [vec(0, 0), vec(10, 0), vec(10, 10), vec(0, 10)];
const triangle: Polygon = [vec(0, 0), vec(8, 0), vec(0, 6)];
/** U shape: a 30×30 square with a 10×20 notch cut from the top middle. */
const uShape: Polygon = [
  vec(0, 0),
  vec(30, 0),
  vec(30, 30),
  vec(20, 30),
  vec(20, 10),
  vec(10, 10),
  vec(10, 30),
  vec(0, 30),
];

describe('polygon area (shoelace)', () => {
  it('computes the area of a square and a triangle', () => {
    expect(polygonArea(square)).toBe(100);
    expect(polygonArea(triangle)).toBe(24);
  });

  it('computes the area of a concave polygon', () => {
    expect(polygonArea(uShape)).toBe(900 - 200);
  });

  it('is independent of winding, while the signed area flips', () => {
    const reversed = [...square].reverse();
    expect(polygonArea(reversed)).toBe(100);
    expect(signedPolygonArea(square)).toBe(100);
    expect(signedPolygonArea(reversed)).toBe(-100);
  });

  it('is independent of the starting vertex and translation', () => {
    const rotated = [square[2], square[3], square[0], square[1]].filter((p) => p !== undefined);
    const moved = square.map((p) => vec(p.x + 400, p.y + 250));
    expect(polygonArea(rotated)).toBe(100);
    expect(polygonArea(moved)).toBeCloseTo(100, 9);
  });

  it('computes a diagonal (non axis-aligned) region', () => {
    const diamond: Polygon = [vec(5, 0), vec(10, 5), vec(5, 10), vec(0, 5)];
    expect(polygonArea(diamond)).toBe(50);
  });

  it('is 0 for degenerate polygons', () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([vec(0, 0), vec(5, 5)])).toBe(0);
    expect(polygonArea([vec(0, 0), vec(5, 5), vec(10, 10)])).toBe(0);
  });
});

describe('locatePointInPolygon', () => {
  it('classifies points inside and outside a square', () => {
    expect(locatePointInPolygon(vec(5, 5), square)).toBe('inside');
    expect(locatePointInPolygon(vec(15, 5), square)).toBe('outside');
    expect(locatePointInPolygon(vec(-1, -1), square)).toBe('outside');
  });

  it('reports points on an edge or a corner as boundary', () => {
    expect(locatePointInPolygon(vec(5, 0), square)).toBe('boundary');
    expect(locatePointInPolygon(vec(10, 7), square)).toBe('boundary');
    expect(locatePointInPolygon(vec(0, 0), square)).toBe('boundary');
    expect(locatePointInPolygon(vec(10, 10), square)).toBe('boundary');
  });

  it('honors the boundary tolerance', () => {
    expect(locatePointInPolygon(vec(5, 0.4), square)).toBe('inside');
    expect(locatePointInPolygon(vec(5, 0.4), square, 0.5)).toBe('boundary');
    expect(locatePointInPolygon(vec(5, -0.4), square, 0.5)).toBe('boundary');
  });

  it('handles concave polygons, including the notch', () => {
    expect(locatePointInPolygon(vec(5, 25), uShape)).toBe('inside');
    expect(locatePointInPolygon(vec(25, 25), uShape)).toBe('inside');
    expect(locatePointInPolygon(vec(15, 5), uShape)).toBe('inside');
    expect(locatePointInPolygon(vec(15, 20), uShape)).toBe('outside');
    expect(locatePointInPolygon(vec(15, 10), uShape)).toBe('boundary');
  });

  it('is not fooled by rays passing exactly through vertices', () => {
    // A horizontal ray from (5, 10) passes through the U's vertices (10,10) and (20,10).
    expect(locatePointInPolygon(vec(5, 10), uShape)).toBe('inside');
    // A ray from (-5, 5) passes through the diamond's left vertex at (0, 5).
    const diamond: Polygon = [vec(5, 0), vec(10, 5), vec(5, 10), vec(0, 5)];
    expect(locatePointInPolygon(vec(-5, 5), diamond)).toBe('outside');
    expect(locatePointInPolygon(vec(2, 5), diamond)).toBe('inside');
  });

  it('gives the same answer for either winding', () => {
    const reversed = [...uShape].reverse();
    for (const point of [vec(5, 25), vec(15, 20), vec(15, 5), vec(40, 5)]) {
      expect(locatePointInPolygon(point, reversed)).toBe(locatePointInPolygon(point, uShape));
    }
  });

  it('treats polygons with fewer than 3 vertices as empty', () => {
    expect(locatePointInPolygon(vec(0, 0), [])).toBe('outside');
    expect(locatePointInPolygon(vec(1, 1), [vec(0, 0), vec(2, 2)])).toBe('outside');
  });
});

describe('clipPolygonToXRange', () => {
  const square: Polygon = [vec(0, 0), vec(10, 0), vec(10, 10), vec(0, 10)];

  it('keeps the part of a polygon inside the band', () => {
    const clipped = clipPolygonToXRange(square, 2, 5);
    expect(polygonArea(clipped)).toBeCloseTo(30, 9);
    for (const p of clipped) {
      expect(p.x).toBeGreaterThanOrEqual(2);
      expect(p.x).toBeLessThanOrEqual(5);
    }
  });

  it('returns the polygon unchanged when it lies inside the band', () => {
    expect(polygonArea(clipPolygonToXRange(square, -5, 15))).toBeCloseTo(100, 9);
  });

  it('returns nothing when the polygon lies outside the band', () => {
    expect(clipPolygonToXRange(square, 20, 30)).toEqual([]);
  });

  it('clips concave polygons to the right area', () => {
    // U shape: 10x10 square without the 4x6 notch at x 3..7, y 0..6.
    const u: Polygon = [vec(0, 0), vec(3, 0), vec(3, 6), vec(7, 6), vec(7, 0), vec(10, 0), vec(10, 10), vec(0, 10)];
    expect(polygonArea(clipPolygonToXRange(u, 2, 8))).toBeCloseTo(6 * 10 - 4 * 6, 9);
  });

  it('band pieces add up to the whole polygon area', () => {
    const triangle: Polygon = [vec(1, 1), vec(9, 3), vec(4, 9)];
    let total = 0;
    for (let x = 0; x < 10; x += 2) total += polygonArea(clipPolygonToXRange(triangle, x, x + 2));
    expect(total).toBeCloseTo(polygonArea(triangle), 9);
  });
});
