import Phaser from 'phaser';
import { parseDevOverrides } from './config/devOverrides';
import { ARENA, createGameplayConfig, type GameplayConfig } from './config/gameConfig';
import { computeLayout } from './layout/screenLayout';
import { readViewport, watchViewport } from './layout/viewport';
import { THEME } from './render/theme';
import { createSeededRandom } from './physics/random';
import { createOrbs } from './physics/spawn';
import { GameScene } from './scenes/GameScene';
import { installTestHook } from './testHook';
import { loadUiFonts } from './ui/fonts';
import { GameWorld } from './world/gameWorld';

// Development builds accept URL overrides (e.g. `?orbs=1&speed=20&seed=7`) for balancing and tests.
const overrides = import.meta.env.DEV ? parseDevOverrides(window.location.search) : undefined;
const config: GameplayConfig = createGameplayConfig(overrides?.config);
const seed = overrides?.seed;

const world = new GameWorld({
  config,
  arena: ARENA,
  spawnOrbs:
    seed === undefined ? undefined : (cfg, arena) => createOrbs(cfg, arena, createSeededRandom(seed)),
});

const container = document.getElementById('game');
if (container === null) throw new Error('#game element missing');

// Canvas text is measured when created, so the UI font must be ready first (falls back to system fonts).
await loadUiFonts();

const viewport = readViewport(container);
const scene = new GameScene(world, computeLayout(viewport, ARENA));

/*
 * The canvas fills the page at device resolution: its pixel size is the CSS
 * size × pixel ratio, and a zoom of 1 / pixel ratio displays it at CSS size,
 * so lines and text stay sharp on high-density screens (REQUIREMENTS §7.2).
 * Scale mode NONE leaves sizing to us; Phaser maps pointer input through the
 * canvas bounds.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: container,
  backgroundColor: THEME.background,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.NONE,
    width: viewport.width * viewport.pixelRatio,
    height: viewport.height * viewport.pixelRatio,
    zoom: 1 / viewport.pixelRatio,
  },
  scene: [scene],
});

watchViewport(container, (next) => {
  const layout = computeLayout(next, ARENA);
  if (game.scale.zoom !== 1 / next.pixelRatio) game.scale.setZoom(1 / next.pixelRatio);
  game.scale.resize(layout.canvasWidth, layout.canvasHeight);
  scene.applyLayout(layout);
});

if (import.meta.env.DEV) {
  installTestHook(world, scene);
}
