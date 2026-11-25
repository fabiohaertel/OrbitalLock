import { describe, expect, it } from 'vitest';
import type { Orb } from '../../src/physics/orb';
import { BallMotion, DEFAULT_BALL_MOTION_OPTIONS } from '../../src/render/ballMotion';
import { rollRotation, type Rotation } from '../../src/render/ballOrientation';
import { DEFAULT_BALL_ORIENTATION } from '../../src/render/soccerBall';
import { makeOrb } from '../physics/helpers';

const { trailSeconds, ghostCount, maxAlpha, tailRadiusRatio } = DEFAULT_BALL_MOTION_OPTIONS;

/** Moves the orb in a straight line over `frames` rendered frames of `seconds` each. */
function run(motion: BallMotion, orb: Orb, frames: number, seconds = 1 / 60): void {
  for (let i = 0; i < frames; i++) {
    orb.position = { x: orb.position.x + orb.velocity.x * seconds, y: orb.position.y + orb.velocity.y * seconds };
    motion.update([orb]);
  }
}

function expectRotation(actual: Rotation, expected: Rotation, digits = 9): void {
  actual.forEach((value, index) => { expect(value).toBeCloseTo(expected[index] as number, digits); });
}

describe('BallMotion rolling (REQUIREMENTS §5.4)', () => {
  it('starts at the resting orientation and rolls by the distance travelled', () => {
    const motion = new BallMotion();
    const orb = makeOrb(100, 100, 120, -50, 12);
    motion.update([orb]);
    expect(motion.orientation(orb)).toBe(DEFAULT_BALL_ORIENTATION);

    run(motion, orb, 30);
    const travelled = { x: 120 * 0.5, y: -50 * 0.5 };
    expectRotation(motion.orientation(orb), rollRotation(DEFAULT_BALL_ORIENTATION, travelled, 12));
  });

  it('does not depend on the frame rate', () => {
    const slow = new BallMotion();
    const fast = new BallMotion();
    const a = makeOrb(100, 100, 160, 40, 12);
    const b = makeOrb(100, 100, 160, 40, 12);
    slow.update([a]);
    fast.update([b]);
    run(slow, a, 30, 1 / 30);
    run(fast, b, 144, 1 / 144);
    expectRotation(slow.orientation(a), fast.orientation(b));
    const slowTrail = slow.trail(a);
    const fastTrail = fast.trail(b);
    expect(fastTrail).toHaveLength(slowTrail.length);
    fastTrail.forEach((ghost, index) => {
      expect(ghost.position.x).toBeCloseTo(slowTrail[index]?.position.x ?? Number.NaN, 9);
      expect(ghost.position.y).toBeCloseTo(slowTrail[index]?.position.y ?? Number.NaN, 9);
    });
  });

  it('keeps the orientation of a ball that stops (captured or game over) and does not roll it further', () => {
    const motion = new BallMotion();
    const orb = makeOrb(100, 100, 160, 0, 12);
    motion.update([orb]);
    run(motion, orb, 20);
    const atCapture = motion.orientation(orb);
    orb.capture = 'captured';
    motion.update([orb]);
    motion.update([orb]);
    expect(motion.orientation(orb)).toBe(atCapture);
  });

  it('starts fresh for the new orbs of a restart', () => {
    const motion = new BallMotion();
    const orb = makeOrb(100, 100, 160, 0, 12);
    motion.update([orb]);
    run(motion, orb, 20);
    const restarted = makeOrb(100, 100, 160, 0, 12);
    motion.update([restarted]);
    expect(motion.orientation(restarted)).toBe(DEFAULT_BALL_ORIENTATION);
    expect(motion.trail(restarted)).toEqual([]);
  });
});

describe('BallMotion trail (REQUIREMENTS §5.4 motion blur)', () => {
  it('has no trail before the ball moves', () => {
    const motion = new BallMotion();
    const orb = makeOrb(100, 100, 160, 0, 12);
    expect(motion.trail(orb)).toEqual([]);
    motion.update([orb]);
    expect(motion.trail(orb)).toEqual([]);
  });

  it('streaks behind a moving ball, fading and narrowing towards its end', () => {
    const motion = new BallMotion();
    const orb = makeOrb(100, 100, 160, 0, 12);
    motion.update([orb]);
    run(motion, orb, 30);
    const trail = motion.trail(orb);
    expect(trail).toHaveLength(ghostCount);

    const length = 160 * trailSeconds;
    trail.forEach((ghost, index) => {
      expect(ghost.position.y).toBeCloseTo(100, 9);
      expect(orb.position.x - ghost.position.x).toBeCloseTo((length * (index + 1)) / ghostCount, 9);
    });
    expect(trail[0]?.alpha).toBeCloseTo(maxAlpha, 9);
    expect(trail[ghostCount - 1]?.radius).toBeCloseTo(12 * tailRadiusRatio, 9);
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i]?.alpha).toBeLessThan(trail[i - 1]?.alpha ?? 0);
      expect(trail[i]?.radius).toBeLessThan(trail[i - 1]?.radius ?? 0);
      expect(trail[i]?.alpha).toBeGreaterThan(0);
    }
  });

  it('is proportional to speed', () => {
    const lengthAt = (speed: number) => {
      const motion = new BallMotion();
      const orb = makeOrb(100, 100, 0, speed, 12);
      motion.update([orb]);
      run(motion, orb, 60);
      const trail = motion.trail(orb);
      return orb.position.y - (trail[trail.length - 1]?.position.y ?? orb.position.y);
    };
    expect(lengthAt(100)).toBeCloseTo(100 * trailSeconds, 9);
    expect(lengthAt(300)).toBeCloseTo(3 * lengthAt(100), 9);
  });

  it('is shorter while the ball has not yet travelled the full trail length', () => {
    const motion = new BallMotion();
    const orb = makeOrb(100, 100, 160, 0, 12);
    motion.update([orb]);
    run(motion, orb, 4); // about 11 units: less than half the trail length
    const trail = motion.trail(orb);
    expect(trail.length).toBeGreaterThan(0);
    expect(trail.length).toBeLessThan(ghostCount);
    for (const ghost of trail) expect(ghost.position.x).toBeGreaterThanOrEqual(100);
  });

  it('bends around a bounce instead of extending through the wall', () => {
    const wallX = 200;
    const motion = new BallMotion();
    const orb = makeOrb(wallX - 12 - 160 * 0.2, 100, 160, 0, 12);
    motion.update([orb]);
    run(motion, orb, 12); // reaches the wall (x = wallX - radius)
    orb.velocity = { x: -160, y: 0 };
    run(motion, orb, 3); // just bounced back
    const trail = motion.trail(orb);
    expect(trail).toHaveLength(ghostCount);
    for (const ghost of trail) expect(ghost.position.x).toBeLessThanOrEqual(wallX - 12 + 1e-9);
    // The far end of the trail lies before the bounce point, on the way in.
    expect(trail[ghostCount - 1]?.position.x).toBeLessThan(wallX - 12);
  });

  it('disappears when the ball is captured or stops', () => {
    const motion = new BallMotion();
    const captured = makeOrb(100, 100, 160, 0, 12);
    const stopped = makeOrb(100, 200, 160, 0, 12);
    motion.update([captured, stopped]);
    run(motion, captured, 20);
    run(motion, stopped, 20);
    captured.capture = 'captured';
    stopped.movement = 'stopped';
    motion.update([captured, stopped]);
    expect(motion.trail(captured)).toEqual([]);
    expect(motion.trail(stopped)).toEqual([]);
  });
});
