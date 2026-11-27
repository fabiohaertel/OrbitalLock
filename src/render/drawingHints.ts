import { distancePointToSegment } from '../geometry/segment';
import { distance, type Vec2 } from '../geometry/vector';
import type { Orb } from '../physics/orb';

/** An active ball closer than this (arena units, edge to line) starts to heat up the drawing. */
export const DANGER_WARN_DISTANCE = 60;

/**
 * How close an active ball is to the drawing in progress, 0..1 (REQUIREMENTS
 * §5.4): 0 when every active ball is at least `warnDistance` away (measured
 * from the ball's edge to the path), rising to 1 as a ball touches it, which
 * cancels the drawing (D2). Captured balls are ignored. Purely visual.
 */
export function previewDanger(
  path: readonly Vec2[],
  orbs: readonly Orb[],
  warnDistance: number = DANGER_WARN_DISTANCE,
): number {
  if (path.length === 0 || !(warnDistance > 0)) return 0;
  let closest = Number.POSITIVE_INFINITY;
  for (const orb of orbs) {
    if (orb.capture !== 'active') continue;
    closest = Math.min(closest, clearance(path, orb));
    if (closest <= 0) return 1;
  }
  return Math.max(0, Math.min(1, 1 - closest / warnDistance));
}

/** Distance from the ball's edge to the nearest point of the path; 0 or less when touching. */
function clearance(path: readonly Vec2[], orb: Orb): number {
  if (path.length === 1) return distance(path[0] as Vec2, orb.position) - orb.radius;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < path.length; i++) {
    const gap = distancePointToSegment(orb.position, { a: path[i - 1] as Vec2, b: path[i] as Vec2 });
    best = Math.min(best, gap);
  }
  return best - orb.radius;
}
