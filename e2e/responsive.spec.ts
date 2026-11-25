import { devices, expect, test, type Page } from '@playwright/test';

/**
 * REQUIREMENTS §9 browser scenarios for layout and devices: window resize,
 * orientation change, touch drawing and mobile viewports (Phase 9).
 */

interface LayoutInfo {
  placement: string;
  pixelRatio: number;
  canvas: { width: number; height: number; cssWidth: number; cssHeight: number };
  arenaPage: { x: number; y: number; width: number; height: number };
  hudPage: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
  scroll: { width: number; height: number };
}

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__orbitalLock?.scene.sys.isActive() === true);
}

async function layoutInfo(page: Page): Promise<LayoutInfo> {
  return page.evaluate(() => {
    const hook = window.__orbitalLock;
    const canvas = document.querySelector('canvas');
    if (hook === undefined || canvas === null) throw new Error('game not ready');
    const layout = hook.scene.currentLayout;
    const toPageRect = (r: { x: number; y: number; width: number; height: number }) => {
      const a = hook.canvasToPage({ x: r.x, y: r.y });
      const b = hook.canvasToPage({ x: r.x + r.width, y: r.y + r.height });
      return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
    };
    const bounds = canvas.getBoundingClientRect();
    return {
      placement: layout.hud.placement,
      pixelRatio: layout.pixelRatio,
      canvas: { width: canvas.width, height: canvas.height, cssWidth: bounds.width, cssHeight: bounds.height },
      arenaPage: toPageRect(layout.arenaRect),
      hudPage: toPageRect(layout.hud.rect),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
    };
  });
}

function expectUsableLayout(info: LayoutInfo): void {
  const e = 1;
  // Canvas fills the viewport and nothing scrolls.
  expect(info.canvas.cssWidth).toBeCloseTo(info.viewport.width, 0);
  expect(info.canvas.cssHeight).toBeCloseTo(info.viewport.height, 0);
  expect(info.scroll.width).toBeLessThanOrEqual(info.viewport.width);
  expect(info.scroll.height).toBeLessThanOrEqual(info.viewport.height);
  // Arena fully visible with its proportions; HUD visible and not covering it.
  for (const rect of [info.arenaPage, info.hudPage]) {
    expect(rect.x).toBeGreaterThanOrEqual(-e);
    expect(rect.y).toBeGreaterThanOrEqual(-e);
    expect(rect.x + rect.width).toBeLessThanOrEqual(info.viewport.width + e);
    expect(rect.y + rect.height).toBeLessThanOrEqual(info.viewport.height + e);
  }
  expect(info.arenaPage.width / info.arenaPage.height).toBeCloseTo(1000 / 625, 2);
  const a = info.arenaPage;
  const h = info.hudPage;
  const overlap = a.x < h.x + h.width - e && h.x < a.x + a.width - e && a.y < h.y + h.height - e && h.y < a.y + a.height - e;
  expect(overlap).toBe(false);
}

async function arenaToPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([ax, ay]) => {
    const hook = window.__orbitalLock;
    if (hook === undefined) throw new Error('test hook missing');
    return hook.arenaToPage({ x: ax, y: ay });
  }, [x, y] as const);
}

async function waitForViewport(page: Page, width: number, height: number): Promise<void> {
  await expect
    .poll(async () => {
      const info = await layoutInfo(page);
      return [Math.round(info.canvas.cssWidth), Math.round(info.canvas.cssHeight)];
    })
    .toEqual([width, height]);
}

/** Sends a real touch drag (touchstart / touchmove / touchend) through the Chrome DevTools Protocol. */
async function touchDrag(page: Page, points: readonly { x: number; y: number }[]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const [first, ...rest] = points;
  if (first === undefined) throw new Error('need points');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  for (const point of rest) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('desktop', () => {
  test('Resize the browser window → arena adapts to the available viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // One almost stationary orb, so the wall below can't be canceled by timing.
    await open(page, '?orbs=1&speed=1&seed=5');
    expectUsableLayout(await layoutInfo(page));

    // Commit a wall at x = 300 (or 700, whichever is clear of the orb), then
    // resize: the world must not change, only its placement.
    const orbX = await page.evaluate(() => window.__orbitalLock?.world.orbs[0]?.position.x ?? 0);
    const wallX = Math.abs(orbX - 300) > 100 ? 300 : 700;
    const from = await arenaToPage(page, wallX, 5);
    const to = await arenaToPage(page, wallX, 620);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 15 });
    await page.mouse.up();
    const wallsBefore = await page.evaluate(() => JSON.stringify(window.__orbitalLock?.world.walls));
    expect(JSON.parse(wallsBefore)).toHaveLength(1);

    for (const [width, height] of [
      [800, 600],
      [1600, 900],
      [700, 1000],
    ] as const) {
      await page.setViewportSize({ width, height });
      await waitForViewport(page, width, height);
      const info = await layoutInfo(page);
      expectUsableLayout(info);
      expect(await page.evaluate(() => JSON.stringify(window.__orbitalLock?.world.walls))).toBe(wallsBefore);

      // The wall's arena position maps into the new arena rectangle, at the same relative spot.
      const top = await arenaToPage(page, wallX, 0);
      expect((top.x - info.arenaPage.x) / info.arenaPage.width).toBeCloseTo(wallX / 1000, 2);
      expect(top.y).toBeCloseTo(info.arenaPage.y, 0);
    }
  });

  test('renders at device resolution on high-density screens', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await open(page);
    const info = await layoutInfo(page);
    expect(info.pixelRatio).toBe(2);
    expect(info.canvas.width).toBe(900 * 2);
    expect(info.canvas.height).toBe(600 * 2);
    expectUsableLayout(info);
    await context.close();
  });
});

// Pixel 7 emulation (viewport, 2.625× density, touch, mobile). `defaultBrowserType` is
// dropped because it cannot be set inside a describe block; the project is Chromium anyway.
const { defaultBrowserType: _defaultBrowserType, ...pixel7 } = devices['Pixel 7'];

test.describe('mobile (Pixel 7, touch)', () => {
  test.use(pixel7);

  test('Play on a mobile viewport → HUD and arena stay usable without horizontal scrolling', async ({ page }) => {
    await open(page, '?maxMisses=0&seed=2');
    const info = await layoutInfo(page);
    expect(info.placement).toBe('top');
    expectUsableLayout(info);
    expect(info.pixelRatio).toBe(2); // Pixel 7 is 2.625×, capped at 2.

    const touchAction = await page.evaluate(
      () => getComputedStyle(document.getElementById('game') as HTMLElement).touchAction,
    );
    expect(touchAction).toBe('none');

    // A tap in the arena is a failed drawing; with no misses allowed it ends the game…
    const tap = await arenaToPage(page, 30, 30);
    await page.touchscreen.tap(tap.x, tap.y);
    await expect.poll(() => page.evaluate(() => window.__orbitalLock?.world.status)).toBe('defeat');

    // …and the HUD restart button works with touch.
    const restart = await page.evaluate(() => {
      const hook = window.__orbitalLock;
      if (hook === undefined) throw new Error('test hook missing');
      const button = hook.scene.buttonCenters.restart;
      return hook.canvasToPage(button);
    });
    await page.touchscreen.tap(restart.x, restart.y);
    await expect.poll(() => page.evaluate(() => window.__orbitalLock?.world.status)).toBe('playing');
  });

  test('Draw using touch input → drawing works as expected', async ({ page }) => {
    await open(page, '?orbs=1&speed=1&seed=7');
    const orb = await page.evaluate(() => window.__orbitalLock?.world.orbs[0]?.position);
    if (orb === undefined) throw new Error('no orb');

    // A square around the orb, drawn with one finger.
    const half = 80;
    const clamp = (v: number, hi: number) => Math.min(Math.max(v, 4), hi - 4);
    const corners = [
      [orb.x - half, orb.y - half],
      [orb.x + half, orb.y - half],
      [orb.x + half, orb.y + half],
      [orb.x - half, orb.y + half],
      [orb.x - half + 2, orb.y - half + 2],
    ].map(([x, y]) => [clamp(x ?? 0, 1000), clamp(y ?? 0, 625)] as const);

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < corners.length - 1; i++) {
      const [ax, ay] = corners[i] as readonly [number, number];
      const [bx, by] = corners[i + 1] as readonly [number, number];
      for (let s = 0; s <= 10; s++) {
        points.push(await arenaToPage(page, ax + ((bx - ax) * s) / 10, ay + ((by - ay) * s) / 10));
      }
    }
    await touchDrag(page, points);

    await expect.poll(() => page.evaluate(() => window.__orbitalLock?.world.status)).toBe('victory');
    const walls = await page.evaluate(() => window.__orbitalLock?.world.walls.length);
    expect(walls).toBe(1);
  });

  test('a second finger does not disturb a drawing in progress', async ({ page }) => {
    await open(page, '?orbs=1&speed=1&seed=7');
    const a = await arenaToPage(page, 100, 500);
    const b = await arenaToPage(page, 400, 500);
    const other = await arenaToPage(page, 800, 100);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...a, id: 1 }, { ...other, id: 2 }],
    });
    for (let s = 1; s <= 10; s++) {
      const x = a.x + ((b.x - a.x) * s) / 10;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: a.y, id: 1 }, { ...other, id: 2 }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ ...other, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    const path = await page.evaluate(() => window.__orbitalLock?.world.walls[0]?.path);
    expect(path).toBeDefined();
    for (const point of path ?? []) {
      expect(point.y).toBeCloseTo(500, 0);
    }
  });

  test('Change mobile device orientation → arena adapts to the new dimensions', async ({ page }) => {
    await open(page, '?seed=4');
    const portrait = await layoutInfo(page);
    expect(portrait.placement).toBe('top');

    const size = page.viewportSize();
    if (size === null) throw new Error('no viewport');
    await page.setViewportSize({ width: size.height, height: size.width });
    await waitForViewport(page, size.height, size.width);

    const landscape = await layoutInfo(page);
    expect(landscape.placement).toBe('side');
    expectUsableLayout(landscape);
    expect(landscape.arenaPage.width).toBeGreaterThan(portrait.arenaPage.width);

    await page.setViewportSize(size);
    await waitForViewport(page, size.width, size.height);
    const back = await layoutInfo(page);
    expect(back.placement).toBe('top');
    expect(back.arenaPage.width).toBeCloseTo(portrait.arenaPage.width, 0);
  });
});
