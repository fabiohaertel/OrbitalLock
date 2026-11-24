import { describe, expect, it } from 'vitest';
import { polylineLength, simplifyPolyline } from '../../src/geometry/polyline';
import { distancePointToSegment } from '../../src/geometry/segment';
import { vec, type Vec2 } from '../../src/geometry/vector';

describe('polylineLength', () => {
  it('is 0 for empty and single-point polylines', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([vec(3, 3)])).toBe(0);
  });

  it('sums the segment lengths', () => {
    expect(polylineLength([vec(0, 0), vec(3, 4), vec(3, 10)])).toBe(11);
  });

  it('includes the closing segment only when the last point repeats the first', () => {
    const square = [vec(0, 0), vec(10, 0), vec(10, 10), vec(0, 10)];
    expect(polylineLength(square)).toBe(30);
    expect(polylineLength([...square, vec(0, 0)])).toBe(40);
  });

  it('ignores repeated points', () => {
    expect(polylineLength([vec(0, 0), vec(0, 0), vec(5, 0), vec(5, 0)])).toBe(5);
  });
});

describe('simplifyPolyline', () => {
  /** Max distance from any original point to the simplified polyline. */
  function maxDeviation(original: readonly Vec2[], simplified: readonly Vec2[]): number {
    let worst = 0;
    for (const point of original) {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 1; i < simplified.length; i++) {
        const segment = { a: simplified[i - 1] as Vec2, b: simplified[i] as Vec2 };
        best = Math.min(best, distancePointToSegment(point, segment));
      }
      worst = Math.max(worst, best);
    }
    return worst;
  }

  it('returns short polylines unchanged (as a copy)', () => {
    const two = [vec(0, 0), vec(5, 5)];
    const result = simplifyPolyline(two, 1);
    expect(result).toEqual(two);
    expect(result).not.toBe(two);
    expect(simplifyPolyline([], 1)).toEqual([]);
  });

  it('collapses collinear points to the endpoints', () => {
    const line = [vec(0, 0), vec(1, 0), vec(2, 0), vec(3, 0), vec(10, 0)];
    expect(simplifyPolyline(line, 0.01)).toEqual([vec(0, 0), vec(10, 0)]);
  });

  it('keeps corners', () => {
    const lShape = [vec(0, 0), vec(5, 0), vec(10, 0), vec(10, 5), vec(10, 10)];
    expect(simplifyPolyline(lShape, 0.5)).toEqual([vec(0, 0), vec(10, 0), vec(10, 10)]);
  });

  it('removes jitter smaller than the tolerance', () => {
    const jittery = [vec(0, 0), vec(2, 0.3), vec(4, -0.2), vec(6, 0.25), vec(8, -0.1), vec(10, 0)];
    expect(simplifyPolyline(jittery, 0.5)).toEqual([vec(0, 0), vec(10, 0)]);
    expect(simplifyPolyline(jittery, 0.1).length).toBeGreaterThan(2);
  });

  it('keeps every original point within the tolerance of the result', () => {
    const wave: Vec2[] = [];
    for (let i = 0; i <= 200; i++) {
      wave.push(vec(i, Math.sin(i / 10) * 20));
    }
    for (const tolerance of [0.1, 1, 5]) {
      const simplified = simplifyPolyline(wave, tolerance);
      expect(simplified.length).toBeLessThan(wave.length);
      expect(maxDeviation(wave, simplified)).toBeLessThanOrEqual(tolerance + 1e-9);
    }
  });

  it('keeps a closed path closed', () => {
    const loop = [vec(0, 0), vec(5, 0.01), vec(10, 0), vec(10, 10), vec(0, 10), vec(0, 0)];
    const simplified = simplifyPolyline(loop, 0.5);
    expect(simplified[0]).toEqual(vec(0, 0));
    expect(simplified.at(-1)).toEqual(vec(0, 0));
    expect(simplified).toEqual([vec(0, 0), vec(10, 0), vec(10, 10), vec(0, 10), vec(0, 0)]);
  });

  it('keeps all distinct points with zero tolerance', () => {
    const zigzag = [vec(0, 0), vec(1, 1), vec(2, 0), vec(3, 1)];
    expect(simplifyPolyline(zigzag, 0)).toEqual(zigzag);
  });

  it('handles long paths that split unevenly (deep subdivision) without recursion limits', () => {
    // A zigzag keeps every point and splits one point at a time: 5k-deep subdivision.
    const zigzag: Vec2[] = [];
    for (let i = 0; i < 5_000; i++) {
      zigzag.push(vec(i, i % 2));
    }
    expect(simplifyPolyline(zigzag, 0.1)).toHaveLength(zigzag.length);
  });

  it('rejects negative or NaN tolerances', () => {
    expect(() => simplifyPolyline([vec(0, 0), vec(1, 1), vec(2, 0)], -1)).toThrow(RangeError);
    expect(() => simplifyPolyline([vec(0, 0), vec(1, 1), vec(2, 0)], Number.NaN)).toThrow(
      RangeError,
    );
  });
});
