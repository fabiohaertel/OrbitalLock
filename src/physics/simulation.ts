import type { ArenaDimensions } from '../config/gameConfig';
import { closestPointOnSegment, type Segment } from '../geometry/segment';
import {
  add,
  dot,
  length,
  lengthSquared,
  normalize,
  scale,
  subtract,
  type Vec2,
} from '../geometry/vector';
import { isPhysicallyActive, type Orb } from './orb';

/** Static environment the orbs move in. */
export interface PhysicsEnvironment {
  /** Arena spanning `0..width` × `0..height`; its edges always block orbs. */
  readonly arena: ArenaDimensions;
  /** Permanent wall segments. Walls have no thickness; orbs collide with their radius. */
  readonly walls: readonly Segment[];
}

/**
 * Maximum distance an orb may travel in one sub-step, as a fraction of its
 * radius. Below 1, an orb can never jump across a zero-thickness wall
 * (it would need to travel 2 × radius), so walls cannot be tunneled through.
 */
const MAX_TRAVEL_PER_SUBSTEP = 0.5;

/**
 * Advances every physically active orb by `stepSeconds`.
 *
 * Physics model (arcade, constant speed):
 * - Orbs move in straight lines at constant speed.
 * - Arena edges and walls reflect the orb's velocity (angle in = angle out).
 *   Wall endpoints act as rounded corners.
 * - Orb–orb collisions are elastic along the contact normal, with mass
 *   proportional to radius². Afterwards each orb keeps its own speed, so
 *   collisions change directions but no orb speeds up or slows down.
 * - Captured or stopped orbs are ignored entirely.
 *
 * Long steps are split into sub-steps so no orb travels more than half its
 * radius per sub-step.
 */
export function stepPhysics(
  orbs: readonly Orb[],
  environment: PhysicsEnvironment,
  stepSeconds: number,
): void {
  if (!(stepSeconds > 0)) {
    return;
  }
  const active = orbs.filter(isPhysicallyActive);
  if (active.length === 0) {
    return;
  }

  const substeps = countSubsteps(active, stepSeconds);
  const dt = stepSeconds / substeps;

  for (let s = 0; s < substeps; s++) {
    for (const orb of active) {
      orb.position = add(orb.position, scale(orb.velocity, dt));
    }
    resolveOrbCollisions(active);
    for (const orb of active) {
      for (const wall of environment.walls) {
        resolveWallCollision(orb, wall);
      }
      resolveArenaBounds(orb, environment.arena);
    }
  }
}

function countSubsteps(orbs: readonly Orb[], stepSeconds: number): number {
  let substeps = 1;
  for (const orb of orbs) {
    const travel = length(orb.velocity) * stepSeconds;
    substeps = Math.max(substeps, Math.ceil(travel / (orb.radius * MAX_TRAVEL_PER_SUBSTEP)));
  }
  return substeps;
}

/** Keeps the orb fully inside the arena, reflecting velocity off the edge it hit. */
export function resolveArenaBounds(orb: Orb, arena: ArenaDimensions): void {
  const r = orb.radius;
  let { x, y } = orb.position;
  let { x: vx, y: vy } = orb.velocity;

  if (x < r) {
    x = r;
    vx = Math.abs(vx);
  } else if (x > arena.width - r) {
    x = arena.width - r;
    vx = -Math.abs(vx);
  }

  if (y < r) {
    y = r;
    vy = Math.abs(vy);
  } else if (y > arena.height - r) {
    y = arena.height - r;
    vy = -Math.abs(vy);
  }

  orb.position = { x, y };
  orb.velocity = { x: vx, y: vy };
}

/**
 * Pushes the orb out of the wall segment if they overlap and reflects its
 * velocity if it is moving into the wall. Uses the closest point on the
 * segment, so hitting a wall end behaves like hitting a rounded corner.
 */
export function resolveWallCollision(orb: Orb, wall: Segment): void {
  const closest = closestPointOnSegment(orb.position, wall);
  const offset = subtract(orb.position, closest);
  const distanceSq = lengthSquared(offset);
  if (distanceSq >= orb.radius * orb.radius) {
    return;
  }

  const distance = Math.sqrt(distanceSq);
  const normal = distance > 0 ? scale(offset, 1 / distance) : fallbackWallNormal(orb, wall);

  orb.position = add(closest, scale(normal, orb.radius));

  const approach = dot(orb.velocity, normal);
  if (approach < 0) {
    orb.velocity = subtract(orb.velocity, scale(normal, 2 * approach));
  }
}

/**
 * Normal to use when the orb's center lies exactly on the wall: the wall's
 * perpendicular pointing against the orb's motion (so it is pushed back the way
 * it came).
 */
function fallbackWallNormal(orb: Orb, wall: Segment): Vec2 {
  const direction = normalize(subtract(wall.b, wall.a));
  const perpendicular =
    lengthSquared(direction) > 0 ? { x: -direction.y, y: direction.x } : { x: 1, y: 0 };
  return dot(perpendicular, orb.velocity) > 0 ? scale(perpendicular, -1) : perpendicular;
}

/** Separates overlapping orbs and applies elastic, speed-preserving collision response. */
export function resolveOrbCollisions(orbs: readonly Orb[]): void {
  for (let i = 0; i < orbs.length; i++) {
    const first = orbs[i] as Orb;
    for (let j = i + 1; j < orbs.length; j++) {
      resolveOrbPair(first, orbs[j] as Orb);
    }
  }
}

function resolveOrbPair(first: Orb, second: Orb): void {
  const minDistance = first.radius + second.radius;
  const offset = subtract(second.position, first.position);
  const distanceSq = lengthSquared(offset);
  if (distanceSq >= minDistance * minDistance) {
    return;
  }

  const distance = Math.sqrt(distanceSq);
  // Coincident centers: pick a fixed axis so the result stays deterministic.
  const normal = distance > 0 ? scale(offset, 1 / distance) : { x: 1, y: 0 };

  const firstMass = first.radius * first.radius;
  const secondMass = second.radius * second.radius;
  const totalMass = firstMass + secondMass;

  // Separate in proportion to the other orb's mass, so heavier orbs move less.
  const overlap = minDistance - distance;
  first.position = subtract(first.position, scale(normal, (overlap * secondMass) / totalMass));
  second.position = add(second.position, scale(normal, (overlap * firstMass) / totalMass));

  const closingSpeed = dot(subtract(second.velocity, first.velocity), normal);
  if (closingSpeed >= 0) {
    return; // Already separating: no velocity change.
  }

  const firstSpeed = length(first.velocity);
  const secondSpeed = length(second.velocity);

  const firstVelocity = add(first.velocity, scale(normal, (2 * secondMass * closingSpeed) / totalMass));
  const secondVelocity = subtract(
    second.velocity,
    scale(normal, (2 * firstMass * closingSpeed) / totalMass),
  );

  first.velocity = withSpeed(firstVelocity, firstSpeed, scale(normal, -1));
  second.velocity = withSpeed(secondVelocity, secondSpeed, normal);
}

/** Rescales `velocity` to `speed`; uses `fallbackDirection` if the velocity is zero. */
function withSpeed(velocity: Vec2, speed: number, fallbackDirection: Vec2): Vec2 {
  const direction = lengthSquared(velocity) > 0 ? normalize(velocity) : fallbackDirection;
  return scale(direction, speed);
}
