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

/** Clicks inside the arena without moving: no drawing starts, so it is not a miss (REQUIREMENTS §3.3). */
async function tapArena(page: Page): Promise<void> {
  const point = await arenaToPage(page, 40, 40);
  await page.mouse.click(point.x, point.y);
}

/** Starts a drawing and releases it after 20 units: too short, so it counts as a miss (D3). */
async function shortStroke(page: Page): Promise<void> {
  const start = await arenaToPage(page, 40, 40);
  const end = await arenaToPage(page, 60, 40);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
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
  await shortStroke(page);
  await expect.poll(async () => (await snapshot(page)).hud.misses).toBe('Misses: 1 / 3');
});

test('clicking the arena without drawing is not a miss', async ({ page }) => {
  await open(page, '?maxMisses=0&seed=3');
  await tapArena(page);
  await tapArena(page);
  const after = await snapshot(page);
  expect(after.hud.misses).toBe('Misses: 0 / 0');
  expect(after.status).toBe('playing');
  expect(await page.evaluate(() => window.__orbitalLock?.scene.missWhistlesPlayed)).toBe(0);
});

test('exceeding the failure limit shows the defeat screen, and restart restores the game', async ({ page }) => {
  await open(page, '?maxMisses=1&seed=3');
  await shortStroke(page);
  await shortStroke(page);

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
  // A captured ball no longer moves, so it has no motion-blur trail (REQUIREMENTS §5.4).
  expect(await page.evaluate(() => window.__orbitalLock?.scene.ballVisuals[0]?.trailGhosts)).toBe(0);
  // The capture that won the game played the goal sound once (REQUIREMENTS §5.5).
  expect(await page.evaluate(() => window.__orbitalLock?.scene.goalSoundsPlayed)).toBe(1);

  await clickButton(page, 'playAgain');
  const after = await snapshot(page);
  expect(after.status).toBe('playing');
  expect(after.overlay.visible).toBe(false);
  expect(after.hud.captured).toBe('Captured: 0 / 1');
});

test('the arena is a green soccer field and orbs are drawn as soccer balls', async ({ page }) => {
  await open(page, '?orbs=2&speed=1&seed=3');
  const result = await page.evaluate(async () => {
    const hook = window.__orbitalLock;
    if (hook === undefined) throw new Error('test hook missing');
    const scene = hook.scene;
    const shadings = scene.children.list
      .filter((child): child is Phaser.GameObjects.Container => child.type === 'Container')
      .flatMap((container) => container.list)
      .filter((child): child is Phaser.GameObjects.Image => child.type === 'Image');
    const arena = scene.currentLayout.arena;
    const readPixel = (x: number, y: number) =>
      new Promise<{ r: number; g: number; b: number }>((resolve) => {
        scene.game.renderer.snapshotPixel(Math.round(x), Math.round(y), (color) => {
          const c = color as Phaser.Display.Color;
          resolve({ r: c.red, g: c.green, b: c.blue });
        });
      });
    // A field point away from the balls and markings, in canvas pixels.
    const pixel = await readPixel(arena.offsetX + 60 * arena.scale, arena.offsetY + 590 * arena.scale);
    // Sample the rendered ball: a soccer ball has both black patches and white leather.
    const orb = hook.world.orbs[0];
    if (orb === undefined) throw new Error('no orb');
    let dark = 0;
    let light = 0;
    for (let dy = -0.8; dy <= 0.8; dy += 0.1) {
      for (let dx = -0.8; dx <= 0.8; dx += 0.1) {
        if (Math.hypot(dx, dy) > 0.8) continue;
        const c = await readPixel(
          arena.offsetX + (orb.position.x + dx * orb.radius) * arena.scale,
          arena.offsetY + (orb.position.y + dy * orb.radius) * arena.scale,
        );
        const sum = c.r + c.g + c.b;
        if (sum < 200) dark++;
        else if (sum > 450) light++;
      }
    }
    return {
      shadingTextures: shadings.filter((b) => b.visible).map((b) => b.texture.key),
      shadingSizes: shadings.filter((b) => b.visible).map((b) => b.displayWidth),
      radius: orb.radius,
      pixel,
      dark,
      light,
    };
  });
  expect(result.shadingTextures).toEqual(['soccer-ball-shading', 'soccer-ball-shading']);
  expect(result.shadingSizes).toEqual([2 * result.radius, 2 * result.radius]);
  expect(result.pixel.g).toBeGreaterThan(result.pixel.r * 1.5);
  expect(result.pixel.g).toBeGreaterThan(result.pixel.b * 1.5);
  expect(result.dark).toBeGreaterThan(5);
  expect(result.light).toBeGreaterThan(result.dark);
});

test('moving balls roll and leave a motion-blur trail', async ({ page }) => {
  await open(page, '?orbs=2&speed=200&seed=3');
  const visuals = () => page.evaluate(() => window.__orbitalLock?.scene.ballVisuals ?? []);
  const first = await visuals();
  await expect
    .poll(async () => (await visuals()).every((ball) => ball.trailGhosts > 0), { timeout: 15_000 })
    .toBe(true);
  const later = await visuals();
  later.forEach((ball, index) => {
    const before = first[index]?.orientation ?? [];
    expect(ball.orientation.some((value, i) => Math.abs(value - (before[i] ?? value)) > 1e-3)).toBe(true);
  });
});

test('orb collisions play the kick sound once the player has interacted', async ({ page }) => {
  await open(page, '?orbs=6&speed=400&seed=3');
  // Browsers block audio until the first interaction; a click unlocks it (and is not a miss).
  await tapArena(page);
  await expect
    .poll(() => page.evaluate(() => window.__orbitalLock?.scene.collisionSoundsPlayed ?? 0), { timeout: 15_000 })
    .toBeGreaterThan(0);
});

test('every miss plays one referee whistle, starting with the very first interaction', async ({ page }) => {
  await open(page, '?seed=3');
  const whistles = () => page.evaluate(() => window.__orbitalLock?.scene.missWhistlesPlayed ?? 0);
  expect(await whistles()).toBe(0);

  // The very first interaction on the page is itself a miss (a too-short drawing).
  await shortStroke(page);
  expect((await snapshot(page)).hud.misses).toBe('Misses: 1 / 3');
  expect(await whistles()).toBe(1);

  await shortStroke(page);
  expect((await snapshot(page)).hud.misses).toBe('Misses: 2 / 3');
  expect(await whistles()).toBe(2);
  // A miss is not a capture: no goal sound.
  expect(await page.evaluate(() => window.__orbitalLock?.scene.goalSoundsPlayed)).toBe(0);
});
