import type { Segment } from '../geometry/segment';
import type { Vec2 } from '../geometry/vector';

/** What each end of a wall is attached to after snapping (REQUIREMENTS §11.1, D1). */
export type WallAnchor = 'boundary' | 'wall' | 'free';

/** A permanent wall committed to the arena (REQUIREMENTS §3.4). */
export interface Wall {
  readonly id: number;
  /** Polyline in arena coordinates. For a closed loop the last point equals the first. */
  readonly path: readonly Vec2[];
  /** True when the path ends where it started (D1 "closed loop"). */
  readonly closed: boolean;
  readonly startAnchor: WallAnchor;
  readonly endAnchor: WallAnchor;
  /** Points where the path crosses itself (D1: crossing itself also closes a region). */
  readonly selfIntersections: readonly Vec2[];
}

/** Flattens walls into the segment list the physics step collides orbs with. */
export function wallSegments(walls: readonly Wall[]): Segment[] {
  const segments: Segment[] = [];
  for (const wall of walls) {
    for (let i = 1; i < wall.path.length; i++) {
      segments.push({ a: wall.path[i - 1] as Vec2, b: wall.path[i] as Vec2 });
    }
  }
  return segments;
}
