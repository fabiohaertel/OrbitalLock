import type { Vec2 } from '../geometry/vector';

/**
 * Placement of the logical arena on screen: an arena point `p` is drawn at
 * `offset + p × scale` (in game-canvas pixels). Uniform scale keeps the
 * arena's proportions (REQUIREMENTS §11.1, D6).
 */
export interface ArenaTransform {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
}

/**
 * Converts a screen (game-canvas) position into logical arena coordinates
 * (REQUIREMENTS §7.2). The result may lie outside the arena; callers decide
 * whether to clamp or ignore it.
 */
export function screenToArena(screen: Vec2, transform: ArenaTransform): Vec2 {
  if (!(transform.scale > 0) || !Number.isFinite(transform.scale)) {
    throw new RangeError('transform.scale must be a finite number > 0');
  }
  return {
    x: (screen.x - transform.offsetX) / transform.scale,
    y: (screen.y - transform.offsetY) / transform.scale,
  };
}
