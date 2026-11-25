import type { Polygon } from '../geometry/polygon';
import type { Segment } from '../geometry/segment';
import type { Vec2 } from '../geometry/vector';

/** Distance between neighboring net cords, in arena units. */
export const NET_CORD_SPACING = 14;

/** A region to cover with net: an outline, minus any holes. */
export interface NetArea {
  readonly outline: Polygon;
  readonly holes: readonly Polygon[];
}

/** The two cord directions of a diamond mesh: the two diagonals. */
const DIRECTIONS: readonly Vec2[] = [
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
];

/**
 * Cords of a goal net covering the area (REQUIREMENTS §5.4): two families of
 * parallel diagonal lines, forming diamonds, clipped to the outline and kept
 * out of the holes.
 *
 * Each line is clipped by finding where it crosses the edges of the outline
 * and holes. Sorted along the line, the crossings pair up into the inside
 * pieces (even–odd rule), so concave outlines and holes need no special case.
 * Lines sit on a fixed grid (multiples of `spacing`), so nets of neighboring
 * regions line up. Pure and deterministic.
 */
export function netCords(area: NetArea, spacing = NET_CORD_SPACING): Segment[] {
  const rings = [area.outline, ...area.holes].filter((ring) => ring.length >= 3);
  if (rings.length === 0 || !(spacing > 0)) return [];

  const cords: Segment[] = [];
  for (const direction of DIRECTIONS) {
    const normal = { x: -direction.y, y: direction.x };
    const offsets = rings.flat().map((p) => dot(p, normal));
    const first = Math.ceil(Math.min(...offsets) / spacing);
    const last = Math.floor(Math.max(...offsets) / spacing);
    for (let k = first; k <= last; k++) {
      const offset = k * spacing;
      const crossings = rings.flatMap((ring) => crossingsOf(ring, direction, normal, offset));
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const from = crossings[i] as number;
        const to = crossings[i + 1] as number;
        if (to - from <= 0) continue;
        cords.push({ a: pointOnLine(normal, offset, direction, from), b: pointOnLine(normal, offset, direction, to) });
      }
    }
  }
  return cords;
}

/**
 * Positions along `direction` where the line `p · normal = offset` crosses the
 * ring's edges. Vertices on the line count as being on its positive side, so a
 * line through a vertex is counted once, never twice.
 */
function crossingsOf(ring: Polygon, direction: Vec2, normal: Vec2, offset: number): number[] {
  const result: number[] = [];
  ring.forEach((a, index) => {
    const b = ring[(index + 1) % ring.length] as Vec2;
    const sideA = dot(a, normal) - offset;
    const sideB = dot(b, normal) - offset;
    if (sideA >= 0 === sideB >= 0) return;
    const t = sideA / (sideA - sideB);
    const crossing = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    result.push(dot(crossing, direction));
  });
  return result;
}

function pointOnLine(normal: Vec2, offset: number, direction: Vec2, along: number): Vec2 {
  return { x: normal.x * offset + direction.x * along, y: normal.y * offset + direction.y * along };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}
