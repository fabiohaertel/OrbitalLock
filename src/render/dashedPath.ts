import { polylineLength } from '../geometry/polyline';
import { distance, lerp, type Vec2 } from '../geometry/vector';

/**
 * The part of a polyline between two distances along it, measured from its
 * first point. Distances are clamped to the path; an empty or reversed range
 * gives an empty result. Pieces bend around the path's corners.
 */
export function slicePath(path: readonly Vec2[], from: number, to: number): Vec2[] {
  const total = polylineLength(path);
  const start = Math.max(0, from);
  const end = Math.min(total, to);
  if (path.length < 2 || !(end > start)) return [];

  const piece: Vec2[] = [];
  let travelled = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Vec2;
    const b = path[i] as Vec2;
    const length = distance(a, b);
    const segmentEnd = travelled + length;
    if (length > 0 && segmentEnd > start && travelled < end) {
      if (piece.length === 0) piece.push(lerp(a, b, (start - travelled) / length));
      if (segmentEnd >= end) {
        piece.push(lerp(a, b, (end - travelled) / length));
        break;
      }
      piece.push(b);
    }
    travelled = segmentEnd;
  }
  return piece;
}

/**
 * The lit dashes of a dashed line along `path`: dashes of length `dash`
 * separated by gaps of length `gap`. Raising `offset` slides the pattern
 * towards the path's last point, so increasing it over time makes the dashes
 * march towards the tip. Each dash is a polyline, so it follows corners.
 */
export function dashSegments(path: readonly Vec2[], dash: number, gap: number, offset: number): Vec2[][] {
  const period = dash + gap;
  const total = polylineLength(path);
  if (path.length < 2 || total <= 0 || !(dash > 0) || !(gap >= 0)) return [];
  if (gap === 0) return [[...path]];

  const phase = ((offset % period) + period) % period;
  const dashes: Vec2[][] = [];
  for (let start = phase - period; start < total; start += period) {
    const piece = slicePath(path, start, start + dash);
    if (piece.length >= 2) dashes.push(piece);
  }
  return dashes;
}

/** The point at a distance along the path, clamped to its ends; undefined for an empty path. */
export function pointAlongPath(path: readonly Vec2[], at: number): Vec2 | undefined {
  if (path.length === 0) return undefined;
  if (path.length === 1 || at <= 0) return path[0];
  const piece = slicePath(path, 0, at);
  return piece.at(-1) ?? path.at(-1);
}
