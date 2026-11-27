import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import type { PointerInput } from '../../src/drawing/drawingSession';
import type { Wall } from '../../src/drawing/wall';
import {
  DEFAULT_SNAP_DISTANCE,
  WallBuilder,
  createWallBuilderOptions,
  type WallBuildOutcome,
} from '../../src/drawing/wallBuilder';
import type { Vec2 } from '../../src/geometry/vector';
import type { Orb } from '../../src/physics/orb';
import { makeOrb } from '../physics/helpers';

const options = createWallBuilderOptions(DEFAULT_GAMEPLAY_CONFIG);

function at(x: number, y: number, pointerId = 1): PointerInput {
  return { pointerId, position: { x, y }, isPrimary: true };
}

/** Draws through the given corner points, sampling densely along each leg. */
function draw(
  builder: WallBuilder,
  corners: readonly [number, number][],
  orbs: readonly Orb[] = [],
  walls: readonly Wall[] = [],
): WallBuildOutcome | undefined {
  const [first, ...rest] = corners;
  if (first === undefined) throw new Error('need at least one point');
  builder.begin(at(first[0], first[1]));

  let previous = first;
  for (const corner of rest) {
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      const outcome = builder.move(
        at(previous[0] + (corner[0] - previous[0]) * t, previous[1] + (corner[1] - previous[1]) * t),
        orbs,
      );
      if (outcome !== undefined) return outcome;
    }
    previous = corner;
  }
  return builder.end(at(previous[0], previous[1]), orbs, walls);
}

function expectWall(outcome: WallBuildOutcome | undefined): Wall {
  if (outcome?.kind !== 'wallCreated') {
    throw new Error(`expected a created wall, got ${JSON.stringify(outcome)}`);
  }
  return outcome.wall;
}

function expectPoint(actual: Vec2 | undefined, x: number, y: number): void {
  expect(actual?.x).toBeCloseTo(x, 9);
  expect(actual?.y).toBeCloseTo(y, 9);
}

describe('createWallBuilderOptions', () => {
  it('uses the configured minimum length and default snapping', () => {
    expect(options.drawing.minLength).toBe(DEFAULT_GAMEPLAY_CONFIG.minDrawingLength);
    expect(options.snapDistance).toBe(DEFAULT_SNAP_DISTANCE);
  });

  it('rejects a negative snap distance', () => {
    expect(() => new WallBuilder(ARENA, { ...options, snapDistance: -1 })).toThrow(RangeError);
  });
});

describe('WallBuilder — closed loops (D1)', () => {
  it('creates a closed square around an orb', () => {
    const orb = makeOrb(200, 200, 0, 0, 12);
    const wall = expectWall(
      draw(new WallBuilder(ARENA, options), [[150, 150], [250, 150], [250, 250], [150, 250], [152, 155]], [orb]),
    );
    expect(wall.closed).toBe(true);
    expect(wall.path.at(-1)).toEqual(wall.path[0]);
    expect(wall.selfIntersections).toEqual([]);
  });

  it('creates a closed free-form polygon', () => {
    const wall = expectWall(
      draw(new WallBuilder(ARENA, options), [[300, 100], [420, 160], [380, 300], [260, 260], [305, 108]]),
    );
    expect(wall.closed).toBe(true);
    expect(wall.path.length).toBeGreaterThanOrEqual(5);
  });

  it('records where a path crosses itself (figure-eight)', () => {
    const wall = expectWall(
      draw(new WallBuilder(ARENA, options), [[300, 300], [400, 400], [400, 300], [300, 400], [302, 302]]),
    );
    expect(wall.closed).toBe(true);
    expect(wall.selfIntersections).toHaveLength(1);
    expectPoint(wall.selfIntersections[0], 350, 350);
  });

  it('does not close a straight back-and-forth stroke', () => {
    const wall = expectWall(draw(new WallBuilder(ARENA, options), [[300, 300], [400, 300], [305, 300]]));
    expect(wall.closed).toBe(false);
  });
});

describe('WallBuilder — wall-to-wall and boundary snapping (D1)', () => {
  it('creates a diagonal wall snapped to the arena edges at both ends', () => {
    const wall = expectWall(draw(new WallBuilder(ARENA, options), [[8, 10], [500, 500], [620, 617]]));
    expect(wall.closed).toBe(false);
    expect(wall.startAnchor).toBe('boundary');
    expect(wall.endAnchor).toBe('boundary');
    expectPoint(wall.path[0], 0, 10);
    expectPoint(wall.path.at(-1), 620, ARENA.height);
  });

  it('snaps endpoints onto existing walls', () => {
    const builder = new WallBuilder(ARENA, options);
    const vertical = expectWall(draw(builder, [[500, 5], [500, 620]]));
    const joined = expectWall(draw(builder, [[5, 300], [490, 300]], [], [vertical]));
    expect(joined.startAnchor).toBe('boundary');
    expect(joined.endAnchor).toBe('wall');
    expectPoint(joined.path.at(-1), 500, 300);
  });

  it('leaves far-away endpoints free (a dangling wall is still valid)', () => {
    const wall = expectWall(draw(new WallBuilder(ARENA, options), [[300, 300], [400, 350]]));
    expect(wall.startAnchor).toBe('free');
    expect(wall.endAnchor).toBe('free');
  });

  it('gives each created wall a new id', () => {
    const builder = new WallBuilder(ARENA, options);
    const first = expectWall(draw(builder, [[100, 100], [200, 100]]));
    draw(builder, [[100, 200], [110, 200]]); // too short: no id consumed
    const second = expectWall(draw(builder, [[100, 300], [200, 300]]));
    expect(second.id).toBe(first.id + 1);
  });
});

describe('WallBuilder — drawing safety (REQUIREMENTS §3.7)', () => {
  it('cancels a drawing that passes through an active orb', () => {
    const orb = makeOrb(300, 300, 0, 0, 12);
    const outcome = draw(new WallBuilder(ARENA, options), [[100, 300], [500, 300]], [orb]);
    expect(outcome).toEqual({ kind: 'canceled', reason: 'orbContact', orbId: orb.id });
  });

  it('ignores a click or tap on an active orb: no drawing, no outcome', () => {
    const orb = makeOrb(300, 300, 0, 0, 12);
    const builder = new WallBuilder(ARENA, options);
    builder.begin(at(305, 300));
    expect(builder.checkOrbContact([orb])).toBeUndefined();
    expect(builder.end(at(305, 300), [orb], [])).toBeUndefined();
    expect(builder.isDrawing).toBe(false);
  });

  it('cancels a drawing dragged away from a press on an active orb', () => {
    const orb = makeOrb(300, 300, 0, 0, 12);
    const builder = new WallBuilder(ARENA, options);
    builder.begin(at(305, 300));
    expect(builder.move(at(305, 340), [orb])).toEqual({ kind: 'canceled', reason: 'orbContact', orbId: orb.id });
    expect(builder.isDrawing).toBe(false);
  });

  it('does not cancel a press that has not started drawing when an orb passes over it', () => {
    const orb = makeOrb(100, 100, 0, 0, 12);
    const builder = new WallBuilder(ARENA, options);
    builder.begin(at(100, 100));
    expect(builder.checkOrbContact([orb])).toBeUndefined();
    // The orb moves away, then the player drags: the path starts at the press point.
    orb.position = { x: 400, y: 400 };
    builder.move(at(300, 100), [orb]);
    expect(builder.end(at(300, 100), [orb], [])?.kind).toBe('wallCreated');
  });

  it('cancels when an orb moves into the in-progress path', () => {
    const orb = makeOrb(300, 340, 0, -100, 12);
    const builder = new WallBuilder(ARENA, options);
    builder.begin(at(100, 300));
    builder.move(at(500, 300), [orb]);
    expect(builder.checkOrbContact([orb])).toBeUndefined();

    orb.position = { x: 300, y: 311 };
    expect(builder.checkOrbContact([orb])).toEqual({ kind: 'canceled', reason: 'orbContact', orbId: orb.id });
    expect(builder.isDrawing).toBe(false);
    expect(builder.previewPath).toEqual([]);
  });

  it('allows drawing past captured orbs', () => {
    const captured = makeOrb(300, 300, 0, 0, 12, { capture: 'captured', movement: 'stopped' });
    expect(draw(new WallBuilder(ARENA, options), [[100, 300], [500, 300]], [captured])?.kind).toBe(
      'wallCreated',
    );
  });

  it('rejects a wall whose snapped end would cut through an orb', () => {
    // The stroke stays clear of the orb, but snapping its end to the top edge does not.
    const orb = makeOrb(106, 5, 0, 0, 8);
    const outcome = draw(new WallBuilder(ARENA, options), [[100, 200], [100, 14]], [orb]);
    expect(outcome).toEqual({ kind: 'rejected', reason: 'touchesOrb', orbId: orb.id });
  });

  it('rejects strokes shorter than the minimum length', () => {
    expect(draw(new WallBuilder(ARENA, options), [[100, 100], [120, 100]])).toEqual({
      kind: 'rejected',
      reason: 'tooShort',
    });
  });

  it('discards a press canceled by the browser before it started drawing, without an outcome', () => {
    const builder = new WallBuilder(ARENA, options);
    builder.begin(at(100, 100));
    builder.move(at(103, 100), []);
    expect(builder.cancelInput()).toBeUndefined();
    expect(builder.end(at(300, 100), [], [])).toBeUndefined();
  });

  it('reports a browser input cancel and discards the drawing', () => {
    const builder = new WallBuilder(ARENA, options);
    builder.begin(at(100, 100));
    builder.move(at(300, 100), []);
    expect(builder.cancelInput()).toEqual({ kind: 'canceled', reason: 'inputCanceled' });
    expect(builder.isDrawing).toBe(false);
    expect(builder.cancelInput()).toBeUndefined();
  });

  it('ignores a release from a secondary pointer', () => {
    const builder = new WallBuilder(ARENA, options);
    builder.begin(at(100, 100, 1));
    builder.move(at(300, 100, 1), []);
    expect(builder.end(at(300, 100, 2), [], [])).toBeUndefined();
    expect(builder.isDrawing).toBe(true);
  });

  it('never modifies the wall list it is given', () => {
    const builder = new WallBuilder(ARENA, options);
    const walls: Wall[] = [expectWall(draw(builder, [[500, 5], [500, 620]]))];
    const snapshot = JSON.stringify(walls);
    const orb = makeOrb(300, 300, 0, 0, 12);

    draw(builder, [[100, 300], [490, 300]], [orb], walls); // canceled
    draw(builder, [[100, 100], [110, 100]], [], walls); // too short
    draw(builder, [[100, 400], [490, 400]], [], walls); // created, but not added by the builder

    expect(JSON.stringify(walls)).toBe(snapshot);
    expect(walls).toHaveLength(1);
  });
});

/** Presses and drags through the corner points without releasing. */
function drag(builder: WallBuilder, corners: readonly [number, number][]): void {
  const [first, ...rest] = corners;
  if (first === undefined) throw new Error('need at least one point');
  builder.begin(at(first[0], first[1]));
  let previous = first;
  for (const corner of rest) {
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      builder.move(at(previous[0] + (corner[0] - previous[0]) * t, previous[1] + (corner[1] - previous[1]) * t), []);
    }
    previous = corner;
  }
}

describe('WallBuilder — snap hints for the drawing in progress (REQUIREMENTS §5.4, D1)', () => {
  it('has no hints when not drawing, or for a press that has not started a drawing', () => {
    const builder = new WallBuilder(ARENA, options);
    expect(builder.snapHints([])).toEqual([]);
    builder.begin(at(8, 10));
    expect(builder.snapHints([])).toEqual([]);
  });

  it('shows no hint for ends far from any wall or edge', () => {
    const builder = new WallBuilder(ARENA, options);
    drag(builder, [[300, 300], [400, 350]]);
    expect(builder.snapHints([])).toEqual([]);
  });

  it('marks the ends that would snap onto the arena boundary, where the wall will attach', () => {
    const builder = new WallBuilder(ARENA, options);
    drag(builder, [[8, 10], [500, 500], [620, 617]]);
    const hints = builder.snapHints([]);
    expect(hints).toHaveLength(2);
    expectPoint(hints[0], 0, 10);
    expectPoint(hints[1], 620, ARENA.height);

    const wall = expectWall(builder.end(at(620, 617), [], []));
    expectPoint(wall.path[0], hints[0]?.x ?? NaN, hints[0]?.y ?? NaN);
    expectPoint(wall.path.at(-1), hints[1]?.x ?? NaN, hints[1]?.y ?? NaN);
  });

  it('marks an end that would snap onto an existing wall', () => {
    const builder = new WallBuilder(ARENA, options);
    const vertical = expectWall(draw(builder, [[500, 5], [500, 620]]));
    drag(builder, [[300, 300], [490, 300]]);
    const hints = builder.snapHints([vertical]);
    expect(hints).toHaveLength(1);
    expectPoint(hints[0], 500, 300);
  });

  it('marks the start point when the path would close into a loop', () => {
    const builder = new WallBuilder(ARENA, options);
    drag(builder, [[300, 300], [400, 300], [400, 400], [300, 400], [300, 305]]);
    const hints = builder.snapHints([]);
    expect(hints).toHaveLength(1);
    expectPoint(hints[0], 300, 300);
    expect(expectWall(builder.end(at(300, 305), [], [])).closed).toBe(true);
  });

  it('clears the hints once the drawing ends', () => {
    const builder = new WallBuilder(ARENA, options);
    drag(builder, [[8, 10], [500, 500]]);
    expect(builder.snapHints([])).toHaveLength(1);
    builder.end(at(500, 500), [], []);
    expect(builder.snapHints([])).toEqual([]);
  });
});
