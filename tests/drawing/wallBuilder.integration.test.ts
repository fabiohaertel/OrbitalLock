import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import type { PointerInput } from '../../src/drawing/drawingSession';
import { wallSegments, type Wall } from '../../src/drawing/wall';
import {
  WallBuilder,
  createWallBuilderOptions,
  type WallBuildOutcome,
} from '../../src/drawing/wallBuilder';
import { FixedTimestep } from '../../src/physics/fixedTimestep';
import type { Orb } from '../../src/physics/orb';
import { stepPhysics } from '../../src/physics/simulation';
import { makeOrb } from '../physics/helpers';

/**
 * Minimal stand-in for the game loop: orbs move with fixed-step physics, the
 * builder is checked after every step, and created walls are added by the caller.
 */
class Harness {
  readonly builder = new WallBuilder(ARENA, createWallBuilderOptions(DEFAULT_GAMEPLAY_CONFIG));
  readonly timestep = new FixedTimestep();
  walls: Wall[] = [];
  outcomes: WallBuildOutcome[] = [];

  constructor(readonly orbs: Orb[]) {}

  frame(seconds = 1 / 60): void {
    this.timestep.advance(seconds, (dt) => {
      stepPhysics(this.orbs, { arena: ARENA, walls: wallSegments(this.walls) }, dt);
      this.record(this.builder.checkOrbContact(this.orbs));
    });
  }

  press(x: number, y: number): void {
    this.builder.begin(input(x, y));
  }

  drag(x: number, y: number): void {
    this.record(this.builder.move(input(x, y), this.orbs));
  }

  release(x: number, y: number): void {
    this.record(this.builder.end(input(x, y), this.orbs, this.walls));
  }

  private record(outcome: WallBuildOutcome | undefined): void {
    if (outcome === undefined) return;
    this.outcomes.push(outcome);
    if (outcome.kind === 'wallCreated') {
      this.walls = [...this.walls, outcome.wall];
    }
  }
}

function input(x: number, y: number): PointerInput {
  return { pointerId: 1, position: { x, y }, isPrimary: true };
}

describe('wall construction with moving orbs (integration)', () => {
  it('cancels a drawing when an orb flies into it, and leaves the arena unchanged', () => {
    // Orb heading up toward a horizontal stroke at y = 300.
    const orb = makeOrb(500, 450, 0, -160, 12);
    const harness = new Harness([orb]);

    harness.press(200, 300);
    for (let x = 210; x <= 800; x += 10) {
      harness.drag(x, 300);
      harness.frame();
    }
    // Hold the pointer still while the orb arrives.
    for (let i = 0; i < 120 && harness.builder.isDrawing; i++) {
      harness.frame();
    }

    expect(harness.outcomes).toEqual([{ kind: 'canceled', reason: 'orbContact', orbId: orb.id }]);
    expect(harness.builder.isDrawing).toBe(false);
    expect(harness.walls).toEqual([]);

    // The canceled path never blocked the orb: it keeps flying upward past y = 300.
    for (let i = 0; i < 30; i++) harness.frame();
    expect(orb.position.y).toBeLessThan(300 - orb.radius);

    // Releasing afterwards does nothing.
    harness.release(800, 300);
    expect(harness.outcomes).toHaveLength(1);
  });

  it('commits a valid wall that orbs then bounce off', () => {
    const orb = makeOrb(500, 450, 0, -160, 12);
    const harness = new Harness([orb]);

    // Draw a horizontal wall across the arena above the orb, quickly enough to finish first.
    harness.press(5, 250);
    for (let x = 50; x <= 1000; x += 50) {
      harness.drag(x, 250);
    }
    harness.release(995, 250);

    expect(harness.outcomes).toHaveLength(1);
    expect(harness.outcomes[0]?.kind).toBe('wallCreated');
    expect(harness.walls).toHaveLength(1);

    for (let i = 0; i < 180; i++) harness.frame();
    expect(orb.position.y).toBeGreaterThanOrEqual(250 + orb.radius - 1e-6);
    expect(orb.velocity.y).toBeGreaterThan(0);
  });

  it('allows drawing again immediately after a canceled attempt', () => {
    const orb = makeOrb(500, 300, 0, 0, 12, { movement: 'stopped' });
    const harness = new Harness([orb]);

    harness.press(400, 300);
    harness.drag(450, 300);
    harness.drag(495, 300);
    expect(harness.outcomes.at(-1)?.kind).toBe('canceled');

    harness.press(100, 100);
    harness.drag(200, 100);
    harness.release(300, 100);
    expect(harness.outcomes.at(-1)?.kind).toBe('wallCreated');
    expect(harness.walls).toHaveLength(1);
  });
});
