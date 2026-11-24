import type { ArenaDimensions } from '../config/gameConfig';
import { closestPointOnSegment, distancePointToSegmentSquared, intersectSegments, type Segment } from '../geometry/segment';
import { distanceSquared, type Vec2 } from '../geometry/vector';
import type { Orb } from '../physics/orb';
import type { WallAnchor } from './wall';

/**
 * Returns the first active orb the path touches (an orb whose center is within
 * its radius of any part of the path), or undefined. Captured orbs are ignored
 * (REQUIREMENTS §3.4 "walls must not be created through active orbs", §3.7).
 */
export function findTouchedOrb(path: readonly Vec2[], orbs: readonly Orb[]): Orb | undefined {
  if (path.length === 0) {
    return undefined;
  }
  for (const orb of orbs) {
    if (orb.capture !== 'active') {
      continue;
    }
    const radiusSq = orb.radius * orb.radius;
    if (path.length === 1) {
      if (distanceSquared(path[0] as Vec2, orb.position) <= radiusSq) {
        return orb;
      }
      continue;
    }
    for (let i = 1; i < path.length; i++) {
      const segment = { a: path[i - 1] as Vec2, b: path[i] as Vec2 };
      if (distancePointToSegmentSquared(orb.position, segment) <= radiusSq) {
        return orb;
      }
    }
  }
  return undefined;
}

/** Closest point on the arena border to `point`. */
export function closestPointOnArenaBoundary(point: Vec2, arena: ArenaDimensions): Vec2 {
  const x = Math.min(Math.max(point.x, 0), arena.width);
  const y = Math.min(Math.max(point.y, 0), arena.height);
  const candidates: Vec2[] = [
    { x: 0, y },
    { x: arena.width, y },
    { x, y: 0 },
    { x, y: arena.height },
  ];
  return nearest(point, candidates) ?? { x, y };
}

export interface SnapResult {
  readonly point: Vec2;
  readonly anchor: WallAnchor;
}

/**
 * Snaps an endpoint onto the nearest existing wall or arena edge within
 * `snapDistance` (D1). Walls win ties with the boundary. Leaves the point
 * unchanged (`'free'`) if nothing is close enough.
 */
export function snapEndpoint(
  point: Vec2,
  wallSegments: readonly Segment[],
  arena: ArenaDimensions,
  snapDistance: number,
): SnapResult {
  const limitSq = snapDistance * snapDistance;
  let best: SnapResult = { point, anchor: 'free' };
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (const segment of wallSegments) {
    const candidate = closestPointOnSegment(point, segment);
    const d = distanceSquared(point, candidate);
    if (d <= limitSq && d < bestDistanceSq) {
      best = { point: candidate, anchor: 'wall' };
      bestDistanceSq = d;
    }
  }

  const boundary = closestPointOnArenaBoundary(point, arena);
  const boundaryDistanceSq = distanceSquared(point, boundary);
  if (boundaryDistanceSq <= limitSq && boundaryDistanceSq < bestDistanceSq) {
    best = { point: boundary, anchor: 'boundary' };
  }

  return best;
}

/**
 * Points where non-adjacent segments of the path intersect. For a closed path
 * (last point equals the first) the first and last segments count as adjacent.
 * Collinear overlaps are reported by their start point.
 */
export function findSelfIntersections(path: readonly Vec2[], closed: boolean): Vec2[] {
  const segments: Segment[] = [];
  for (let i = 1; i < path.length; i++) {
    segments.push({ a: path[i - 1] as Vec2, b: path[i] as Vec2 });
  }

  const crossings: Vec2[] = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 2; j < segments.length; j++) {
      if (closed && i === 0 && j === segments.length - 1) {
        continue;
      }
      const hit = intersectSegments(segments[i] as Segment, segments[j] as Segment);
      if (hit.kind === 'point') {
        crossings.push(hit.point);
      } else if (hit.kind === 'overlap') {
        crossings.push(hit.start);
      }
    }
  }
  return crossings;
}

function nearest(point: Vec2, candidates: readonly Vec2[]): Vec2 | undefined {
  let best: Vec2 | undefined;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const d = distanceSquared(point, candidate);
    if (d < bestDistanceSq) {
      best = candidate;
      bestDistanceSq = d;
    }
  }
  return best;
}
