import type { ArenaDimensions } from '../config/gameConfig';
import type { Vec2 } from '../geometry/vector';

/** A vertical mowing stripe of the field, in arena units. */
export interface FieldStripe {
  readonly x: number;
  readonly width: number;
  readonly shade: 'light' | 'dark';
}

/** A field line, in arena units. Angles are in radians, clockwise on screen. */
export type FieldMarking =
  | { readonly kind: 'line'; readonly from: Vec2; readonly to: Vec2 }
  | { readonly kind: 'circle'; readonly center: Vec2; readonly radius: number }
  | { readonly kind: 'arc'; readonly center: Vec2; readonly radius: number; readonly start: number; readonly end: number }
  | { readonly kind: 'spot'; readonly center: Vec2; readonly radius: number };

/** Number of mowing stripes across the arena. */
export const FIELD_STRIPE_COUNT = 10;

/** Real pitch proportions in meters (FIFA standard), scaled onto the arena. */
const PITCH = {
  length: 105,
  width: 68,
  centerCircleRadius: 9.15,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  spotRadius: 0.3,
} as const;

/**
 * Equal-width vertical stripes covering the arena, alternating light and dark
 * green like a mown pitch (REQUIREMENTS §5.4).
 */
export function fieldStripes(arena: ArenaDimensions, count = FIELD_STRIPE_COUNT): FieldStripe[] {
  const width = arena.width / count;
  return Array.from({ length: count }, (_, index) => ({
    x: index * width,
    width,
    shade: index % 2 === 0 ? 'light' : 'dark',
  }));
}

/**
 * Field markings of a soccer pitch fitted to the arena (REQUIREMENTS §5.4):
 * halfway line, center circle and spot, and on each side the penalty area,
 * goal area, penalty spot and penalty arc. The touch and goal lines coincide
 * with the arena border, which is drawn separately. Lengths along the field
 * scale with the arena width, across it with the arena height; circles use the
 * smaller of the two scales so they stay round.
 */
export function fieldMarkings(arena: ArenaDimensions): FieldMarking[] {
  const sx = arena.width / PITCH.length;
  const sy = arena.height / PITCH.width;
  const s = Math.min(sx, sy);
  const midX = arena.width / 2;
  const midY = arena.height / 2;
  const circleRadius = PITCH.centerCircleRadius * s;
  const spotRadius = PITCH.spotRadius * s;

  const markings: FieldMarking[] = [
    { kind: 'line', from: { x: midX, y: 0 }, to: { x: midX, y: arena.height } },
    { kind: 'circle', center: { x: midX, y: midY }, radius: circleRadius },
    { kind: 'spot', center: { x: midX, y: midY }, radius: spotRadius },
  ];

  // Penalty arc: the part of the circle around the spot that lies outside the penalty area.
  // Computed in arena units, so its ends meet the penalty area line exactly.
  const arcHalfAngle = Math.acos(((PITCH.penaltyAreaDepth - PITCH.penaltySpotDistance) * sx) / circleRadius);

  for (const end of ['left', 'right'] as const) {
    const goalX = end === 'left' ? 0 : arena.width;
    const inward = end === 'left' ? 1 : -1;
    markings.push(
      ...box(goalX, inward, PITCH.penaltyAreaDepth * sx, PITCH.penaltyAreaWidth * sy, midY),
      ...box(goalX, inward, PITCH.goalAreaDepth * sx, PITCH.goalAreaWidth * sy, midY),
    );
    const spot = { x: goalX + inward * PITCH.penaltySpotDistance * sx, y: midY };
    const facing = end === 'left' ? 0 : Math.PI;
    markings.push(
      { kind: 'spot', center: spot, radius: spotRadius },
      { kind: 'arc', center: spot, radius: circleRadius, start: facing - arcHalfAngle, end: facing + arcHalfAngle },
    );
  }
  return markings;
}

/** The three lines of a box drawn out from the goal line; the fourth side is the goal line itself. */
function box(goalX: number, inward: 1 | -1, depth: number, width: number, midY: number): FieldMarking[] {
  const innerX = goalX + inward * depth;
  const top = midY - width / 2;
  const bottom = midY + width / 2;
  return [
    { kind: 'line', from: { x: goalX, y: top }, to: { x: innerX, y: top } },
    { kind: 'line', from: { x: innerX, y: top }, to: { x: innerX, y: bottom } },
    { kind: 'line', from: { x: innerX, y: bottom }, to: { x: goalX, y: bottom } },
  ];
}
