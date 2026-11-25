import { describe, expect, it } from 'vitest';
import { ARENA } from '../../src/config/gameConfig';
import { FIELD_STRIPE_COUNT, fieldMarkings, fieldStripes, type FieldMarking } from '../../src/render/soccerField';
import { THEME } from '../../src/render/theme';

function channels(color: number): { r: number; g: number; b: number } {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

function anchorXs(marking: FieldMarking): number[] {
  return marking.kind === 'line' ? [marking.from.x, marking.to.x] : [marking.center.x];
}

describe('soccer field (REQUIREMENTS §5.4)', () => {
  it('uses green field colors', () => {
    for (const color of [THEME.fieldLight, THEME.fieldDark]) {
      const { r, g, b } = channels(color);
      expect(g).toBeGreaterThan(r * 1.5);
      expect(g).toBeGreaterThan(b * 1.5);
    }
    expect(THEME.fieldLight).not.toBe(THEME.fieldDark);
  });

  it('keeps markings faint so they cannot be mistaken for walls', () => {
    expect(THEME.fieldMarkingAlpha).toBeLessThanOrEqual(0.35);
    expect(THEME.fieldMarkingWidth).toBeLessThan(THEME.wallWidth);
  });

  it('covers the arena with alternating stripes and no gaps', () => {
    const stripes = fieldStripes(ARENA);
    expect(stripes).toHaveLength(FIELD_STRIPE_COUNT);
    expect(stripes[0]?.x).toBe(0);
    stripes.forEach((stripe, i) => {
      const next = stripes[i + 1];
      if (next === undefined) return;
      expect(next.x).toBeCloseTo(stripe.x + stripe.width, 9);
      expect(next.shade).not.toBe(stripe.shade);
    });
    const last = stripes[stripes.length - 1];
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBeCloseTo(ARENA.width, 9);
  });

  it('draws a halfway line, center circle, spots and penalty arcs', () => {
    const markings = fieldMarkings(ARENA);
    const mid = { x: ARENA.width / 2, y: ARENA.height / 2 };
    expect(markings).toContainEqual({ kind: 'line', from: { x: mid.x, y: 0 }, to: { x: mid.x, y: ARENA.height } });
    expect(markings.some((m) => m.kind === 'circle' && m.center.x === mid.x && m.center.y === mid.y)).toBe(true);
    expect(markings.filter((m) => m.kind === 'spot')).toHaveLength(3);
    expect(markings.filter((m) => m.kind === 'arc')).toHaveLength(2);
  });

  it('is symmetric about the halfway line', () => {
    const xs = fieldMarkings(ARENA).flatMap(anchorXs);
    for (const x of xs) {
      expect(xs.some((other) => Math.abs(other - (ARENA.width - x)) < 1e-9)).toBe(true);
    }
  });

  it('keeps every marking inside the arena', () => {
    for (const m of fieldMarkings(ARENA)) {
      const points = m.kind === 'line' ? [m.from, m.to] : [m.center];
      for (const p of points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(ARENA.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(ARENA.height);
      }
    }
  });

  it('ends the penalty arc exactly on the penalty area line', () => {
    const markings = fieldMarkings(ARENA);
    const arc = markings.find((m) => m.kind === 'arc' && m.center.x < ARENA.width / 2);
    if (arc?.kind !== 'arc') throw new Error('left penalty arc missing');
    const arcEndX = arc.center.x + arc.radius * Math.cos(arc.end);
    const verticalLineXs = markings.flatMap((m) => (m.kind === 'line' && m.from.x === m.to.x ? [m.from.x] : []));
    expect(verticalLineXs.some((x) => Math.abs(x - arcEndX) < 1e-9)).toBe(true);
  });
});
