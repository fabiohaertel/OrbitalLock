import { distancePointToSegmentSquared } from './segment';
import { distance, type Vec2 } from './vector';

/** Ordered list of points joined by straight segments. */
export type Polyline = readonly Vec2[];

/** Total length of the polyline; 0 for fewer than two points. */
export function polylineLength(points: Polyline): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1] as Vec2, points[i] as Vec2);
  }
  return total;
}

/**
 * Simplifies a polyline with the Ramer–Douglas–Peucker algorithm.
 *
 * Every removed point lies within `tolerance` of the simplified polyline, and
 * the first and last points are always kept (so closed paths stay closed).
 * Iterative, so long freehand paths cannot overflow the call stack.
 */
export function simplifyPolyline(points: Polyline, tolerance: number): Vec2[] {
  if (!(tolerance >= 0)) {
    throw new RangeError('tolerance must be a number >= 0');
  }
  if (points.length <= 2) {
    return [...points];
  }

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const toleranceSq = tolerance * tolerance;
  const ranges: [number, number][] = [[0, points.length - 1]];

  for (let range = ranges.pop(); range !== undefined; range = ranges.pop()) {
    const [first, last] = range;
    const segment = { a: points[first] as Vec2, b: points[last] as Vec2 };
    let farthestIndex = -1;
    let farthestDistanceSq = toleranceSq;

    for (let i = first + 1; i < last; i++) {
      const distanceSq = distancePointToSegmentSquared(points[i] as Vec2, segment);
      if (distanceSq > farthestDistanceSq) {
        farthestDistanceSq = distanceSq;
        farthestIndex = i;
      }
    }

    if (farthestIndex !== -1) {
      keep[farthestIndex] = true;
      ranges.push([first, farthestIndex], [farthestIndex, last]);
    }
  }

  return points.filter((_point, index) => keep[index]);
}
