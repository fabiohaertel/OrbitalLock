import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../src/geometry/vector';
import { rollRotation, type Rotation } from '../../src/render/ballOrientation';
import {
  DEFAULT_BALL_ORIENTATION,
  projectBallPatches,
  soccerBallPatches,
  soccerBallSphere,
} from '../../src/render/soccerBall';

function contains(outline: readonly Vec2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i] as Vec2;
    const b = outline[j] as Vec2;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function centroidDistance(outline: readonly Vec2[]): number {
  const sum = outline.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return Math.hypot(sum.x / outline.length, sum.y / outline.length);
}

describe('soccerBallPatches (REQUIREMENTS §5.4)', () => {
  const patches = soccerBallPatches(6);

  it('shows the patches of a classic ball: pentagons and hexagons', () => {
    const pentagons = patches.filter((p) => p.kind === 'pentagon');
    const hexagons = patches.filter((p) => p.kind === 'hexagon');
    // A truncated icosahedron has 12 pentagons and 20 hexagons; about half face the viewer.
    expect(pentagons.length).toBeGreaterThanOrEqual(5);
    expect(pentagons.length).toBeLessThanOrEqual(12);
    expect(hexagons.length).toBeGreaterThanOrEqual(10);
    expect(hexagons.length).toBeLessThanOrEqual(20);
    for (const p of pentagons) expect(p.outline).toHaveLength(5 * 6);
    for (const p of hexagons) expect(p.outline).toHaveLength(6 * 6);
  });

  it('projects every point onto the unit disk', () => {
    for (const patch of patches) {
      for (const point of patch.outline) expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('has a pentagon near the center of the ball', () => {
    const distances = patches.filter((p) => p.kind === 'pentagon').map((p) => centroidDistance(p.outline));
    expect(Math.min(...distances)).toBeLessThan(0.5);
  });

  it('covers the visible face, with black patches covering a realistic share', () => {
    let samples = 0;
    let covered = 0;
    let black = 0;
    for (let y = -0.9; y <= 0.9; y += 0.05) {
      for (let x = -0.9; x <= 0.9; x += 0.05) {
        if (Math.hypot(x, y) > 0.9) continue;
        samples++;
        const hit = patches.find((p) => contains(p.outline, x, y));
        if (hit !== undefined) covered++;
        if (hit?.kind === 'pentagon') black++;
      }
    }
    expect(covered / samples).toBeGreaterThan(0.97);
    expect(black / samples).toBeGreaterThan(0.15);
    expect(black / samples).toBeLessThan(0.45);
  });

  it('is deterministic', () => {
    expect(soccerBallPatches(6)).toEqual(patches);
  });
});

describe('projectBallPatches at any orientation (REQUIREMENTS §5.4 rolling)', () => {
  const sphere = soccerBallSphere(6);
  const patches = soccerBallPatches(6);

  it('has all 32 patches of a truncated icosahedron on the unit sphere', () => {
    expect(sphere.filter((p) => p.kind === 'pentagon')).toHaveLength(12);
    expect(sphere.filter((p) => p.kind === 'hexagon')).toHaveLength(20);
    for (const patch of sphere) {
      for (const p of patch.outline) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 12);
    }
  });

  it('matches soccerBallPatches at the resting orientation', () => {
    expect(projectBallPatches(sphere, DEFAULT_BALL_ORIENTATION)).toEqual(soccerBallPatches(6));
  });

  it('still looks like a full soccer ball after rolling, and the patches have moved', () => {
    let orientation: Rotation = DEFAULT_BALL_ORIENTATION;
    for (let i = 0; i < 7; i++) {
      orientation = rollRotation(orientation, { x: 3.1 * Math.cos(i), y: 2.3 * Math.sin(i * 1.7) }, 1);
      const rolled = projectBallPatches(sphere, orientation);
      for (const patch of rolled) {
        for (const point of patch.outline) expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1 + 1e-9);
      }
      const pentagons = rolled.filter((p) => p.kind === 'pentagon').length;
      expect(pentagons).toBeGreaterThanOrEqual(5);
      expect(pentagons).toBeLessThanOrEqual(12);
      expect(rolled).not.toEqual(patches);
    }
  });

  it('moves the patches in the direction of travel', () => {
    const centroidX = (outline: readonly Vec2[]) => outline.reduce((sum, p) => sum + p.x, 0) / outline.length;
    // The pentagon facing the viewer at rest moves right when the ball rolls right.
    const front = (list: ReturnType<typeof projectBallPatches>) =>
      list.filter((p) => p.kind === 'pentagon').sort((a, b) => centroidDistance(a.outline) - centroidDistance(b.outline))[0];
    const before = front(patches);
    const after = projectBallPatches(sphere, rollRotation(DEFAULT_BALL_ORIENTATION, { x: 0.2, y: 0 }, 1)).find(
      (p) => p.kind === 'pentagon' && centroidDistance(p.outline) < 0.6,
    );
    if (before === undefined || after === undefined) throw new Error('front pentagon missing');
    expect(centroidX(after.outline)).toBeGreaterThan(centroidX(before.outline) + 0.1);
  });
});
