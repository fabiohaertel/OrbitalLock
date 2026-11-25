import type { Vec2 } from '../geometry/vector';

/** A point or direction in 3D. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Row-major 3×3 rotation matrix mapping ball coordinates to view coordinates:
 * x right, y down (both in the arena plane) and z towards the viewer.
 */
export type Rotation = readonly [number, number, number, number, number, number, number, number, number];

export const IDENTITY_ROTATION: Rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Applies a rotation to a point. */
export function rotate(r: Rotation, p: Vec3): Vec3 {
  return {
    x: r[0] * p.x + r[1] * p.y + r[2] * p.z,
    y: r[3] * p.x + r[4] * p.y + r[5] * p.z,
    z: r[6] * p.x + r[7] * p.y + r[8] * p.z,
  };
}

/** Matrix product `a · b`: rotate by `b` first, then by `a`. */
export function multiplyRotations(a: Rotation, b: Rotation): Rotation {
  const at = (m: Rotation, index: number) => m[index] as number;
  const cell = (row: number, col: number) =>
    at(a, row * 3) * at(b, col) + at(a, row * 3 + 1) * at(b, 3 + col) + at(a, row * 3 + 2) * at(b, 6 + col);
  return [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 0), cell(1, 1), cell(1, 2), cell(2, 0), cell(2, 1), cell(2, 2)];
}

/** Rotation by `angle` radians around a unit `axis` (Rodrigues' formula). */
export function axisAngleRotation(axis: Vec3, angle: number): Rotation {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const { x, y, z } = axis;
  return [
    c + t * x * x,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    c + t * y * y,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    c + t * z * z,
  ];
}

/**
 * Rolls a ball lying on the arena by `displacement` (arena units) without
 * slipping (REQUIREMENTS §5.4): it turns by distance ÷ radius radians around
 * the in-plane axis perpendicular to the movement, so the point facing the
 * viewer moves in the direction of travel. The result is re-orthonormalized,
 * so rounding errors do not build up over many frames.
 */
export function rollRotation(orientation: Rotation, displacement: Vec2, radius: number): Rotation {
  const distance = Math.hypot(displacement.x, displacement.y);
  if (!(distance > 0) || !(radius > 0) || !Number.isFinite(distance)) return orientation;
  // Axis k with k × (0, 0, 1) = movement direction.
  const axis: Vec3 = { x: -displacement.y / distance, y: displacement.x / distance, z: 0 };
  return orthonormalize(multiplyRotations(axisAngleRotation(axis, distance / radius), orientation));
}

/** Nearest proper rotation to `r` (Gram–Schmidt on the rows). */
export function orthonormalize(r: Rotation): Rotation {
  const r0 = normalize3({ x: r[0], y: r[1], z: r[2] });
  const row1 = { x: r[3], y: r[4], z: r[5] };
  const r1 = normalize3(subtract3(row1, scale3(r0, dot3(row1, r0))));
  const r2 = cross(r0, r1);
  return [r0.x, r0.y, r0.z, r1.x, r1.y, r1.z, r2.x, r2.y, r2.z];
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

export function normalize3(p: Vec3): Vec3 {
  const len = Math.hypot(p.x, p.y, p.z);
  return { x: p.x / len, y: p.y / len, z: p.z / len };
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function subtract3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale3(p: Vec3, k: number): Vec3 {
  return { x: p.x * k, y: p.y * k, z: p.z * k };
}
