import { extractFaces, type Face, type GraphSegment } from './planarGraph';
import { locatePointInPolygon, type Polygon } from './polygon';
import type { Segment } from './segment';
import { DEFAULT_EPSILON } from './tolerance';
import type { Vec2 } from './vector';

/** Anything with an id and a polyline path, e.g. a committed `Wall`. */
export interface RegionWall {
  readonly id: number;
  readonly path: readonly Vec2[];
}

/**
 * An enclosed region of the arena (REQUIREMENTS §3.5): the area bounded by
 * walls and arena edges, minus any islands (closed wall groups floating
 * inside it, which form regions of their own).
 */
export interface Region {
  /** Outer boundary. */
  readonly outline: Polygon;
  /** Boundaries of islands inside the outline, excluded from this region. */
  readonly holes: readonly Polygon[];
  /** Outline area minus hole areas, in square arena units. */
  readonly area: number;
  /** Walls bounding this region, including island walls. */
  readonly wallIds: ReadonlySet<number>;
}

export interface ArenaSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Divides the arena into enclosed regions using the walls and arena edges.
 *
 * Every point of the arena not on a wall belongs to exactly one region, so the
 * region areas always add up to the arena area. Walls that enclose nothing
 * (loose ends) do not affect the result. Regions may be any polygonal shape.
 */
export function detectRegions(
  arena: ArenaSize,
  walls: readonly RegionWall[],
  epsilon = DEFAULT_EPSILON,
): Region[] {
  const faces = extractFaces(collectSegments(arena, walls), epsilon);

  const bounded = faces.filter((face) => face.signedArea > epsilon);
  // Each connected group of edges yields one negative "outside" face. The most
  // negative one runs around the arena itself; the others are island outlines.
  const outsides = faces
    .filter((face) => face.signedArea < -epsilon)
    .sort((a, b) => a.signedArea - b.signedArea);
  const islandOutlines = outsides.slice(1);

  const holesByFace = new Map<Face, Face[]>();
  for (const island of islandOutlines) {
    const container = smallestContainingFace(island, bounded, epsilon);
    if (container !== undefined) {
      const holes = holesByFace.get(container);
      if (holes === undefined) holesByFace.set(container, [island]);
      else holes.push(island);
    }
  }

  return bounded.map((face) => {
    const holes = holesByFace.get(face) ?? [];
    const wallIds = new Set(face.wallIds);
    for (const hole of holes) {
      for (const id of hole.wallIds) wallIds.add(id);
    }
    return {
      outline: face.polygon,
      holes: holes.map((hole) => hole.polygon),
      area: face.signedArea - holes.reduce((sum, hole) => sum + Math.abs(hole.signedArea), 0),
      wallIds,
    };
  });
}

/** True when the point lies strictly inside the region (not on a wall, not in a hole). */
export function regionContainsPoint(region: Region, point: Vec2, epsilon = DEFAULT_EPSILON): boolean {
  return (
    locatePointInPolygon(point, region.outline, epsilon) === 'inside' &&
    region.holes.every((hole) => locatePointInPolygon(point, hole, epsilon) === 'outside')
  );
}

/**
 * Items (e.g. orbs) whose position lies inside the region. Callers decide which
 * items to pass, e.g. only active orbs.
 */
export function itemsInRegion<T extends { readonly position: Vec2 }>(
  region: Region,
  items: readonly T[],
): T[] {
  return items.filter((item) => regionContainsPoint(region, item.position));
}

/** Regions whose boundary includes the given wall, i.e. the regions it created or reshaped. */
export function regionsBoundedByWall(regions: readonly Region[], wallId: number): Region[] {
  return regions.filter((region) => region.wallIds.has(wallId));
}

function collectSegments(arena: ArenaSize, walls: readonly RegionWall[]): GraphSegment[] {
  const corners: Vec2[] = [
    { x: 0, y: 0 },
    { x: arena.width, y: 0 },
    { x: arena.width, y: arena.height },
    { x: 0, y: arena.height },
  ];
  const segments: GraphSegment[] = corners.map((a, i) => ({
    segment: { a, b: corners[(i + 1) % corners.length] as Vec2 },
    wallId: undefined,
  }));

  for (const wall of walls) {
    for (let i = 1; i < wall.path.length; i++) {
      const segment: Segment = { a: wall.path[i - 1] as Vec2, b: wall.path[i] as Vec2 };
      segments.push({ segment, wallId: wall.id });
    }
  }
  return segments;
}

/** The bounded face of smallest area that strictly contains the island outline. */
function smallestContainingFace(
  island: Face,
  candidates: readonly Face[],
  epsilon: number,
): Face | undefined {
  const probe = island.polygon[0];
  if (probe === undefined) return undefined;

  let best: Face | undefined;
  for (const face of candidates) {
    if (
      locatePointInPolygon(probe, face.polygon, epsilon) === 'inside' &&
      (best === undefined || face.signedArea < best.signedArea)
    ) {
      best = face;
    }
  }
  return best;
}
