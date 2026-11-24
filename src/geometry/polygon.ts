import { distancePointToSegmentSquared } from './segment';
import { DEFAULT_EPSILON } from './tolerance';
import type { Vec2 } from './vector';

/**
 * Simple polygon given by its vertices in order; the closing edge from the last
 * vertex back to the first is implicit. Either winding is accepted.
 */
export type Polygon = readonly Vec2[];

export type PointLocation = 'inside' | 'outside' | 'boundary';

/**
 * Signed area (shoelace formula). Positive for counter-clockwise vertices in a
 * y-up system, which is clockwise on screen (y down). 0 for fewer than 3 vertices.
 */
export function signedPolygonArea(polygon: Polygon): number {
  if (polygon.length < 3) {
    return 0;
  }
  let twiceArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i] as Vec2;
    const next = polygon[(i + 1) % polygon.length] as Vec2;
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

/** Unsigned area of the polygon, independent of winding. */
export function polygonArea(polygon: Polygon): number {
  return Math.abs(signedPolygonArea(polygon));
}

/**
 * Locates a point relative to the polygon. Points within `epsilon` of an edge
 * are reported as `'boundary'`; otherwise even–odd ray casting decides.
 * Polygons with fewer than 3 vertices contain no points.
 */
export function locatePointInPolygon(
  point: Vec2,
  polygon: Polygon,
  epsilon = DEFAULT_EPSILON,
): PointLocation {
  if (polygon.length < 3) {
    return 'outside';
  }

  const epsilonSq = epsilon * epsilon;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Vec2;
    const b = polygon[j] as Vec2;

    if (distancePointToSegmentSquared(point, { a, b }) <= epsilonSq) {
      return 'boundary';
    }

    // Half-open rule on y avoids double-counting rays that pass through a vertex.
    if (a.y > point.y !== b.y > point.y) {
      const crossingX = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (point.x < crossingX) {
        inside = !inside;
      }
    }
  }

  return inside ? 'inside' : 'outside';
}
