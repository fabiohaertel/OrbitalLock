import { describe, expect, it } from 'vitest';
import { ARENA } from '../../src/config/gameConfig';
import { screenToArena, type ArenaTransform } from '../../src/layout/arenaTransform';

describe('screenToArena', () => {
  it('is the identity at scale 1 with no offset', () => {
    const identity: ArenaTransform = { offsetX: 0, offsetY: 0, scale: 1 };
    expect(screenToArena({ x: 123, y: 456 }, identity)).toEqual({ x: 123, y: 456 });
  });

  it.each([
    ['half size (small phone)', 0.5],
    ['1.92× (full HD)', 1.92],
    ['3× (high-density tablet)', 3],
  ])('maps the arena corners and center correctly at %s', (_label, scale) => {
    const transform: ArenaTransform = { offsetX: 40, offsetY: 15, scale };
    const corner = (x: number, y: number) => ({ x: 40 + x * scale, y: 15 + y * scale });

    expect(screenToArena(corner(0, 0), transform)).toEqual({ x: 0, y: 0 });
    const far = screenToArena(corner(ARENA.width, ARENA.height), transform);
    expect(far.x).toBeCloseTo(ARENA.width, 9);
    expect(far.y).toBeCloseTo(ARENA.height, 9);
    const center = screenToArena(corner(ARENA.width / 2, ARENA.height / 2), transform);
    expect(center.x).toBeCloseTo(ARENA.width / 2, 9);
    expect(center.y).toBeCloseTo(ARENA.height / 2, 9);
  });

  it('returns positions outside the arena for screen points beside it', () => {
    const transform: ArenaTransform = { offsetX: 100, offsetY: 0, scale: 2 };
    expect(screenToArena({ x: 50, y: -10 }, transform)).toEqual({ x: -25, y: -5 });
  });

  it('rejects non-positive or non-finite scales', () => {
    for (const scale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => screenToArena({ x: 0, y: 0 }, { offsetX: 0, offsetY: 0, scale })).toThrow(
        RangeError,
      );
    }
  });
});
