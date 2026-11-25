import type { Vec2 } from './geometry/vector';
import { arenaToScreen } from './layout/arenaTransform';
import type { GameScene } from './scenes/GameScene';
import type { GameWorld } from './world/gameWorld';

/** View of the running game for browser tests (development builds only). */
export interface OrbitalLockTestHook {
  readonly world: GameWorld;
  readonly scene: GameScene;
  /** Converts a game-canvas position into page (CSS pixel) coordinates for mouse/touch events. */
  canvasToPage(point: Vec2): Vec2;
  /** Converts an arena position into page (CSS pixel) coordinates. */
  arenaToPage(point: Vec2): Vec2;
}

declare global {
  interface Window {
    __orbitalLock?: OrbitalLockTestHook;
  }
}

export function installTestHook(world: GameWorld, scene: GameScene): void {
  const canvasToPage = (point: Vec2): Vec2 => {
    const canvas = document.querySelector('canvas');
    if (canvas === null) throw new Error('canvas not found');
    const rect = canvas.getBoundingClientRect();
    const layout = scene.currentLayout;
    return {
      x: rect.left + (point.x / layout.canvasWidth) * rect.width,
      y: rect.top + (point.y / layout.canvasHeight) * rect.height,
    };
  };

  window.__orbitalLock = {
    world,
    scene,
    canvasToPage,
    arenaToPage: (point) => canvasToPage(arenaToScreen(point, scene.currentLayout.arena)),
  };
}
