import { describe, expect, it } from 'vitest';
import type { Wall } from '../../src/drawing/wall';
import { WALL_PAINT_SECONDS, WallPaint } from '../../src/render/wallPaint';

function makeWall(id: number): Wall {
  return {
    id,
    path: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    closed: false,
    startAnchor: 'free',
    endAnchor: 'free',
    selfIntersections: [],
  };
}

describe('WallPaint: new walls are painted from start to end (REQUIREMENTS §5.4)', () => {
  it('paints a new wall from 0 to 1 within the paint time, then keeps it painted', () => {
    const paint = new WallPaint();
    const wall = makeWall(1);
    paint.start(wall);
    expect(paint.progress(wall)).toBe(0);

    paint.tick(WALL_PAINT_SECONDS / 2);
    const half = paint.progress(wall);
    expect(half).toBeGreaterThan(0.5); // eases out: fast start
    expect(half).toBeLessThan(1);

    paint.tick(WALL_PAINT_SECONDS / 4);
    expect(paint.progress(wall)).toBeGreaterThan(half);

    paint.tick(WALL_PAINT_SECONDS);
    expect(paint.progress(wall)).toBe(1);
    paint.tick(1);
    expect(paint.progress(wall)).toBe(1);
  });

  it('treats walls it is not painting as fully painted', () => {
    expect(new WallPaint().progress(makeWall(2))).toBe(1);
  });

  it('paints several walls independently', () => {
    const paint = new WallPaint();
    const older = makeWall(1);
    const newer = makeWall(2);
    paint.start(older);
    paint.tick(WALL_PAINT_SECONDS * 0.6);
    paint.start(newer);
    expect(paint.progress(older)).toBeGreaterThan(paint.progress(newer));
  });

  it('ignores zero or negative time, and clear finishes every wall', () => {
    const paint = new WallPaint();
    const wall = makeWall(1);
    paint.start(wall);
    paint.tick(-1);
    paint.tick(0);
    expect(paint.progress(wall)).toBe(0);
    paint.clear();
    expect(paint.progress(wall)).toBe(1);
  });
});
