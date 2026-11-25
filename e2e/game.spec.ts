import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  status: string;
  hud: Record<string, string>;
  overlay: { visible: boolean; title: string };
  orbs: { x: number; y: number; radius: number; capture: string }[];
}

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__goalLock?.scene.sys.isActive() === true);
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const hook = window.__goalLock;
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
    const hook = window.__goalLock;
    if (hook === undefined) throw new Error('test hook missing');
    return hook.canvasToPage({ x: cx, y: cy });
  }, [x, y] as const);
}

/** Arena coordinates → page coordinates (the arena sits below the HUD). */
async function arenaToPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([ax, ay]) => {
    const hook = window.__goalLock;
    if (hook === undefined) throw new Error('test hook missing');
    return hook.arenaToPage({ x: ax, y: ay });
  }, [x, y] as const);
}

async function clickButton(page: Page, which: 'restart' | 'playAgain'): Promise<void> {
  const center = await page.evaluate((name) => {
    const hook = window.__goalLock;
    if (hook === undefined) throw new Error('test hook missing');
    return hook.scene.buttonCenters[name];
  }, which);
  const point = await canvasToPage(page, center.x, center.y);
  await page.mouse.click(point.x, point.y);
}

/** Clicks inside the arena without moving: no drawing starts, so it is not a foul (REQUIREMENTS §3.3). */
async function tapArena(page: Page): Promise<void> {
  const point = await arenaToPage(page, 40, 40);
  await page.mouse.click(point.x, point.y);
}

/** Starts a drawing and releases it after 20 units: too short, so it counts as a foul (D3). */
async function shortStroke(page: Page): Promise<void> {
  const start = await arenaToPage(page, 40, 40);
  const end = await arenaToPage(page, 60, 40);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
}

/** Draws a closed square of half-size `half` centered on an arena point, kept inside the arena. */
async function drawSquareAround(page: Page, cx: number, cy: number, half: number): Promise<void> {
  const corners = [
    [cx - half, cy - half],
    [cx + half, cy - half],
    [cx + half, cy + half],
    [cx - half, cy + half],
    [cx - half + 2, cy - half + 2],
  ].map(([x, y]) => [Math.min(Math.max(x ?? 0, 2), 998), Math.min(Math.max(y ?? 0, 2), 623)] as const);

  const start = await arenaToPage(page, corners[0]?.[0] ?? 0, corners[0]?.[1] ?? 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [x, y] of corners.slice(1)) {
    const point = await arenaToPage(page, x, y);
    await page.mouse.move(point.x, point.y, { steps: 12 });
  }
  await page.mouse.up();
}

test('HUD shows the counters, time and score', async ({ page }) => {
  await open(page);
  const initial = await snapshot(page);
  expect(initial.hud).toEqual({
    captured: 'Captured: 0 / 7',
    remaining: 'Remaining: 7',
    time: initial.hud.time,
    score: 'Score: 0',
    fouls: 'Fouls: 0 / 3',
  });
  // Game time runs in fixed steps and can lag wall-clock time on a busy machine. Polls can
  // also be late, so wait for the clock to reach 2 s rather than to show exactly 00:02.
  const seconds = (time = '') => {
    const [, minutes = '0', rest = '0'] = /(\d+):(\d+)$/.exec(time) ?? [];
    return Number(minutes) * 60 + Number(rest);
  };
  await expect
    .poll(async () => seconds((await snapshot(page)).hud.time), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);
  expect((await snapshot(page)).hud.time).toMatch(/^Time: \d{2}:\d{2}$/);
});

test('the HUD uses the bundled Orbitron font, and the title fits next to the cards', async ({ page }) => {
  // 16:10, where the HUD sits in one bar on top (at 16:9 the side column leaves a larger arena).
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const info = await page.evaluate(() => {
    const scene = window.__goalLock?.scene;
    if (scene === undefined) throw new Error('test hook missing');
    return {
      bold: document.fonts.check('800 16px Orbitron'),
      medium: document.fonts.check('500 16px Orbitron'),
      titleRight: scene.hudTitleRight,
      firstCardLeft: scene.currentLayout.hud.cards[0]?.x ?? 0,
      placement: scene.currentLayout.hud.placement,
    };
  });
  expect(info.bold).toBe(true);
  expect(info.medium).toBe(true);
  expect(info.placement).toBe('top');
  expect(info.titleRight).toBeLessThan(info.firstCardLeft);
});

test('a failed drawing is counted in the HUD', async ({ page }) => {
  await open(page, '?seed=3');
  await shortStroke(page);
  await expect.poll(async () => (await snapshot(page)).hud.fouls).toBe('Fouls: 1 / 3');
});

test('clicking the arena without drawing is not a foul', async ({ page }) => {
  await open(page, '?maxFouls=0&seed=3');
  await tapArena(page);
  await tapArena(page);
  const after = await snapshot(page);
  expect(after.hud.fouls).toBe('Fouls: 0 / 0');
  expect(after.status).toBe('playing');
  expect(await page.evaluate(() => window.__goalLock?.scene.foulWhistlesPlayed)).toBe(0);
});

test('exceeding the failure limit shows the defeat screen, and restart restores the game', async ({ page }) => {
  await open(page, '?maxFouls=1&seed=3');
  await shortStroke(page);
  await shortStroke(page);

  await expect.poll(async () => (await snapshot(page)).overlay).toEqual({ visible: true, title: 'DEFEAT' });
  expect((await snapshot(page)).status).toBe('defeat');

  await clickButton(page, 'restart');
  const after = await snapshot(page);
  expect(after.status).toBe('playing');
  expect(after.overlay.visible).toBe(false);
  expect(after.hud.fouls).toBe('Fouls: 0 / 1');
  expect(after.hud.time).toBe('Time: 00:00');
});

test('capturing every orb shows the victory screen, and "Play again" restarts', async ({ page }) => {
  // One almost stationary orb, so a square can be drawn around it reliably.
  await open(page, '?orbs=1&speed=1&seed=7');
  const [orb] = (await snapshot(page)).orbs;
  if (orb === undefined) throw new Error('no orb');

  await drawSquareAround(page, orb.x, orb.y, 70);

  await expect.poll(async () => (await snapshot(page)).overlay).toEqual({ visible: true, title: 'VICTORY' });
  const won = await snapshot(page);
  expect(won.status).toBe('victory');
  expect(won.hud.captured).toBe('Captured: 1 / 1');
  expect(won.hud.score).toBe('Score: 100');
  expect(won.orbs[0]?.capture).toBe('captured');
  // A captured ball no longer moves, so it has no motion-blur trail (REQUIREMENTS §5.4).
  expect(await page.evaluate(() => window.__goalLock?.scene.ballVisuals[0]?.trailGhosts)).toBe(0);
  // The capture that won the game played the goal sound once (REQUIREMENTS §5.5).
  expect(await page.evaluate(() => window.__goalLock?.scene.goalSoundsPlayed)).toBe(1);

  await clickButton(page, 'playAgain');
  const after = await snapshot(page);
  expect(after.status).toBe('playing');
  expect(after.overlay.visible).toBe(false);
  expect(after.hud.captured).toBe('Captured: 0 / 1');
});

test('Capture an orb → the captured region looks like a goal net with the ball trapped inside', async ({ page }) => {
  // Two almost stationary orbs: capturing one keeps the game running, so no overlay covers the arena.
  await open(page, '?orbs=2&speed=1&seed=3');
  const [orb, other] = (await snapshot(page)).orbs;
  if (orb === undefined || other === undefined) throw new Error('need two orbs');
  const half = 70;
  if (Math.abs(other.x - orb.x) < half + 2 * other.radius && Math.abs(other.y - orb.y) < half + 2 * other.radius) {
    throw new Error('layout changed: the second orb is too close to the first');
  }

  await drawSquareAround(page, orb.x, orb.y, half);
  await expect.poll(async () => (await snapshot(page)).orbs[0]?.capture).toBe('captured');
  expect((await snapshot(page)).status).toBe('playing');
  // A capture that does not win the game still plays the goal sound once (REQUIREMENTS §5.5).
  expect(await page.evaluate(() => window.__goalLock?.scene.goalSoundsPlayed)).toBe(1);

  // Sample a row of canvas pixels across the captured region, below the ball.
  const pixels = await page.evaluate(
    async ([x, y, halfSize]) => {
      const hook = window.__goalLock;
      if (hook === undefined) throw new Error('test hook missing');
      const scene = hook.scene;
      const arena = scene.currentLayout.arena;
      const sums: number[] = [];
      for (let px = (x - halfSize + 10) * arena.scale; px <= (x + halfSize - 10) * arena.scale; px++) {
        sums.push(
          await new Promise<number>((resolve) => {
            scene.game.renderer.snapshotPixel(
              Math.round(arena.offsetX + px),
              Math.round(arena.offsetY + (y + 40) * arena.scale),
              (color) => {
                const c = color as Phaser.Display.Color;
                resolve(c.red + c.green + c.blue);
              },
            );
          }),
        );
      }
      return sums;
    },
    [orb.x, orb.y, half] as const,
  );
  // A shadowed backdrop (darker than the field stripes, whose channel sums are 233 and above)
  // crossed by light net cords.
  const backdrop = pixels.filter((sum) => sum > 120 && sum < 210).length;
  const cords = pixels.filter((sum) => sum > 400).length;
  expect(backdrop).toBeGreaterThan(pixels.length / 3);
  expect(cords).toBeGreaterThanOrEqual(4);
});

// Regression (Phase 10): Phaser reports every mouse button's release as `pointerup`, so
// a right click while drawing used to end the drawing at that point.
test('a right click while drawing does not end the drawing', async ({ page }) => {
  await open(page, '?orbs=1&speed=1&seed=7');
  const [orb] = (await snapshot(page)).orbs;
  if (orb === undefined) throw new Error('no orb');
  // A horizontal line well away from the orb.
  const y = orb.y > 312 ? 120 : 500;

  const start = await arenaToPage(page, 100, y);
  const middle = await arenaToPage(page, 400, y);
  const end = await arenaToPage(page, 800, y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(middle.x, middle.y, { steps: 10 });
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  expect(await page.evaluate(() => window.__goalLock?.world.isDrawing)).toBe(true);
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();

  const walls = await page.evaluate(() => window.__goalLock?.world.walls.map((wall) => wall.path.at(-1)?.x) ?? []);
  expect(walls).toHaveLength(1);
  expect(walls[0]).toBeGreaterThan(790);
  expect((await snapshot(page)).hud.fouls).toBe('Fouls: 0 / 3');
});

test('the arena is a green soccer field and orbs are drawn as soccer balls', async ({ page }) => {
  await open(page, '?orbs=2&speed=1&seed=3');
  const result = await page.evaluate(async () => {
    const hook = window.__goalLock;
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
  const visuals = () => page.evaluate(() => window.__goalLock?.scene.ballVisuals ?? []);
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
  // Browsers block audio until the first interaction; a click unlocks it (and is not a foul).
  await tapArena(page);
  await expect
    .poll(() => page.evaluate(() => window.__goalLock?.scene.collisionSoundsPlayed ?? 0), { timeout: 15_000 })
    .toBeGreaterThan(0);
});

test('every foul plays one referee whistle, starting with the very first interaction', async ({ page }) => {
  await open(page, '?seed=3');
  const whistles = () => page.evaluate(() => window.__goalLock?.scene.foulWhistlesPlayed ?? 0);
  expect(await whistles()).toBe(0);

  // The very first interaction on the page is itself a foul (a too-short drawing).
  await shortStroke(page);
  expect((await snapshot(page)).hud.fouls).toBe('Fouls: 1 / 3');
  expect(await whistles()).toBe(1);

  await shortStroke(page);
  expect((await snapshot(page)).hud.fouls).toBe('Fouls: 2 / 3');
  expect(await whistles()).toBe(2);
  // A foul is not a capture: no goal sound.
  expect(await page.evaluate(() => window.__goalLock?.scene.goalSoundsPlayed)).toBe(0);
});
