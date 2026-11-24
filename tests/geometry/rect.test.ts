import { describe, expect, it } from 'vitest';
import { ARENA } from '../../src/config/gameConfig';
import { clampPointToRect, type Rect } from '../../src/geometry/rect';
import { vec } from '../../src/geometry/vector';

describe('clampPointToRect', () => {
  const arena: Rect = { x: 0, y: 0, width: ARENA.width, height: ARENA.height };

  it('leaves points inside or on the border unchanged', () => {
    expect(clampPointToRect(vec(500, 300), arena)).toEqual(vec(500, 300));
    expect(clampPointToRect(vec(0, 0), arena)).toEqual(vec(0, 0));
    expect(clampPointToRect(vec(ARENA.width, ARENA.height), arena)).toEqual(
      vec(ARENA.width, ARENA.height),
    );
  });

  it('clamps points beyond each edge onto that edge', () => {
    expect(clampPointToRect(vec(-50, 300), arena)).toEqual(vec(0, 300));
    expect(clampPointToRect(vec(1200, 300), arena)).toEqual(vec(ARENA.width, 300));
    expect(clampPointToRect(vec(500, -1), arena)).toEqual(vec(500, 0));
    expect(clampPointToRect(vec(500, 9999), arena)).toEqual(vec(500, ARENA.height));
  });

  it('clamps points beyond a corner onto the corner', () => {
    expect(clampPointToRect(vec(-10, -10), arena)).toEqual(vec(0, 0));
    expect(clampPointToRect(vec(2000, 2000), arena)).toEqual(vec(ARENA.width, ARENA.height));
  });

  it('respects a rectangle that is not at the origin', () => {
    const offset: Rect = { x: 10, y: 20, width: 5, height: 5 };
    expect(clampPointToRect(vec(0, 0), offset)).toEqual(vec(10, 20));
    expect(clampPointToRect(vec(100, 22), offset)).toEqual(vec(15, 22));
  });
});
