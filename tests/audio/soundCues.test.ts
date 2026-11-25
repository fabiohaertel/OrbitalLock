import { describe, expect, it } from 'vitest';
import { soundCuesFor } from '../../src/audio/soundCues';
import { DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import type { PointerInput } from '../../src/drawing/drawingSession';
import type { Orb } from '../../src/physics/orb';
import { GameWorld, type GameEvent } from '../../src/world/gameWorld';
import { makeOrb } from '../physics/helpers';

function input(x: number, y: number): PointerInput {
  return { pointerId: 1, position: { x, y }, isPrimary: true };
}

function worldWith(orbs: () => Orb[]): GameWorld {
  return new GameWorld({ config: DEFAULT_GAMEPLAY_CONFIG, spawnOrbs: orbs });
}

/** Draws straight legs through the points, closing back to the start when `closed`. */
function draw(world: GameWorld, points: [number, number][], closed = false): GameEvent[] {
  const [first, ...rest] = points;
  if (first === undefined) throw new Error('need points');
  const events = world.pointerDown(input(...first));
  let previous = first;
  for (const point of closed ? [...rest, first] : rest) {
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      events.push(...world.pointerMove(input(previous[0] + (point[0] - previous[0]) * t, previous[1] + (point[1] - previous[1]) * t)));
    }
    previous = point;
  }
  events.push(...world.pointerUp(input(previous[0] + (closed ? 3 : 0), previous[1] + (closed ? 3 : 0))));
  return events;
}

function square(x: number, y: number, size: number): [number, number][] {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ];
}

describe('goal sound cue (REQUIREMENTS §5.5)', () => {
  it('plays when a wall captures an orb', () => {
    const world = worldWith(() => [makeOrb(200, 200, 0, 0, 12), makeOrb(800, 500, 0, 0, 12)]);
    const events = draw(world, square(120, 120, 160), true);
    expect(world.capturedRegions).toHaveLength(1);
    expect(soundCuesFor(events)).toEqual({ kick: false, whistles: 0, goal: true });
  });

  it('plays once for a wall capturing several orbs', () => {
    const world = worldWith(() => [
      makeOrb(180, 180, 0, 0, 12),
      makeOrb(240, 240, 0, 0, 12),
      makeOrb(800, 500, 0, 0, 12),
    ]);
    const events = draw(world, square(120, 120, 180), true);
    const created = events.find((e) => e.kind === 'wallCreated');
    expect(created?.kind === 'wallCreated' ? created.capture.capturedOrbIds : []).toHaveLength(2);
    expect(soundCuesFor(events).goal).toBe(true);
  });

  it('plays for the capture that wins the game', () => {
    const world = worldWith(() => [makeOrb(200, 200, 0, 0, 12)]);
    const events = draw(world, square(120, 120, 160), true);
    expect(events.at(-1)).toEqual({ kind: 'gameOver', status: 'victory' });
    expect(soundCuesFor(events).goal).toBe(true);
  });

  it('does not play when a valid wall captures nothing', () => {
    const world = worldWith(() => [makeOrb(200, 200, 0, 0, 12), makeOrb(800, 500, 0, 0, 12)]);
    // An empty region.
    const empty = draw(world, square(400, 120, 120), true);
    expect(empty.map((e) => e.kind)).toEqual(['wallCreated']);
    expect(soundCuesFor(empty).goal).toBe(false);
    // A region holding an orb but larger than the maximum capture area (D3, D5).
    const tooLarge = draw(world, [[600, 2], [600, 623]]);
    expect(tooLarge.map((e) => e.kind)).toEqual(['wallCreated']);
    expect(world.capturedRegions).toEqual([]);
    expect(soundCuesFor(tooLarge).goal).toBe(false);
  });

  it('does not play for a miss, which whistles instead', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)]);
    const events = draw(world, [[100, 100], [120, 100]]); // too short
    expect(soundCuesFor(events)).toEqual({ kick: false, whistles: 1, goal: false });
  });
});

describe('soundCuesFor', () => {
  it('asks for nothing when nothing happened', () => {
    expect(soundCuesFor([])).toEqual({ kick: false, whistles: 0, goal: false });
  });

  it('plays one kick for all collisions in one batch', () => {
    const collision = { kind: 'collision', collision: { kind: 'boundary', orbId: 1 } } as const;
    expect(soundCuesFor([collision, collision, collision]).kick).toBe(true);
  });
});
