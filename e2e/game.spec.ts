import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  status: string;
  hud: Record<string, string>;
  overlay: { visible: boolean; title: string };
  orbs: { x: number; y: number; radius: number; capture: string }[];
}

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__orbitalLock?.scene.sys.isActive() === true);
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const hook = window.__orbitalLock;
    if (hook === undefined) throw new Error('test hook missing');
    return {
      status: hook.world.status,
      hud: hook.scene.hudTexts,
      overlay: hook.scene.overlayState,
      orbs: hook.world.orbs.map((orb) => ({
        x: orb.position.x,
        y: orb.position.y,
        radius: orb.radius,
        capture: orb.capture,
      })),
    };
  });
}

/** Page coordinates of a game-canvas point. */
async function canvasToPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([cx, cy]) => {
    const hook = window.__orbitalLock;
    if (hook === undefined) throw new Error('test hook missing');
    return hook.canvasToPage({ x: cx, y: cy });
  }, [x, y] as const);
}

/** Arena coordinates → page coordinates (the arena sits below the HUD). */
async function arenaToPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([ax, ay]) => {
    const hook = window.__orbitalLock;
    if (hook === undefined) throw new Error('test hook missing');
    return hook.arenaToPage({ x: ax, y: ay });
  }, [x, y] as const);
}

async function clickButton(page: Page, which: 'restart' | 'playAgain'): Promise<void> {
  const center = await page.evaluate((name) => {
    const hook = window.__orbitalLock;
    if (hook === undefined) throw new Error('test hook missing');
    return hook.scene.buttonCenters[name];
  }, which);
  const point = await canvasToPage(page, center.x, center.y);
  await page.mouse.click(point.x, point.y);
}

/** Taps inside the arena: a too-short drawing, which counts as a failed attempt. */
async function tapArena(page: Page): Promise<void> {
  const point = await arenaToPage(page, 40, 40);
  await page.mouse.click(point.x, point.y);
}

test('HUD shows the counters, time and score', async ({ page }) => {
  await open(page);
  const initial = await snapshot(page);
  expect(initial.hud).toEqual({
    captured: 'Captured: 0 / 6',
    remaining: 'Remaining: 6',
    time: initial.hud.time,
    score: 'Score: 0',
    misses: 'Misses: 0 / 3',
  });
  // Game time runs in fixed steps and can lag wall-clock time on a busy machine.
  await expect.poll(async () => (await snapshot(page)).hud.time, { timeout: 15_000 }).toBe('Time: 00:02');
});

test('a failed drawing is counted in the HUD', async ({ page }) => {
  await open(page, '?seed=3');
  await tapArena(page);
  await expect.poll(async () => (await snapshot(page)).hud.misses).toBe('Misses: 1 / 3');
});

test('exceeding the failure limit shows the defeat screen, and restart restores the game', async ({ page }) => {
  await open(page, '?maxMisses=1&seed=3');
  await tapArena(page);
  await tapArena(page);

  await expect.poll(async () => (await snapshot(page)).overlay).toEqual({ visible: true, title: 'DEFEAT' });
  expect((await snapshot(page)).status).toBe('defeat');

  await clickButton(page, 'restart');
  const after = await snapshot(page);
  expect(after.status).toBe('playing');
  expect(after.overlay.visible).toBe(false);
  expect(after.hud.misses).toBe('Misses: 0 / 1');
  expect(after.hud.time).toBe('Time: 00:00');
});

test('capturing every orb shows the victory screen, and "Play again" restarts', async ({ page }) => {
  // One almost stationary orb, so a square can be drawn around it reliably.
  await open(page, '?orbs=1&speed=1&seed=7');
  const [orb] = (await snapshot(page)).orbs;
  if (orb === undefined) throw new Error('no orb');

  const half = 70;
  const corners = [
    [orb.x - half, orb.y - half],
    [orb.x + half, orb.y - half],
    [orb.x + half, orb.y + half],
    [orb.x - half, orb.y + half],
    [orb.x - half + 2, orb.y - half + 2],
  ].map(([x, y]) => [Math.min(Math.max(x ?? 0, 2), 998), Math.min(Math.max(y ?? 0, 2), 623)] as const);

  const start = await arenaToPage(page, corners[0]?.[0] ?? 0, corners[0]?.[1] ?? 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [x, y] of corners.slice(1)) {
    const point = await arenaToPage(page, x, y);
    await page.mouse.move(point.x, point.y, { steps: 12 });
  }
  await page.mouse.up();

  await expect.poll(async () => (await snapshot(page)).overlay).toEqual({ visible: true, title: 'VICTORY' });
  const won = await snapshot(page);
  expect(won.status).toBe('victory');
  expect(won.hud.captured).toBe('Captured: 1 / 1');
  expect(won.hud.score).toBe('Score: 100');
  expect(won.orbs[0]?.capture).toBe('captured');

  await clickButton(page, 'playAgain');
  const after = await snapshot(page);
  expect(after.status).toBe('playing');
  expect(after.overlay.visible).toBe(false);
  expect(after.hud.captured).toBe('Captured: 0 / 1');
});
