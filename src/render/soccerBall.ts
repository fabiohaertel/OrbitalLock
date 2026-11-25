import type { Vec2 } from '../geometry/vector';
import {
  cross,
  distance3 as distance,
  dot3,
  lerp3 as lerp,
  multiplyRotations,
  normalize3,
  rotate,
  type Rotation,
  type Vec3,
} from './ballOrientation';

/** One leather patch of the ball, projected onto the unit disk (y points down). */
export interface BallPatch {
  readonly kind: 'pentagon' | 'hexagon';
  readonly outline: readonly Vec2[];
}

/** One leather patch on the unit sphere, in ball coordinates. */
export interface SpherePatch {
  readonly kind: BallPatch['kind'];
  readonly outline: readonly Vec3[];
}

const PHI = (1 + Math.sqrt(5)) / 2;
/** View tilt in radians, so the ball at rest looks natural rather than perfectly symmetric. */
const TILT_X = 0.38;
const TILT_Y = -0.27;

/**
 * All 32 patches of a classic soccer ball (a truncated icosahedron: 12 black
 * pentagons and 20 white hexagons) on the unit sphere (REQUIREMENTS §5.4).
 * Each edge is subdivided and pushed onto the sphere, so edges curve like
 * seams on a real ball. Pure and deterministic.
 *
 * @param pointsPerEdge Points per patch edge; more gives smoother curves.
 */
export function soccerBallSphere(pointsPerEdge = 6): SpherePatch[] {
  const vertices = icosahedronVertices();
  const neighbors = vertices.map((v, i) => vertices.filter((w, j) => j !== i && distance(v, w) < 2.1));
  const faces = icosahedronFaces(vertices);

  const pentagons = vertices.map((v, i) =>
    sortAround(
      v,
      (neighbors[i] as Vec3[]).map((n) => lerp(v, n, 1 / 3)),
    ),
  );
  const hexagons = faces.map(([a, b, c]) => [
    lerp(a, b, 1 / 3),
    lerp(a, b, 2 / 3),
    lerp(b, c, 1 / 3),
    lerp(b, c, 2 / 3),
    lerp(c, a, 1 / 3),
    lerp(c, a, 2 / 3),
  ]);

  return [
    ...hexagons.map((corners) => ({ kind: 'hexagon' as const, outline: curvedOutline(corners, pointsPerEdge) })),
    ...pentagons.map((corners) => ({ kind: 'pentagon' as const, outline: curvedOutline(corners, pointsPerEdge) })),
  ];
}

/**
 * Orientation of a ball at rest: a pentagon faces the viewer, slightly tilted.
 * Balls start in this orientation and then roll (§5.4).
 */
export const DEFAULT_BALL_ORIENTATION: Rotation = defaultOrientation();

/**
 * The patches of a ball turned by `orientation`, as seen from the front.
 *
 * Points are projected straight onto the unit disk. Points on the far side of
 * the ball are moved to the rim, so patches crossing the edge end at the
 * silhouette. Patches entirely on the far side are left out. Hexagons come
 * before pentagons, so pentagons are painted on top. Pure and deterministic.
 */
export function projectBallPatches(sphere: readonly SpherePatch[], orientation: Rotation): BallPatch[] {
  const patches: BallPatch[] = [];
  for (const patch of sphere) {
    const points = patch.outline.map((p) => rotate(orientation, p));
    if (points.every((p) => p.z < 0)) continue;
    patches.push({ kind: patch.kind, outline: points.map(project) });
  }
  return patches;
}

/**
 * Patches of a soccer ball as seen from the front, at the given orientation
 * (default: the resting orientation). See `projectBallPatches`.
 */
export function soccerBallPatches(pointsPerEdge = 6, orientation: Rotation = DEFAULT_BALL_ORIENTATION): BallPatch[] {
  return projectBallPatches(soccerBallSphere(pointsPerEdge), orientation);
}

/** The 12 icosahedron vertices: (0, ±1, ±φ) and its cyclic permutations. Edge length 2. */
function icosahedronVertices(): Vec3[] {
  const result: Vec3[] = [];
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      result.push({ x: 0, y: s, z: t * PHI }, { x: s, y: t * PHI, z: 0 }, { x: t * PHI, y: 0, z: s });
    }
  }
  return result;
}

/** The 20 triangular faces: every set of three mutually adjacent vertices. */
function icosahedronFaces(vertices: readonly Vec3[]): [Vec3, Vec3, Vec3][] {
  const adjacent = (a: Vec3, b: Vec3) => distance(a, b) < 2.1;
  const faces: [Vec3, Vec3, Vec3][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      for (let k = j + 1; k < vertices.length; k++) {
        const a = vertices[i] as Vec3;
        const b = vertices[j] as Vec3;
        const c = vertices[k] as Vec3;
        if (adjacent(a, b) && adjacent(b, c) && adjacent(a, c)) faces.push([a, b, c]);
      }
    }
  }
  return faces;
}

/** Orders points by angle around `center`, so they form a convex outline. */
function sortAround(center: Vec3, points: Vec3[]): Vec3[] {
  const axis = normalize3(center);
  const u = normalize3(cross(axis, Math.abs(axis.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }));
  const w = cross(axis, u);
  const angle = (p: Vec3) => Math.atan2(dot3(p, w), dot3(p, u));
  return [...points].sort((a, b) => angle(a) - angle(b));
}

/** Subdivides each edge and pushes the points onto the unit sphere. */
function curvedOutline(corners: readonly Vec3[], pointsPerEdge: number): Vec3[] {
  const points: Vec3[] = [];
  corners.forEach((corner, index) => {
    const next = corners[(index + 1) % corners.length] as Vec3;
    for (let step = 0; step < pointsPerEdge; step++) {
      points.push(normalize3(lerp(corner, next, step / pointsPerEdge)));
    }
  });
  return points;
}

/** Camera axes looking at a pentagon center, then tilted around the horizontal and vertical axes. */
function defaultOrientation(): Rotation {
  const toward = normalize3(icosahedronVertices()[0] as Vec3);
  const right = normalize3(cross({ x: 0, y: 1, z: 0 }, toward));
  const down = cross(toward, right);
  const basis: Rotation = [right.x, right.y, right.z, down.x, down.y, down.z, toward.x, toward.y, toward.z];
  const cx = Math.cos(TILT_X);
  const sx = Math.sin(TILT_X);
  const cy = Math.cos(TILT_Y);
  const sy = Math.sin(TILT_Y);
  const tiltX: Rotation = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const tiltY: Rotation = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  return multiplyRotations(tiltY, multiplyRotations(tiltX, basis));
}

/** Straight-on projection; far-side points land on the rim at their own direction. */
function project(p: Vec3): Vec2 {
  if (p.z >= 0) return { x: p.x, y: p.y };
  const len = Math.hypot(p.x, p.y);
  return len > 0 ? { x: p.x / len, y: p.y / len } : { x: 1, y: 0 };
}
