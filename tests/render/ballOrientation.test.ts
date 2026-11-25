import { describe, expect, it } from 'vitest';
import {
  IDENTITY_ROTATION,
  multiplyRotations,
  rollRotation,
  rotate,
  type Rotation,
  type Vec3,
} from '../../src/render/ballOrientation';

const FRONT: Vec3 = { x: 0, y: 0, z: 1 };

function expectVec(actual: Vec3, expected: Vec3, digits = 9): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
}

function expectRotation(actual: Rotation, expected: Rotation, digits = 9): void {
  actual.forEach((value, index) => { expect(value).toBeCloseTo(expected[index] as number, digits); });
}

describe('rollRotation (REQUIREMENTS §5.4 rolling)', () => {
  it('moves the point facing the viewer in the direction of travel', () => {
    for (const direction of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0.6, y: -0.8 },
    ]) {
      const rolled = rollRotation(IDENTITY_ROTATION, { x: direction.x * 0.1, y: direction.y * 0.1 }, 10);
      const front = rotate(rolled, FRONT);
      // A small roll moves the front point along the movement, scaled by 1 / radius.
      expect(front.x / 0.01).toBeCloseTo(direction.x, 3);
      expect(front.y / 0.01).toBeCloseTo(direction.y, 3);
    }
  });

  it('turns by distance ÷ radius (rolling without slipping)', () => {
    const radius = 10;
    // A quarter turn: the front point ends up on the rim, ahead of the ball.
    const quarter = rollRotation(IDENTITY_ROTATION, { x: (Math.PI / 2) * radius, y: 0 }, radius);
    expectVec(rotate(quarter, FRONT), { x: 1, y: 0, z: 0 });
    // One circumference: back to the start.
    const full = rollRotation(IDENTITY_ROTATION, { x: 0, y: 2 * Math.PI * radius }, radius);
    expectRotation(full, IDENTITY_ROTATION);
  });

  it('turns faster for a smaller ball covering the same distance', () => {
    const big = rotate(rollRotation(IDENTITY_ROTATION, { x: 5, y: 0 }, 20), FRONT);
    const small = rotate(rollRotation(IDENTITY_ROTATION, { x: 5, y: 0 }, 10), FRONT);
    expect(Math.asin(small.x)).toBeCloseTo(2 * Math.asin(big.x), 9);
  });

  it('gives the same orientation however a straight roll is split into steps', () => {
    const once = rollRotation(IDENTITY_ROTATION, { x: 30, y: -12 }, 12);
    let stepped: Rotation = IDENTITY_ROTATION;
    for (let i = 0; i < 60; i++) stepped = rollRotation(stepped, { x: 0.5, y: -0.2 }, 12);
    expectRotation(stepped, once);
  });

  it('starts from the current orientation, so a bounce keeps it', () => {
    const before = rollRotation(IDENTITY_ROTATION, { x: 7, y: 3 }, 10);
    expectRotation(rollRotation(before, { x: 0, y: 0 }, 10), before);
    const after = rollRotation(before, { x: -4, y: 2 }, 10);
    expectRotation(after, multiplyRotations(rollRotation(IDENTITY_ROTATION, { x: -4, y: 2 }, 10), before));
  });

  it('stays a proper rotation after many frames', () => {
    let r: Rotation = IDENTITY_ROTATION;
    for (let i = 0; i < 100_000; i++) r = rollRotation(r, { x: Math.cos(i) * 1.3, y: Math.sin(i * 0.7) * 1.3 }, 12);
    const rows = [0, 3, 6].map((o) => ({ x: r[o] as number, y: r[o + 1] as number, z: r[o + 2] as number }));
    for (const row of rows) expect(Math.hypot(row.x, row.y, row.z)).toBeCloseTo(1, 12);
    const [a, b, c] = rows as [Vec3, Vec3, Vec3];
    expect(a.x * b.x + a.y * b.y + a.z * b.z).toBeCloseTo(0, 12);
    // Right-handed: the third row is the cross product of the first two (no mirroring).
    expectVec(c, { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }, 12);
  });

  it('ignores invalid input', () => {
    expect(rollRotation(IDENTITY_ROTATION, { x: Number.NaN, y: 0 }, 10)).toBe(IDENTITY_ROTATION);
    expect(rollRotation(IDENTITY_ROTATION, { x: 1, y: 0 }, 0)).toBe(IDENTITY_ROTATION);
  });
});
