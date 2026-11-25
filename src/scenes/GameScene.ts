import Phaser from 'phaser';
import type { PointerInput } from '../drawing/drawingSession';
import type { Vec2 } from '../geometry/vector';
import { screenToArena } from '../layout/arenaTransform';
import type { ScreenLayout } from '../layout/screenLayout';
import { FailureFlash } from '../render/failureFlash';
import { WorldRenderer } from '../render/worldRenderer';
import { GameOverOverlay } from '../ui/gameOverOverlay';
import { Hud } from '../ui/hud';
import { buildGameOverModel, buildHudModel } from '../ui/hudModel';
import type { GameEvent, GameWorld } from '../world/gameWorld';

export const GAME_SCENE_KEY = 'GameScene';

/**
 * Glue between Phaser and the game: forwards pointer input and frame time to
 * the `GameWorld`, and redraws the world, HUD and game-over screen each frame.
 * Holds no game rules of its own.
 */
export class GameScene extends Phaser.Scene {
  private readonly world: GameWorld;
  private layout: ScreenLayout;
  private readonly flash = new FailureFlash();
  private created = false;
  private worldRenderer!: WorldRenderer;
  private hud!: Hud;
  private overlay!: GameOverOverlay;

  constructor(world: GameWorld, layout: ScreenLayout) {
    super(GAME_SCENE_KEY);
    this.world = world;
    this.layout = layout;
  }

  /** Current screen layout (canvas pixels). */
  get currentLayout(): ScreenLayout {
    return this.layout;
  }

  /**
   * Applies a new layout after the viewport changed (REQUIREMENTS §5.1, §7.2).
   * Game state lives in arena coordinates, so only the on-screen placement
   * changes: orbs, walls and drawings keep their relative positions.
   */
  applyLayout(layout: ScreenLayout): void {
    this.layout = layout;
    if (!this.created) return;
    this.cameras.main.setSize(layout.canvasWidth, layout.canvasHeight);
    this.worldRenderer.setTransform(layout.arena, layout.pixelRatio);
    this.hud.applyLayout(layout.hud);
    this.overlay.applyLayout(layout.arenaRect, layout.pixelRatio);
    this.redraw();
  }

  create(): void {
    const { arena, hud, arenaRect, pixelRatio } = this.layout;
    this.worldRenderer = new WorldRenderer(this, this.world.arena, arena, pixelRatio);
    this.hud = new Hud(this, hud, () => {
      this.restart();
    });
    this.overlay = new GameOverOverlay(this, arenaRect, pixelRatio, () => {
      this.restart();
    });
    this.created = true;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.forward(() => this.world.pointerDown(this.toInput(pointer)));
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.forward(() => this.world.pointerMove(this.toInput(pointer)));
    });
    const release = (pointer: Phaser.Input.Pointer) => {
      // Phaser reports a browser touch cancel as a pointer-up with `wasCanceled`.
      this.forward(() =>
        pointer.wasCanceled ? this.world.pointerCancel() : this.world.pointerUp(this.toInput(pointer)),
      );
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.redraw();
  }

  override update(_time: number, deltaMs: number): void {
    const seconds = deltaMs / 1000;
    this.forward(() => this.world.update(seconds));
    this.flash.tick(seconds);
    this.redraw();
  }

  get hudTexts(): ReturnType<Hud['read']> {
    return this.hud.read();
  }

  get overlayState(): { readonly visible: boolean; readonly title: string } {
    return { visible: this.overlay.visible, title: this.overlay.titleText };
  }

  /** Canvas-space centers of the HUD restart and overlay buttons, for tests. */
  get buttonCenters(): { readonly restart: Vec2; readonly playAgain: Vec2 } {
    return {
      restart: { x: this.hud.restartButton.x, y: this.hud.restartButton.y },
      playAgain: { x: this.overlay.playAgainButton.x, y: this.overlay.playAgainButton.y },
    };
  }

  private restart(): void {
    this.world.restart();
    this.flash.clear();
    this.redraw();
  }

  /** Runs a world call and shows feedback for any failed drawing it reports. */
  private forward(call: () => GameEvent[]): void {
    const pathBefore = [...this.world.previewPath];
    for (const event of call()) {
      if (event.kind === 'attemptFailed') {
        this.flash.show(pathBefore.length >= 2 ? pathBefore : this.world.previewPath);
      }
    }
  }

  private toInput(pointer: Phaser.Input.Pointer): PointerInput {
    return {
      pointerId: pointer.id,
      position: screenToArena({ x: pointer.x, y: pointer.y }, this.layout.arena),
      // Left mouse button or any touch (REQUIREMENTS §3.3).
      isPrimary: pointer.wasTouch || pointer.button === 0,
    };
  }

  private redraw(): void {
    this.worldRenderer.draw({
      orbs: this.world.orbs,
      walls: this.world.walls,
      capturedRegions: this.world.capturedRegions,
      previewPath: this.world.previewPath,
      failurePath: this.flash.path,
      failureAlpha: this.flash.alpha,
    });
    this.hud.update(buildHudModel(this.world.progress, this.world.config));
    this.overlay.update(buildGameOverModel(this.world.progress));
  }
}
