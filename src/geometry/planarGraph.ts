import { intersectSegments, type Segment } from './segment';
import { signedPolygonArea, type Polygon } from './polygon';
import { DEFAULT_EPSILON } from './tolerance';
import { distanceSquared, dot, subtract, type Vec2 } from './vector';

/** A segment fed into the graph, tagged with the wall it came from (undefined for arena edges). */
export interface GraphSegment {
  readonly segment: Segment;
  readonly wallId: number | undefined;
}

/**
 * A face of the planar graph: a closed walk along its edges.
 *
 * Faces are traced so that bounded faces have a positive `signedArea` (see
 * `signedPolygonArea`). Each connected group of edges also produces one face
 * with negative area: the walk around its outside.
 */
export interface Face {
  readonly polygon: Polygon;
  readonly signedArea: number;
  /** Walls whose edges this face's boundary runs along. */
  readonly wallIds: ReadonlySet<number>;
}

interface Edge {
  readonly from: number;
  readonly to: number;
  readonly wallIds: Set<number>;
}

/**
 * Builds the planar graph formed by the segments and returns its faces.
 *
 * - Segments are split wherever they cross or touch, so free-form paths that
 *   cross walls, the arena edges or themselves are all handled the same way.
 * - Points closer than `epsilon` are merged into one vertex.
 * - Dangling edges (chains of walls that enclose nothing) are removed first, so
 *   loose wall ends never produce false regions.
 */
export function extractFaces(
  segments: readonly GraphSegment[],
  epsilon = DEFAULT_EPSILON,
): Face[] {
  const vertices = new VertexIndex(epsilon);
  const edges = buildEdges(segments, vertices, epsilon);
  pruneDanglingEdges(edges, vertices.count);
  return traceFaces(edges, vertices.positions);
}

/** Merges points within `epsilon` using a hash grid. */
class VertexIndex {
  readonly positions: Vec2[] = [];
  private readonly cells = new Map<string, number[]>();
  private readonly cellSize: number;
  private readonly epsilonSq: number;

  constructor(epsilon: number) {
    this.cellSize = Math.max(epsilon, 1e-12) * 2;
    this.epsilonSq = epsilon * epsilon;
  }

  get count(): number {
    return this.positions.length;
  }

  idFor(point: Vec2): number {
    const cx = Math.floor(point.x / this.cellSize);
    const cy = Math.floor(point.y / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const id of this.cells.get(`${String(cx + dx)},${String(cy + dy)}`) ?? []) {
          if (distanceSquared(this.positions[id] as Vec2, point) <= this.epsilonSq) {
            return id;
          }
        }
      }
    }
    const id = this.positions.length;
    this.positions.push(point);
    const key = `${String(cx)},${String(cy)}`;
    const cell = this.cells.get(key);
    if (cell === undefined) {
      this.cells.set(key, [id]);
    } else {
      cell.push(id);
    }
    return id;
  }
}

function buildEdges(
  segments: readonly GraphSegment[],
  vertices: VertexIndex,
  epsilon: number,
): Map<string, Edge> {
  // Every point where each segment must be split: its ends plus all contacts.
  const splitPoints: Vec2[][] = segments.map(({ segment }) => [segment.a, segment.b]);
  // Bounding boxes (grown by epsilon) let most far-apart pairs skip the exact test.
  const boxes = segments.map(({ segment: { a, b } }) => ({
    minX: Math.min(a.x, b.x) - epsilon,
    maxX: Math.max(a.x, b.x) + epsilon,
    minY: Math.min(a.y, b.y) - epsilon,
    maxY: Math.max(a.y, b.y) + epsilon,
  }));

  for (let i = 0; i < segments.length; i++) {
    const box = boxes[i] as (typeof boxes)[number];
    for (let j = i + 1; j < segments.length; j++) {
      const other = boxes[j] as (typeof boxes)[number];
      if (
        box.maxX < other.minX ||
        other.maxX < box.minX ||
        box.maxY < other.minY ||
        other.maxY < box.minY
      ) {
        continue;
      }
      const hit = intersectSegments(
        (segments[i] as GraphSegment).segment,
        (segments[j] as GraphSegment).segment,
        epsilon,
      );
      if (hit.kind === 'point') {
        splitPoints[i]?.push(hit.point);
        splitPoints[j]?.push(hit.point);
      } else if (hit.kind === 'overlap') {
        splitPoints[i]?.push(hit.start, hit.end);
        splitPoints[j]?.push(hit.start, hit.end);
      }
    }
  }

  const edges = new Map<string, Edge>();
  segments.forEach(({ segment, wallId }, index) => {
    const direction = subtract(segment.b, segment.a);
    const ordered = (splitPoints[index] ?? [])
      .map((point) => ({ point, t: dot(subtract(point, segment.a), direction) }))
      .sort((p, q) => p.t - q.t);

    let previous: number | undefined;
    for (const { point } of ordered) {
      const id = vertices.idFor(point);
      if (previous !== undefined && previous !== id) {
        addEdge(edges, previous, id, wallId);
      }
      previous = id;
    }
  });
  return edges;
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`;
}

function addEdge(edges: Map<string, Edge>, a: number, b: number, wallId: number | undefined): void {
  const key = edgeKey(a, b);
  let edge = edges.get(key);
  if (edge === undefined) {
    edge = { from: Math.min(a, b), to: Math.max(a, b), wallIds: new Set() };
    edges.set(key, edge);
  }
  if (wallId !== undefined) {
    edge.wallIds.add(wallId);
  }
}

/** Repeatedly removes edges with an end of degree 1 (dangling chains). */
function pruneDanglingEdges(edges: Map<string, Edge>, vertexCount: number): void {
  const incident: Set<string>[] = Array.from({ length: vertexCount }, () => new Set<string>());
  for (const [key, edge] of edges) {
    incident[edge.from]?.add(key);
    incident[edge.to]?.add(key);
  }

  const queue: number[] = [];
  incident.forEach((keys, vertex) => {
    if (keys.size === 1) queue.push(vertex);
  });

  for (let vertex = queue.pop(); vertex !== undefined; vertex = queue.pop()) {
    const keys = incident[vertex];
    if (keys?.size !== 1) continue;
    const [key] = keys;
    if (key === undefined) continue;
    const edge = edges.get(key);
    if (edge === undefined) continue;

    edges.delete(key);
    const other = edge.from === vertex ? edge.to : edge.from;
    keys.delete(key);
    const otherKeys = incident[other];
    otherKeys?.delete(key);
    if (otherKeys?.size === 1) queue.push(other);
  }
}

/**
 * Walks every directed edge once. Leaving vertex `v` after arriving from `u`,
 * the walk takes the outgoing edge that comes just before `v→u` in angular
 * order, which keeps each bounded face on the walk's positive-area side.
 */
function traceFaces(edges: Map<string, Edge>, positions: readonly Vec2[]): Face[] {
  const neighbors = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    const list = neighbors.get(a);
    if (list === undefined) neighbors.set(a, [b]);
    else list.push(b);
  };
  for (const edge of edges.values()) {
    link(edge.from, edge.to);
    link(edge.to, edge.from);
  }

  const angleFrom = (origin: number, target: number) => {
    const o = positions[origin] as Vec2;
    const t = positions[target] as Vec2;
    return Math.atan2(t.y - o.y, t.x - o.x);
  };
  for (const [vertex, list] of neighbors) {
    list.sort((a, b) => angleFrom(vertex, a) - angleFrom(vertex, b));
  }

  const visited = new Set<string>();
  const faces: Face[] = [];

  for (const edge of edges.values()) {
    for (const [start, next] of [
      [edge.from, edge.to],
      [edge.to, edge.from],
    ] as const) {
      if (visited.has(`${String(start)}>${String(next)}`)) continue;

      const polygon: Vec2[] = [];
      const wallIds = new Set<number>();
      let u = start;
      let v = next;
      while (!visited.has(`${String(u)}>${String(v)}`)) {
        visited.add(`${String(u)}>${String(v)}`);
        polygon.push(positions[u] as Vec2);
        for (const id of edges.get(edgeKey(u, v))?.wallIds ?? []) wallIds.add(id);

        const around = neighbors.get(v) ?? [];
        const back = around.indexOf(u);
        const w = around[(back - 1 + around.length) % around.length] as number;
        u = v;
        v = w;
      }

      faces.push({ polygon, signedArea: signedPolygonArea(polygon), wallIds });
    }
  }
  return faces;
}
