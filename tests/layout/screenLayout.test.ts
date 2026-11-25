import { describe, expect, it } from 'vitest';
import { ARENA } from '../../src/config/gameConfig';
import type { Rect } from '../../src/geometry/rect';
import { arenaToScreen, screenToArena } from '../../src/layout/arenaTransform';
import {
  HUD_FIELD_COUNT,
  MIN_TOUCH_TARGET,
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

function contains(outer: Rect, inner: Rect): boolean {
  const e = 1e-6;
  return (
    inner.x >= outer.x - e &&
    inner.y >= outer.y - e &&
    inner.x + inner.width <= outer.x + outer.width + e &&
    inner.y + inner.height <= outer.y + outer.height + e
  );
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
        expect(layout.hud.cards).toHaveLength(HUD_FIELD_COUNT);
        for (const rect of [layout.hud.restart, ...layout.hud.cards]) {
          expect(contains(layout.hud.rect, rect)).toBe(true);
        }
        const { title } = layout.hud;
        expect(title.x).toBeGreaterThanOrEqual(layout.hud.rect.x);
        expect(title.y).toBeGreaterThanOrEqual(layout.hud.rect.y);
        expect(title.y).toBeLessThanOrEqual(layout.hud.rect.y + layout.hud.rect.height);
      });

      it('never overlaps two cards, or a card and the restart button (§5.6)', () => {
        const rects = [layout.hud.restart, ...layout.hud.cards];
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(overlaps(rects[i] as Rect, rects[j] as Rect)).toBe(false);
          }
        }
      });

      it('makes the restart button easy to tap (§7.3)', () => {
        expect(layout.hud.restart.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET * viewport.pixelRatio);
      });

      it('keeps every font at a readable size', () => {
        const r = viewport.pixelRatio;
        expect(layout.hud.labelFontSize).toBeGreaterThanOrEqual(10 * r);
        expect(layout.hud.valueFontSize).toBeGreaterThanOrEqual(14 * r);
        expect(layout.hud.buttonFontSize).toBeGreaterThanOrEqual(12 * r);
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

  it('puts the title, all cards and the button in one bar on desktop', () => {
    const hud = computeLayout(VIEWPORTS['desktop 1280×800'] as Viewport, ARENA).hud;
    const centers = [hud.title.y, hud.restart.y + hud.restart.height / 2, ...hud.cards.map((c) => c.y + c.height / 2)];
    for (const y of centers) expect(y).toBeCloseTo(centers[0] ?? Number.NaN, 9);
    expect(hud.cardStyle).toBe('stacked');
  });

  it('wraps the cards into rows below a header on narrow screens, centering the last row', () => {
    const layout = computeLayout(VIEWPORTS['phone portrait 390×844'] as Viewport, ARENA);
    const rows = new Map<number, Rect[]>();
    for (const card of layout.hud.cards) rows.set(card.y, [...(rows.get(card.y) ?? []), card]);
    expect(rows.size).toBeGreaterThan(1);
    // Every card sits below the button.
    for (const card of layout.hud.cards) {
      expect(card.y).toBeGreaterThanOrEqual(layout.hud.restart.y + layout.hud.restart.height);
    }
    // Each row is centered in the HUD.
    for (const row of rows.values()) {
      const left = Math.min(...row.map((c) => c.x));
      const right = Math.max(...row.map((c) => c.x + c.width));
      expect(left - layout.hud.rect.x).toBeCloseTo(layout.hud.rect.x + layout.hud.rect.width - right, 6);
    }
  });

  it('stacks inline cards of equal width in the side column', () => {
    const hud = computeLayout(VIEWPORTS['phone landscape 844×390'] as Viewport, ARENA).hud;
    expect(hud.cardStyle).toBe('inline');
    expect(new Set(hud.cards.map((c) => c.width)).size).toBe(1);
    expect(new Set(hud.cards.map((c) => c.x)).size).toBe(1);
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
    expect(at2.hud.valueFontSize).toBe(at1.hud.valueFontSize * 2);
    expect(at2.hud.restart.x).toBeCloseTo(at1.hud.restart.x * 2, 9);
    expect(at2.hud.cards[2]?.width).toBeCloseTo((at1.hud.cards[2]?.width ?? 0) * 2, 9);
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
