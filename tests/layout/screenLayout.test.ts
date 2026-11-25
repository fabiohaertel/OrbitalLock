import { describe, expect, it } from 'vitest';
import { ARENA } from '../../src/config/gameConfig';
import type { Rect } from '../../src/geometry/rect';
import { arenaToScreen, screenToArena } from '../../src/layout/arenaTransform';
import {
  HUD_FIELD_COUNT,
  computeLayout,
  type ScreenLayout,
  type Viewport,
} from '../../src/layout/screenLayout';
import { MAX_PIXEL_RATIO, capPixelRatio } from '../../src/layout/viewport';

const VIEWPORTS: Record<string, Viewport> = {
  'desktop 1280×800': { width: 1280, height: 800, pixelRatio: 1 },
  'desktop 1920×1080 @2x': { width: 1920, height: 1080, pixelRatio: 2 },
  'tablet portrait 768×1024': { width: 768, height: 1024, pixelRatio: 2 },
  'tablet landscape 1024×768': { width: 1024, height: 768, pixelRatio: 2 },
  'phone portrait 390×844': { width: 390, height: 844, pixelRatio: 2 },
  'phone landscape 844×390': { width: 844, height: 390, pixelRatio: 2 },
  'small phone portrait 320×568': { width: 320, height: 568, pixelRatio: 2 },
  'very short window 900×200': { width: 900, height: 200, pixelRatio: 1 },
};

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(inner: Rect, layout: ScreenLayout): boolean {
  const e = 1e-6;
  return (
    inner.x >= -e &&
    inner.y >= -e &&
    inner.x + inner.width <= layout.canvasWidth + e &&
    inner.y + inner.height <= layout.canvasHeight + e
  );
}

describe('computeLayout — every viewport', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    describe(name, () => {
      const layout = computeLayout(viewport, ARENA);

      it('fills the viewport at device resolution', () => {
        expect(layout.canvasWidth).toBe(viewport.width * viewport.pixelRatio);
        expect(layout.canvasHeight).toBe(viewport.height * viewport.pixelRatio);
        expect(layout.pixelRatio).toBe(viewport.pixelRatio);
      });

      it('keeps the arena inside the viewport with its proportions (no scrolling, D6)', () => {
        expect(inside(layout.arenaRect, layout)).toBe(true);
        expect(layout.arenaRect.width / layout.arenaRect.height).toBeCloseTo(ARENA.width / ARENA.height, 9);
        expect(layout.arenaRect.width).toBeCloseTo(ARENA.width * layout.arena.scale, 9);
      });

      it('keeps the HUD inside the viewport and off the arena (§5.3)', () => {
        expect(inside(layout.hud.rect, layout)).toBe(true);
        expect(overlaps(layout.hud.rect, layout.arenaRect)).toBe(false);
        expect(layout.hud.fields).toHaveLength(HUD_FIELD_COUNT);
        for (const anchor of [layout.hud.title, layout.hud.restart, ...layout.hud.fields]) {
          expect(anchor.x).toBeGreaterThanOrEqual(layout.hud.rect.x);
          expect(anchor.x).toBeLessThanOrEqual(layout.hud.rect.x + layout.hud.rect.width);
          expect(anchor.y).toBeGreaterThanOrEqual(layout.hud.rect.y);
          expect(anchor.y).toBeLessThanOrEqual(layout.hud.rect.y + layout.hud.rect.height);
        }
      });

      it('maps arena corners onto the arena rectangle and back', () => {
        const corner = arenaToScreen({ x: ARENA.width, y: ARENA.height }, layout.arena);
        expect(corner.x).toBeCloseTo(layout.arenaRect.x + layout.arenaRect.width, 6);
        expect(corner.y).toBeCloseTo(layout.arenaRect.y + layout.arenaRect.height, 6);
        const back = screenToArena(corner, layout.arena);
        expect(back.x).toBeCloseTo(ARENA.width, 6);
        expect(back.y).toBeCloseTo(ARENA.height, 6);
      });
    });
  }
});

describe('computeLayout — HUD placement', () => {
  it('puts the HUD on top on desktop and in portrait', () => {
    expect(computeLayout(VIEWPORTS['desktop 1280×800'] as Viewport, ARENA).hud.placement).toBe('top');
    expect(computeLayout(VIEWPORTS['phone portrait 390×844'] as Viewport, ARENA).hud.placement).toBe('top');
  });

  it('puts the HUD at the side on landscape phones, where that gives a larger arena', () => {
    const viewport = VIEWPORTS['phone landscape 844×390'] as Viewport;
    const layout = computeLayout(viewport, ARENA);
    expect(layout.hud.placement).toBe('side');
    expect(layout.hud.rect.x + layout.hud.rect.width).toBeLessThanOrEqual(layout.arenaRect.x);
  });

  it('falls back to the top HUD when the window is too short for the side column', () => {
    expect(computeLayout(VIEWPORTS['very short window 900×200'] as Viewport, ARENA).hud.placement).toBe('top');
  });

  it('wraps HUD fields into more rows on narrow screens', () => {
    const wide = computeLayout(VIEWPORTS['desktop 1280×800'] as Viewport, ARENA).hud;
    const narrow = computeLayout(VIEWPORTS['phone portrait 390×844'] as Viewport, ARENA).hud;
    const rows = (fields: readonly { y: number }[]) => new Set(fields.map((f) => f.y)).size;
    expect(rows(wide.fields)).toBe(1);
    expect(rows(narrow.fields)).toBeGreaterThan(1);
  });

  it('switches placement when a phone is rotated, keeping the arena proportions', () => {
    const portrait = computeLayout({ width: 390, height: 844, pixelRatio: 3 }, ARENA);
    const landscape = computeLayout({ width: 844, height: 390, pixelRatio: 3 }, ARENA);
    expect(portrait.hud.placement).toBe('top');
    expect(landscape.hud.placement).toBe('side');
    expect(landscape.arena.scale).toBeGreaterThan(portrait.arena.scale);
  });
});

describe('computeLayout — pixel density', () => {
  it('scales every size by the pixel ratio and nothing else', () => {
    const at1 = computeLayout({ width: 844, height: 390, pixelRatio: 1 }, ARENA);
    const at2 = computeLayout({ width: 844, height: 390, pixelRatio: 2 }, ARENA);
    expect(at2.arena.scale).toBeCloseTo(at1.arena.scale * 2, 9);
    expect(at2.arena.offsetX).toBeCloseTo(at1.arena.offsetX * 2, 9);
    expect(at2.hud.fieldFontSize).toBe(at1.hud.fieldFontSize * 2);
    expect(at2.hud.restart.x).toBeCloseTo(at1.hud.restart.x * 2, 9);
  });

  it('maps the same CSS position to the same arena point at any pixel ratio', () => {
    const cssPoint = { x: 500, y: 300 };
    const points = [1, 1.5, 2].map((r) => {
      const layout = computeLayout({ width: 1280, height: 800, pixelRatio: r }, ARENA);
      return screenToArena({ x: cssPoint.x * r, y: cssPoint.y * r }, layout.arena);
    });
    for (const point of points) {
      expect(point.x).toBeCloseTo(points[0]?.x ?? Number.NaN, 9);
      expect(point.y).toBeCloseTo(points[0]?.y ?? Number.NaN, 9);
    }
  });
});

describe('capPixelRatio', () => {
  it.each([
    [1, 1],
    [1.5, 1.5],
    [2, 2],
    [3, MAX_PIXEL_RATIO],
    [0.5, 1],
    [Number.NaN, 1],
    [0, 1],
  ])('maps %s to %s', (input, expected) => {
    expect(capPixelRatio(input)).toBe(expected);
  });
});

describe('arenaToScreen', () => {
  it('is the inverse of screenToArena', () => {
    const transform = { offsetX: 12, offsetY: 72, scale: 1.7 };
    const point = { x: 345.5, y: 123.25 };
    const back = screenToArena(arenaToScreen(point, transform), transform);
    expect(back.x).toBeCloseTo(point.x, 9);
    expect(back.y).toBeCloseTo(point.y, 9);
  });
});
