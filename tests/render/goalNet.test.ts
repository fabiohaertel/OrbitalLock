import { describe, expect, it } from 'vitest';
import { locatePointInPolygon, polygonArea, type Polygon } from '../../src/geometry/polygon';
import type { Segment } from '../../src/geometry/segment';
import { vec, type Vec2 } from '../../src/geometry/vector';
import { NET_CORD_SPACING, netCords } from '../../src/render/goalNet';

function square(x: number, y: number, size: number): Polygon {
  return [vec(x, y), vec(x + size, y), vec(x + size, y + size), vec(x, y + size)];
}

function midpoint(cord: Segment): Vec2 {
  return { x: (cord.a.x + cord.b.x) / 2, y: (cord.a.y + cord.b.y) / 2 };
}

function totalLength(cords: readonly Segment[]): number {
  return cords.reduce((sum, c) => sum + Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y), 0);
}

/** A diamond mesh with two families of lines `spacing` apart has total cord length ≈ 2 × area / spacing. */
function expectedLength(area: number, spacing = NET_CORD_SPACING): number {
  return (2 * area) / spacing;
}

describe('netCords (REQUIREMENTS §5.4)', () => {
  it('covers a square with diagonal cords in both directions', () => {
    const outline = square(100, 100, 200);
    const cords = netCords({ outline, holes: [] });
    const slopes = new Set(cords.map((c) => Math.sign((c.b.y - c.a.y) / (c.b.x - c.a.x))));
    expect(slopes).toEqual(new Set([1, -1]));
    for (const cord of cords) {
      expect(Math.abs(Math.abs(cord.b.x - cord.a.x) - Math.abs(cord.b.y - cord.a.y))).toBeLessThan(1e-9);
    }
    expect(totalLength(cords)).toBeCloseTo(expectedLength(polygonArea(outline)), -2);
  });

  it('keeps every cord inside the region', () => {
    const outline = square(100, 100, 200);
    for (const cord of netCords({ outline, holes: [] })) {
      for (const p of [cord.a, cord.b]) {
        expect(locatePointInPolygon(p, outline)).not.toBe('outside');
      }
    }
  });

  it('leaves holes (uncaptured islands) without net', () => {
    const outline = square(0, 0, 300);
    const hole = square(100, 100, 80);
    const cords = netCords({ outline, holes: [hole] });
    for (const cord of cords) {
      expect(locatePointInPolygon(midpoint(cord), hole)).toBe('outside');
    }
    const area = polygonArea(outline) - polygonArea(hole);
    expect(totalLength(cords)).toBeCloseTo(expectedLength(area), -2);
  });

  it('clips to concave outlines', () => {
    // U shape: the notch must stay empty.
    const u: Polygon = [vec(0, 0), vec(60, 0), vec(60, 140), vec(140, 140), vec(140, 0), vec(200, 0), vec(200, 200), vec(0, 200)];
    const cords = netCords({ outline: u, holes: [] });
    expect(cords.length).toBeGreaterThan(0);
    for (const cord of cords) {
      expect(locatePointInPolygon(midpoint(cord), u)).toBe('inside');
    }
    expect(totalLength(cords)).toBeCloseTo(expectedLength(polygonArea(u)), -2);
  });

  it('handles cords passing exactly through corners', () => {
    // Corners sit on grid lines: each diagonal touches vertices without producing stray cords.
    const outline = square(0, 0, NET_CORD_SPACING * 10);
    const cords = netCords({ outline, holes: [] });
    for (const cord of cords) {
      expect(locatePointInPolygon(midpoint(cord), outline)).not.toBe('outside');
    }
    expect(totalLength(cords)).toBeCloseTo(expectedLength(polygonArea(outline)), -2);
  });

  it('places cords on a fixed grid, so nets of neighboring regions line up', () => {
    const left = netCords({ outline: square(13, 7, 90), holes: [] });
    const right = netCords({ outline: square(103, 7, 90), holes: [] });
    for (const cord of [...left, ...right]) {
      const slope = Math.sign((cord.b.y - cord.a.y) / (cord.b.x - cord.a.x));
      // Lines are x − y = c or x + y = c, with c a multiple of spacing × √2.
      const c = slope > 0 ? cord.a.x - cord.a.y : cord.a.x + cord.a.y;
      const steps = c / (NET_CORD_SPACING * Math.SQRT2);
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    }
  });

  it('returns nothing for degenerate input', () => {
    expect(netCords({ outline: [vec(0, 0), vec(10, 10)], holes: [] })).toEqual([]);
    expect(netCords({ outline: square(0, 0, 100), holes: [] }, 0)).toEqual([]);
  });

  it('is deterministic', () => {
    const area = { outline: square(50, 60, 120), holes: [square(80, 90, 30)] };
    expect(netCords(area)).toEqual(netCords(area));
  });
});
