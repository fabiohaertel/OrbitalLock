import Phaser from 'phaser';
import type { Rect } from '../geometry/rect';
import { THEME } from '../render/theme';
import type { GameOverModel } from './hudModel';
import { createTextButton, placeTextButton } from './textButton';

/**
 * Victory / defeat screen drawn over the arena, with a restart button
 * (REQUIREMENTS §3.8). Sized relative to the arena, with minimum font sizes
 * so it stays readable on small screens.
 */
export class GameOverOverlay {
  private readonly container: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  readonly playAgainButton: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, arenaRect: Rect, pixelRatio: number, onRestart: () => void) {
    this.backdrop = scene.add.rectangle(0, 0, 1, 1, THEME.overlay, THEME.overlayAlpha);
    this.title = scene.add
      .text(0, 0, '', { fontFamily: THEME.fontFamily, fontStyle: 'bold', color: THEME.text })
      .setOrigin(0.5);
    this.detail = scene.add
      .text(0, 0, '', { fontFamily: THEME.fontFamily, color: THEME.textMuted, align: 'center' })
      .setOrigin(0.5);
    this.playAgainButton = createTextButton(scene, 'Play again', onRestart);

    this.container = scene.add
      .container(0, 0, [this.backdrop, this.title, this.detail, this.playAgainButton])
      .setDepth(10)
      .setVisible(false);
    this.applyLayout(arenaRect, pixelRatio);
  }

  applyLayout(arenaRect: Rect, pixelRatio: number): void {
    const cx = arenaRect.x + arenaRect.width / 2;
    const cy = arenaRect.y + arenaRect.height / 2;
    const titleSize = Math.max(arenaRect.width * 0.064, 26 * pixelRatio);
    const detailSize = Math.max(arenaRect.width * 0.022, 13 * pixelRatio);
    const buttonSize = Math.max(arenaRect.width * 0.028, 18 * pixelRatio);

    this.backdrop.setPosition(cx, cy).setSize(arenaRect.width, arenaRect.height);
    this.title.setFontSize(titleSize).setPosition(cx, cy - titleSize * 1.1);
    this.detail.setFontSize(detailSize).setPosition(cx, cy + detailSize * 0.4);
    placeTextButton(this.playAgainButton, cx, cy + detailSize * 2.2 + buttonSize, buttonSize);
  }

  /** Shows the screen for `model`, or hides it when undefined. */
  update(model: GameOverModel | undefined): void {
    if (model === undefined) {
      if (this.container.visible) this.container.setVisible(false);
      return;
    }
    if (this.title.text !== model.title) this.title.setText(model.title);
    if (this.detail.text !== model.detail) this.detail.setText(model.detail);
    if (!this.container.visible) this.container.setVisible(true);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  get titleText(): string {
    return this.title.text;
  }
}
