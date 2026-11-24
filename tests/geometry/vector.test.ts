import { describe, expect, it } from 'vitest';
import {
  add,
  cross,
  distance,
  distanceSquared,
  dot,
  length,
  lengthSquared,
  lerp,
  normalize,
  pointsEqual,
  scale,
  subtract,
  vec,
} from '../../src/geometry/vector';

describe('vector operations', () => {
  it('adds, subtracts and scales', () => {
    expect(add(vec(1, 2), vec(3, -4))).toEqual(vec(4, -2));
    expect(subtract(vec(1, 2), vec(3, -4))).toEqual(vec(-2, 6));
    expect(scale(vec(1, -2), 3)).toEqual(vec(3, -6));
  });

  it('computes dot and cross products', () => {
    expect(dot(vec(1, 2), vec(3, 4))).toBe(11);
    expect(cross(vec(1, 0), vec(0, 1))).toBe(1);
    expect(cross(vec(0, 1), vec(1, 0))).toBe(-1);
    expect(cross(vec(2, 4), vec(1, 2))).toBe(0);
  });

  it('computes lengths and distances', () => {
    expect(length(vec(3, 4))).toBe(5);
    expect(lengthSquared(vec(3, 4))).toBe(25);
    expect(distance(vec(1, 1), vec(4, 5))).toBe(5);
    expect(distanceSquared(vec(1, 1), vec(4, 5))).toBe(25);
  });

  it('normalizes, returning the zero vector for zero length', () => {
    expect(normalize(vec(0, -5))).toEqual(vec(0, -1));
    expect(length(normalize(vec(3, 7)))).toBeCloseTo(1, 12);
    expect(normalize(vec(0, 0))).toEqual(vec(0, 0));
  });

  it('interpolates linearly', () => {
    expect(lerp(vec(0, 0), vec(10, 20), 0)).toEqual(vec(0, 0));
    expect(lerp(vec(0, 0), vec(10, 20), 0.25)).toEqual(vec(2.5, 5));
    expect(lerp(vec(0, 0), vec(10, 20), 1)).toEqual(vec(10, 20));
  });

  it('compares points within a tolerance', () => {
    expect(pointsEqual(vec(1, 1), vec(1 + 1e-9, 1))).toBe(true);
    expect(pointsEqual(vec(1, 1), vec(1.1, 1))).toBe(false);
    expect(pointsEqual(vec(1, 1), vec(1.1, 1), 0.2)).toBe(true);
  });
});
