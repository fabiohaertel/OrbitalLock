import type { Vec2 } from './vector';

/** Axis-aligned rectangle spanning `x..x+width`, `y..y+height`. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Nearest point inside (or on the border of) the rectangle. */
export function clampPointToRect(point: Vec2, rect: Rect): Vec2 {
  return {
    x: Math.min(Math.max(point.x, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(point.y, rect.y), rect.y + rect.height),
  };
}
