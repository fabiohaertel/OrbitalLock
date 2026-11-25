import { describe, expect, it } from 'vitest';
import { resolveCaptures } from '../../src/capture/captureSystem';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import type { PointerInput } from '../../src/drawing/drawingSession';
import { wallSegments, type Wall } from '../../src/drawing/wall';
import { WallBuilder, createWallBuilderOptions } from '../../src/drawing/wallBuilder';
import { FixedTimestep } from '../../src/physics/fixedTimestep';
import type { Orb } from '../../src/physics/orb';
import { stepPhysics } from '../../src/physics/simulation';
import { makeOrb } from '../physics/helpers';

function input(x: number, y: number): PointerInput {
  return { pointerId: 1, position: { x, y }, isPrimary: true };
}

/** Draws a closed loop through the corners with the real wall builder, without advancing time. */
function drawLoop(builder: WallBuilder, orbs: readonly Orb[], walls: readonly Wall[], corners: [number, number][]): Wall {
  const [first, ...rest] = corners;
  if (first === undefined) throw new Error('need corners');
  builder.begin(input(...first));
  let previous = first;
  for (const corner of [...rest, first]) {
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      builder.move(input(previous[0] + (corner[0] - previous[0]) * t, previous[1] + (corner[1] - previous[1]) * t), orbs);
    }
    previous = corner;
  }
  const outcome = builder.end(input(first[0] + 3, first[1] + 3), orbs, walls);
  if (outcome?.kind !== 'wallCreated') throw new Error(`wall not created: ${JSON.stringify(outcome)}`);
  return outcome.wall;
}

describe('capture with live physics (integration)', () => {
  it('freezes a captured orb while other orbs keep bouncing off the captured area', () => {
    // `trapped` drifts inside the future square; `free` will fly at the square from the right.
    const trapped = makeOrb(200, 200, 20, 15, 12);
    const free = makeOrb(600, 200, -160, 0, 12);
    const orbs = [trapped, free];
    const builder = new WallBuilder(ARENA, createWallBuilderOptions(DEFAULT_GAMEPLAY_CONFIG));
    const timestep = new FixedTimestep();
    let walls: Wall[] = [];

    const square = drawLoop(builder, orbs, walls, [[120, 120], [280, 120], [280, 280], [120, 280]]);
    walls = [...walls, square];
    const report = resolveCaptures(ARENA, walls, square.id, orbs, DEFAULT_GAMEPLAY_CONFIG);
    expect(report.capturedOrbIds).toEqual([trapped.id]);

    const frozenAt = trapped.position;
    for (let frame = 0; frame < 300; frame++) {
      timestep.advance(1 / 60, (dt) => {
        stepPhysics(orbs, { arena: ARENA, walls: wallSegments(walls) }, dt);
      });
      // The free orb never enters the captured square.
      const insideSquare =
        free.position.x > 120 && free.position.x < 280 && free.position.y > 120 && free.position.y < 280;
      expect(insideSquare).toBe(false);
    }

    expect(trapped.position).toEqual(frozenAt);
    expect(trapped.velocity).toEqual({ x: 0, y: 0 });
    // The free orb hit the square's right side and bounced back.
    expect(free.velocity.x).toBeGreaterThan(0);
    expect(free.position.x).toBeGreaterThan(280);
  });

  it('lets later walls be drawn past captured orbs without capturing them again', () => {
    const trapped = makeOrb(200, 200, 0, 0, 12);
    const other = makeOrb(700, 450, 0, 0, 12);
    const orbs = [trapped, other];
    const builder = new WallBuilder(ARENA, createWallBuilderOptions(DEFAULT_GAMEPLAY_CONFIG));
    let walls: Wall[] = [];

    const first = drawLoop(builder, orbs, walls, [[150, 150], [250, 150], [250, 250], [150, 250]]);
    walls = [...walls, first];
    expect(resolveCaptures(ARENA, walls, first.id, orbs, DEFAULT_GAMEPLAY_CONFIG).capturedOrbIds).toEqual([
      trapped.id,
    ]);

    // A second loop around both the captured square and nothing active: no new capture.
    const second = drawLoop(builder, orbs, walls, [[100, 100], [320, 100], [320, 320], [100, 320]]);
    walls = [...walls, second];
    const report = resolveCaptures(ARENA, walls, second.id, orbs, DEFAULT_GAMEPLAY_CONFIG);
    expect(report.capturedOrbIds).toEqual([]);

    // Then capture the other orb.
    const third = drawLoop(builder, orbs, walls, [[650, 400], [750, 400], [750, 500], [650, 500]]);
    walls = [...walls, third];
    expect(resolveCaptures(ARENA, walls, third.id, orbs, DEFAULT_GAMEPLAY_CONFIG).capturedOrbIds).toEqual([
      other.id,
    ]);
    expect(orbs.every((orb) => orb.capture === 'captured')).toBe(true);
  });
});
