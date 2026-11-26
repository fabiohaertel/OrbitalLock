/**
 * REQUIREMENTS §9 acceptance scenarios that do not need a browser, run against
 * the headless GameWorld. Resize, orientation, touch hardware and mobile layout
 * are covered by browser tests in later phases.
 */
import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG, type GameplayConfig } from '../../src/config/gameConfig';
import type { PointerInput } from '../../src/drawing/drawingSession';
import { levelConfig } from '../../src/game/levels';
import { createProgress } from '../../src/game/progress';
import type { Orb } from '../../src/physics/orb';
import { createSeededRandom } from '../../src/physics/random';
import { createOrbs } from '../../src/physics/spawn';
import { GameWorld, type GameEvent } from '../../src/world/gameWorld';
import { makeOrb } from '../physics/helpers';

function input(x: number, y: number, pointerId = 1): PointerInput {
  return { pointerId, position: { x, y }, isPrimary: true };
}

/** Every level uses the given config as is, so a scenario's limits do not change with the level. */
const sameConfigEveryLevel = (_level: number, base: GameplayConfig): GameplayConfig => base;

/** World with hand-placed orbs (fresh copies on every restart and level). */
function worldWith(orbs: () => Orb[], config: Partial<GameplayConfig> = {}): GameWorld {
  return new GameWorld({
    config: { ...DEFAULT_GAMEPLAY_CONFIG, ...config },
    levelConfig: sameConfigEveryLevel,
    spawnOrbs: orbs,
  });
}

/** Draws through the points (closing back to the start when `closed`) with no time passing. */
function draw(world: GameWorld, points: [number, number][], closed = false): GameEvent[] {
  const [first, ...rest] = points;
  if (first === undefined) throw new Error('need points');
  const events = world.pointerDown(input(...first));
  let previous = first;
  for (const point of closed ? [...rest, first] : rest) {
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      events.push(
        ...world.pointerMove(
          input(previous[0] + (point[0] - previous[0]) * t, previous[1] + (point[1] - previous[1]) * t),
        ),
      );
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

/** A started drawing shorter than the minimum length: rejected, so a foul (D3). */
function foulDrawing(world: GameWorld): GameEvent[] {
  return [
    ...world.pointerDown(input(100, 100)),
    ...world.pointerMove(input(110, 100)),
    ...world.pointerUp(input(120, 100)),
  ];
}

/** Press and release in place, without moving the pointer. */
function click(world: GameWorld, x: number, y: number): GameEvent[] {
  return [...world.pointerDown(input(x, y)), ...world.pointerUp(input(x, y))];
}

function run(world: GameWorld, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) events.push(...world.update(1 / 60));
  return events;
}

describe('§9 acceptance (headless)', () => {
  it('Draw a closed square around an orb → orb is captured', () => {
    const world = worldWith(() => [makeOrb(200, 200, 20, 10, 12), makeOrb(800, 500, 0, 0, 12)]);
    const events = draw(world, square(120, 120, 160), true);
    const created = events.find((e) => e.kind === 'wallCreated');
    expect(created?.kind === 'wallCreated' && created.capture.capturedOrbIds).toEqual([world.orbs[0]?.id]);
    expect(world.orbs[0]?.capture).toBe('captured');
    expect(world.progress.capturedOrbs).toBe(1);
    expect(world.capturedRegions).toHaveLength(1);
  });

  it('Draw a closed polygon around an orb → orb is captured', () => {
    const world = worldWith(() => [makeOrb(340, 200, 0, 0, 12), makeOrb(800, 500, 0, 0, 12)]);
    draw(world, [[300, 100], [420, 160], [380, 300], [260, 260]], true);
    expect(world.orbs[0]?.capture).toBe('captured');
  });

  it('Draw a diagonal wall → wall is created if valid', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)]);
    const events = draw(world, [[8, 10], [300, 300], [500, 617]]);
    expect(events.map((e) => e.kind)).toEqual(['wallCreated']);
    expect(world.walls).toHaveLength(1);
    expect(world.progress.failedAttempts).toBe(0);
  });

  it('Draw a region larger than the maximum area → capture is rejected (not a failed attempt)', () => {
    const world = worldWith(() => [makeOrb(250, 300, 0, 0, 12), makeOrb(800, 300, 0, 0, 12)]);
    const events = draw(world, [[500, 8], [500, 617]]);
    const created = events.find((e) => e.kind === 'wallCreated');
    if (created?.kind !== 'wallCreated') throw new Error('expected a wall');
    expect(created.capture.capturedOrbIds).toEqual([]);
    expect(created.capture.evaluations.map((e) => e.verdict).sort()).toEqual(['tooLarge', 'tooLarge']);
    expect(world.progress.capturedOrbs).toBe(0);
    expect(world.progress.failedAttempts).toBe(0);
    expect(world.walls).toHaveLength(1);
  });

  it('Draw a region containing no active orbs → no capture occurs', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)]);
    draw(world, square(100, 100, 100), true);
    expect(world.progress.capturedOrbs).toBe(0);
    expect(world.progress.score).toBe(0);
    expect(world.capturedRegions).toEqual([]);
  });

  it('Draw through an active orb → drawing is rejected', () => {
    const world = worldWith(() => [makeOrb(300, 300, 0, 0, 12)]);
    const events = draw(world, [[100, 300], [500, 300]]);
    expect(events[0]).toMatchObject({ kind: 'attemptFailed', attempt: { kind: 'canceled', reason: 'orbContact' } });
    expect(world.walls).toEqual([]);
    expect(world.progress.failedAttempts).toBe(1);
  });

  it('Orb hits a wall during construction → drawing is canceled', () => {
    const world = worldWith(() => [makeOrb(500, 450, 0, -160, 12)]);
    world.pointerDown(input(200, 300));
    for (let x = 210; x <= 800; x += 10) world.pointerMove(input(x, 300));
    const events = run(world, 2);

    expect(events).toEqual([
      { kind: 'attemptFailed', attempt: { kind: 'canceled', reason: 'orbContact', orbId: world.orbs[0]?.id } },
    ]);
    expect(world.isDrawing).toBe(false);
    expect(world.walls).toEqual([]);
    expect(world.progress.failedAttempts).toBe(1);
  });

  it('Capture all orbs of a level → the level is cleared with its bonus', () => {
    const world = worldWith(() => [makeOrb(200, 200, 0, 0, 12), makeOrb(700, 400, 0, 0, 12)]);
    expect(draw(world, square(150, 150, 100), true).some((e) => e.kind === 'levelComplete')).toBe(false);
    const events = draw(world, square(650, 350, 100), true);

    // Level 1, no fouls used of 3, no time passed: 500 + 3 × 200 + 60 × 10 (D11).
    const bonus = { level: 500, fouls: 600, time: 600, total: 1700 };
    expect(events.at(-1)).toEqual({ kind: 'levelComplete', level: 1, bonus });
    expect(world.status).toBe('levelComplete');
    expect(world.progress.levelBonus).toEqual(bonus);
    expect(world.progress.score).toBe(200 + 1700);

    // Level cleared: the clock stops and input is ignored until the next level.
    const time = world.progress.elapsedSeconds;
    run(world, 1);
    expect(world.progress.elapsedSeconds).toBe(time);
    expect(draw(world, [[100, 500], [300, 500]])).toEqual([]);
  });

  it('Exceed the failure limit → defeat is triggered', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)], { maxFailedAttempts: 2 });
    expect(foulDrawing(world)).toHaveLength(1);
    expect(foulDrawing(world)).toHaveLength(1);
    expect(world.status).toBe('playing');
    const events = foulDrawing(world);
    expect(events.map((e) => e.kind)).toEqual(['attemptFailed', 'gameOver']);
    expect(events.at(-1)).toEqual({ kind: 'gameOver', status: 'defeat' });
    expect(world.progress.failedAttempts).toBe(3);
  });

  it('Click or tap the arena without moving the pointer → nothing is drawn and no foul is counted', () => {
    const world = worldWith(() => [makeOrb(300, 300, 0, 0, 12)], { maxFailedAttempts: 0 });
    // Even with no fouls allowed, clicks never end the game.
    expect(click(world, 100, 100)).toEqual([]);
    expect(click(world, 305, 300)).toEqual([]); // on an orb
    // Jitter smaller than the start distance is still a click.
    expect([
      ...world.pointerDown(input(500, 200)),
      ...world.pointerMove(input(503, 202)),
      ...world.pointerUp(input(502, 197)),
    ]).toEqual([]);
    expect(world.status).toBe('playing');
    expect(world.progress.failedAttempts).toBe(0);
    expect(world.walls).toEqual([]);
    expect(world.isDrawing).toBe(false);
  });

  it('Start drawing, then release short → the drawing is rejected as a foul', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)]);
    expect(foulDrawing(world)).toEqual([
      { kind: 'attemptFailed', attempt: { kind: 'rejected', reason: 'tooShort' } },
    ]);
    expect(world.progress.failedAttempts).toBe(1);
  });

  it('Attempt to draw outside the arena → drawing is constrained to arena boundaries', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)]);
    world.pointerDown(input(100, 100));
    world.pointerMove(input(-300, 100));
    world.pointerMove(input(-300, -300));
    for (const point of world.previewPath) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeGreaterThanOrEqual(0);
    }
    world.pointerUp(input(-300, -300));
    for (const point of world.walls[0]?.path ?? []) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(ARENA.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(ARENA.height);
    }
    // Pressing outside the arena does not start a drawing at all.
    expect(world.pointerDown(input(-50, 100))).toEqual([]);
    expect(world.isDrawing).toBe(false);
  });

  it('Restart the game → initial game state is restored', () => {
    const seed = 2026;
    const world = new GameWorld({
      spawnOrbs: (config, arena) => createOrbs(config, arena, createSeededRandom(seed)),
    });
    const initialOrbs = structuredClone(world.orbs);
    const initialProgress = world.progress;

    run(world, 1);
    draw(world, [[8, 300], [992, 300]]);
    foulDrawing(world); // failed attempt
    expect(world.progress).not.toEqual(initialProgress);

    world.restart();
    expect(world.orbs).toEqual(initialOrbs);
    expect(world.progress).toEqual(initialProgress);
    expect(world.walls).toEqual([]);
    expect(world.capturedRegions).toEqual([]);
    expect(world.isDrawing).toBe(false);
  });

  it('Restart after defeat → play resumes', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)], { maxFailedAttempts: 0 });
    foulDrawing(world);
    expect(world.status).toBe('defeat');
    world.restart();
    expect(world.status).toBe('playing');
    expect(draw(world, [[100, 100], [300, 100]]).map((e) => e.kind)).toEqual(['wallCreated']);
  });
});

describe('GameWorld details', () => {
  it('counts a browser input cancel as a failed attempt (D3, D8)', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)]);
    world.pointerDown(input(100, 100));
    world.pointerMove(input(200, 100));
    expect(world.pointerCancel().map((e) => e.kind)).toEqual(['attemptFailed']);
    expect(world.progress.failedAttempts).toBe(1);
  });

  it('does not count a browser cancel before the drawing started (D8)', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)]);
    world.pointerDown(input(100, 100));
    expect(world.pointerCancel()).toEqual([]);
    expect(world.progress.failedAttempts).toBe(0);
  });

  it('does not cancel a press that has not started drawing when an orb passes over it', () => {
    const world = worldWith(() => [makeOrb(100, 160, 0, -160, 12)]);
    world.pointerDown(input(100, 100));
    expect(run(world, 0.5).filter((e) => e.kind === 'attemptFailed')).toEqual([]);
    expect(world.pointerUp(input(100, 100))).toEqual([]);
  });

  it('tracks elapsed time in fixed steps, independent of frame rate', () => {
    const at30 = worldWith(() => [makeOrb(500, 300, 100, 50, 12)]);
    const at144 = worldWith(() => [makeOrb(500, 300, 100, 50, 12)]);
    for (let i = 0; i < 60; i++) at30.update(1 / 30);
    for (let i = 0; i < 288; i++) at144.update(1 / 144);
    expect(at30.progress.elapsedSeconds).toBeCloseTo(2, 6);
    expect(at144.progress.elapsedSeconds).toBeCloseTo(2, 6);
    expect(at30.orbs[0]?.position.x).toBeCloseTo(at144.orbs[0]?.position.x ?? Number.NaN, 6);
  });

  it("uses the level config's number of orbs by default", () => {
    const world = new GameWorld({
      config: { ...DEFAULT_GAMEPLAY_CONFIG, initialOrbCount: 4 },
      levelConfig: sameConfigEveryLevel,
    });
    expect(world.orbs).toHaveLength(4);
    expect(world.progress.totalOrbs).toBe(4);
  });

  it('keeps orbs bouncing off committed walls', () => {
    const world = worldWith(() => [makeOrb(500, 450, 0, -160, 12)]);
    draw(world, [[8, 250], [992, 250]]);
    run(world, 3);
    expect(world.orbs[0]?.position.y).toBeGreaterThanOrEqual(250 + 12 - 1e-6);
  });
});

describe('collision events (REQUIREMENTS §5.5)', () => {
  it('reports a collision when an orb bounces off the arena boundary', () => {
    const world = worldWith(() => [makeOrb(500, 40, 0, -160, 12)]);
    const collisions = run(world, 0.5).filter((e) => e.kind === 'collision');
    expect(collisions).toEqual([{ kind: 'collision', collision: { kind: 'boundary', orbId: world.orbs[0]?.id } }]);
  });

  it('reports a collision when an orb bounces off a wall', () => {
    const world = worldWith(() => [makeOrb(500, 400, 0, -160, 12)]);
    expect(draw(world, [[8, 300], [992, 300]])[0]?.kind).toBe('wallCreated');
    const collisions = run(world, 1).filter((e) => e.kind === 'collision');
    expect(collisions).toEqual([{ kind: 'collision', collision: { kind: 'wall', orbId: world.orbs[0]?.id } }]);
  });

  it('reports a collision when two orbs bounce off each other', () => {
    const world = worldWith(() => [makeOrb(400, 300, 160, 0, 12), makeOrb(600, 300, -160, 0, 12)]);
    const collisions = run(world, 1).filter((e) => e.kind === 'collision');
    expect(collisions).toEqual([
      { kind: 'collision', collision: { kind: 'orb', orbIds: [world.orbs[0]?.id, world.orbs[1]?.id] } },
    ]);
  });

  it('reports no collisions while orbs move freely', () => {
    const world = worldWith(() => [makeOrb(500, 300, 100, 0, 12)]);
    expect(run(world, 1)).toEqual([]);
  });

  it('touching the in-progress drawing cancels it but is not a collision', () => {
    const world = worldWith(() => [makeOrb(500, 450, 0, -160, 12)]);
    world.pointerDown(input(200, 300));
    for (let x = 210; x <= 800; x += 10) world.pointerMove(input(x, 300));
    expect(run(world, 1.5).map((e) => e.kind)).toEqual(['attemptFailed']);
  });

  it('reports no collisions once the game is over', () => {
    const world = worldWith(() => [makeOrb(500, 40, 0, -160, 12)], { maxFailedAttempts: 0 });
    foulDrawing(world);
    expect(world.status).toBe('defeat');
    expect(run(world, 1)).toEqual([]);
  });
});

describe('level progression (D10)', () => {
  /** `config.initialOrbCount` still orbs in a row, so each can be captured by a small square. */
  const rowOfOrbs = (config: GameplayConfig): Orb[] =>
    Array.from({ length: config.initialOrbCount }, (_, i) => makeOrb(60 + i * 58, 200, 0, 0, 12));

  /** Captures every orb of the level, one small square each. */
  function clearLevel(world: GameWorld): GameEvent[] {
    return world.orbs.flatMap((orb) => draw(world, square(orb.position.x - 25, orb.position.y - 25, 50), true));
  }

  it('ignores nextLevel while playing and after a defeat', () => {
    const world = worldWith(() => [makeOrb(800, 500, 0, 0, 12)], { maxFailedAttempts: 0 });
    expect(world.nextLevel()).toBe(false);
    expect(world.level).toBe(1);
    foulDrawing(world);
    expect(world.status).toBe('defeat');
    expect(world.nextLevel()).toBe(false);
    expect(world.level).toBe(1);
  });

  it("starts the next level with an empty arena and that level's config", () => {
    const world = new GameWorld({ spawnOrbs: rowOfOrbs });
    expect(world.level).toBe(1);
    expect(world.config).toEqual(levelConfig(1, DEFAULT_GAMEPLAY_CONFIG));
    expect(world.orbs).toHaveLength(3);

    foulDrawing(world);
    run(world, 2);
    clearLevel(world);
    expect(world.status).toBe('levelComplete');
    const cleared = world.progress;

    expect(world.nextLevel()).toBe(true);
    expect(world.status).toBe('playing');
    expect(world.level).toBe(2);
    expect(world.config).toEqual(levelConfig(2, DEFAULT_GAMEPLAY_CONFIG));
    expect(world.orbs).toHaveLength(4);
    expect(world.orbs.every((orb) => orb.capture === 'active')).toBe(true);
    expect(world.walls).toEqual([]);
    expect(world.capturedRegions).toEqual([]);
    expect(world.isDrawing).toBe(false);
    expect(world.progress).toEqual({
      status: 'playing',
      level: 2,
      totalOrbs: 4,
      capturedOrbs: 0,
      failedAttempts: 0,
      score: cleared.score,
      elapsedSeconds: 0,
      totalSeconds: cleared.totalSeconds,
      levelBonus: undefined,
    });
    // Only once per cleared level.
    expect(world.nextLevel()).toBe(false);
    expect(world.level).toBe(2);
  });

  it('plays through levels 1 → 3, accumulating score and total time', () => {
    const world = new GameWorld({ spawnOrbs: rowOfOrbs });
    let expectedScore = 0;
    for (let level = 1; level <= 3; level++) {
      expect(world.level).toBe(level);
      expect(world.orbs).toHaveLength(levelConfig(level, DEFAULT_GAMEPLAY_CONFIG).initialOrbCount);
      run(world, 70); // past the time bonus
      const done = clearLevel(world).at(-1);
      expect(done?.kind).toBe('levelComplete');
      const bonus = done?.kind === 'levelComplete' ? done.bonus : undefined;
      // No fouls used: every allowed foul earns its bonus; no time bonus after 60 s.
      const fouls = levelConfig(level, DEFAULT_GAMEPLAY_CONFIG).maxFailedAttempts;
      expect(bonus).toEqual({ level: 500 * level, fouls: 200 * fouls, time: 0, total: 500 * level + 200 * fouls });
      expectedScore += world.orbs.length * 100 * level + (bonus?.total ?? 0);
      expect(world.progress.score).toBe(expectedScore);
      expect(world.progress.totalSeconds).toBeCloseTo(70 * level, 6);
      expect(world.nextLevel()).toBe(true);
    }
    expect(world.level).toBe(4);
  });

  it('resets fouls every level and loses on the current level', () => {
    const world = new GameWorld({ spawnOrbs: rowOfOrbs });
    foulDrawing(world);
    foulDrawing(world);
    clearLevel(world);
    world.nextLevel();
    expect(world.progress.failedAttempts).toBe(0);

    // Level 2 allows 4 fouls: the fifth loses, on level 2.
    for (let i = 0; i < 4; i++) foulDrawing(world);
    expect(world.status).toBe('playing');
    expect(foulDrawing(world).at(-1)).toEqual({ kind: 'gameOver', status: 'defeat' });
    expect(world.level).toBe(2);
    expect(world.progress.score).toBeGreaterThan(0);
  });

  it('restart goes back to level 1 with a score of 0, from any level', () => {
    const world = new GameWorld({ spawnOrbs: rowOfOrbs });
    clearLevel(world);
    world.nextLevel();
    clearLevel(world);
    world.nextLevel();
    expect(world.level).toBe(3);

    world.restart();
    expect(world.level).toBe(1);
    expect(world.config).toEqual(levelConfig(1, DEFAULT_GAMEPLAY_CONFIG));
    expect(world.orbs).toHaveLength(3);
    expect(world.progress).toEqual(createProgress(3));
    expect(world.walls).toEqual([]);
  });

  it('can start a new game at another level (development)', () => {
    const world = new GameWorld({ spawnOrbs: rowOfOrbs, firstLevel: 5 });
    expect(world.level).toBe(5);
    expect(world.orbs).toHaveLength(7);
    clearLevel(world);
    world.nextLevel();
    world.restart();
    expect(world.level).toBe(5);
    expect(world.progress.score).toBe(0);
  });
});
