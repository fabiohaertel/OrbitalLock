import { DEFAULT_EPSILON } from './tolerance';
import {
  add,
  cross,
  distance,
  distanceSquared,
  dot,
  lengthSquared,
  scale,
  subtract,
  type Vec2,
} from './vector';

/** Line segment from `a` to `b`. */
export interface Segment {
  readonly a: Vec2;
  readonly b: Vec2;
}

export type SegmentIntersection =
  | { readonly kind: 'none' }
  /**
   * The segments meet at a single point. `t` and `u` are the parameters of the
   * point along the first and second segment (0 at `a`, 1 at `b`), clamped to [0, 1].
   */
  | { readonly kind: 'point'; readonly point: Vec2; readonly t: number; readonly u: number }
  /** The segments are collinear and share a sub-segment from `start` to `end`. */
  | { readonly kind: 'overlap'; readonly start: Vec2; readonly end: Vec2 };

const NONE: SegmentIntersection = { kind: 'none' };

/** Closest point to `point` on the segment. */
export function closestPointOnSegment(point: Vec2, segment: Segment): Vec2 {
  const direction = subtract(segment.b, segment.a);
  const lenSq = lengthSquared(direction);
  if (lenSq === 0) {
    return segment.a;
  }
  const t = clamp01(dot(subtract(point, segment.a), direction) / lenSq);
  return add(segment.a, scale(direction, t));
}

export function distancePointToSegmentSquared(point: Vec2, segment: Segment): number {
  return distanceSquared(point, closestPointOnSegment(point, segment));
}

export function distancePointToSegment(point: Vec2, segment: Segment): number {
  return Math.sqrt(distancePointToSegmentSquared(point, segment));
}

/**
 * Intersection of two segments.
 *
 * `epsilon` is a distance tolerance in arena units: segments that come within
 * `epsilon` of touching (e.g. an endpoint resting on the other segment) are
 * reported as intersecting, and segments whose directions differ by less than
 * that tolerance over their length are treated as parallel.
 */
export function intersectSegments(
  first: Segment,
  second: Segment,
  epsilon = DEFAULT_EPSILON,
): SegmentIntersection {
  const r = subtract(first.b, first.a);
  const s = subtract(second.b, second.a);
  const rLenSq = lengthSquared(r);
  const sLenSq = lengthSquared(s);

  if (rLenSq <= epsilon * epsilon || sLenSq <= epsilon * epsilon) {
    return intersectDegenerate(first, second, rLenSq, sLenSq, epsilon);
  }

  const rLen = Math.sqrt(rLenSq);
  const sLen = Math.sqrt(sLenSq);
  const denominator = cross(r, s);
  const offset = subtract(second.a, first.a);

  // |cross(r, s)| = |r|·|s|·sin(θ). Treat the segments as parallel only when the
  // longer one drifts less than `epsilon` away from the other's direction over
  // its whole length: max(|r|, |s|)·sin(θ) <= epsilon.
  if (Math.abs(denominator) <= epsilon * Math.min(rLen, sLen)) {
    return intersectParallel(first, second, r, rLenSq, epsilon);
  }

  const t = cross(offset, s) / denominator;
  const u = cross(offset, r) / denominator;
  const tSlack = epsilon / rLen;
  const uSlack = epsilon / sLen;

  if (t < -tSlack || t > 1 + tSlack || u < -uSlack || u > 1 + uSlack) {
    return NONE;
  }

  const clampedT = clamp01(t);
  return {
    kind: 'point',
    point: add(first.a, scale(r, clampedT)),
    t: clampedT,
    u: clamp01(u),
  };
}

function intersectParallel(
  first: Segment,
  second: Segment,
  r: Vec2,
  rLenSq: number,
  epsilon: number,
): SegmentIntersection {
  const rLen = Math.sqrt(rLenSq);

  // Not on the same line: parallel segments never meet.
  const offsetFromLine = Math.abs(cross(subtract(second.a, first.a), r)) / rLen;
  if (offsetFromLine > epsilon) {
    return NONE;
  }

  // Collinear: project `second` onto `first` and intersect the parameter intervals.
  const t0 = dot(subtract(second.a, first.a), r) / rLenSq;
  const t1 = dot(subtract(second.b, first.a), r) / rLenSq;
  const start = Math.max(0, Math.min(t0, t1));
  const end = Math.min(1, Math.max(t0, t1));
  const slack = epsilon / rLen;

  if (end < start - slack) {
    return NONE;
  }

  if ((end - start) * rLen <= epsilon) {
    const t = clamp01((start + end) / 2);
    const point = add(first.a, scale(r, t));
    return { kind: 'point', point, t, u: parameterOnSegment(point, second) };
  }

  return {
    kind: 'overlap',
    start: add(first.a, scale(r, start)),
    end: add(first.a, scale(r, end)),
  };
}

function intersectDegenerate(
  first: Segment,
  second: Segment,
  rLenSq: number,
  sLenSq: number,
  epsilon: number,
): SegmentIntersection {
  const epsilonSq = epsilon * epsilon;

  if (rLenSq <= epsilonSq && sLenSq <= epsilonSq) {
    return distanceSquared(first.a, second.a) <= epsilonSq
      ? { kind: 'point', point: first.a, t: 0, u: 0 }
      : NONE;
  }

  if (rLenSq <= epsilonSq) {
    const closest = closestPointOnSegment(first.a, second);
    return distance(first.a, closest) <= epsilon
      ? { kind: 'point', point: first.a, t: 0, u: parameterOnSegment(closest, second) }
      : NONE;
  }

  const closest = closestPointOnSegment(second.a, first);
  return distance(second.a, closest) <= epsilon
    ? { kind: 'point', point: second.a, t: parameterOnSegment(closest, first), u: 0 }
    : NONE;
}

/** Parameter in [0, 1] of the projection of `point` onto the segment. */
function parameterOnSegment(point: Vec2, segment: Segment): number {
  const direction = subtract(segment.b, segment.a);
  const lenSq = lengthSquared(direction);
  return lenSq === 0 ? 0 : clamp01(dot(subtract(point, segment.a), direction) / lenSq);
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
