import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../src/geometry/vector';
import { DANGER_WARN_DISTANCE, previewDanger } from '../../src/render/drawingHints';
import { makeOrb } from '../physics/helpers';

const path: Vec2[] = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
];
const RADIUS = 12;

/** Danger with one active ball whose edge is `gap` units below the path. */
function dangerAtGap(gap: number): number {
  return previewDanger(path, [makeOrb(200, 100 + RADIUS + gap, 0, 0, RADIUS)]);
}

describe('previewDanger: the drawing heats up as a ball gets close (REQUIREMENTS §5.4)', () => {
  it('is 0 when every ball is at least the warning distance away', () => {
    expect(dangerAtGap(DANGER_WARN_DISTANCE)).toBe(0);
    expect(dangerAtGap(DANGER_WARN_DISTANCE * 3)).toBe(0);
    expect(previewDanger(path, [])).toBe(0);
  });

  it('is 1 when a ball touches the path', () => {
    expect(dangerAtGap(0)).toBe(1);
    expect(dangerAtGap(-5)).toBe(1);
  });

  it('rises steadily as the ball approaches', () => {
    const values = [50, 40, 30, 20, 10, 1].map(dangerAtGap);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1] ?? Infinity);
    expect(dangerAtGap(DANGER_WARN_DISTANCE / 2)).toBeCloseTo(0.5, 9);
  });

  it('follows the closest ball, measured to the nearest point of the path, including its ends', () => {
    const far = makeOrb(200, 300, 0, 0, RADIUS);
    const nearEnd = makeOrb(300 + RADIUS + 15, 100, 0, 0, RADIUS);
    expect(previewDanger(path, [far, nearEnd])).toBeCloseTo(1 - 15 / DANGER_WARN_DISTANCE, 9);
  });

  it('ignores captured balls', () => {
    const captured = makeOrb(200, 100, 0, 0, RADIUS, { capture: 'captured', movement: 'stopped' });
    expect(previewDanger(path, [captured])).toBe(0);
  });

  it('handles a single-point path and an empty path', () => {
    expect(previewDanger([{ x: 0, y: 0 }], [makeOrb(RADIUS + 30, 0, 0, 0, RADIUS)])).toBeCloseTo(0.5, 9);
    expect(previewDanger([], [makeOrb(0, 0, 0, 0, RADIUS)])).toBe(0);
  });
});
