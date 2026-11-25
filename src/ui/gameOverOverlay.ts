import Phaser from 'phaser';
import type { Rect } from '../geometry/rect';
import type { Vec2 } from '../geometry/vector';
import { MIN_TOUCH_TARGET } from '../layout/screenLayout';
import { THEME } from '../render/theme';
import type { GameOverModel } from './hudModel';
import { PillButton } from './pillButton';
import { StatCard } from './statCard';

/** Panel design size in CSS pixels; it shrinks to fit small arenas. */
const PANEL_WIDTH = 440;
const PANEL_HEIGHT = 232;
const STAT_COUNT = 3;
/** Smallest label size in CSS pixels, so the panel stays readable on phones. */
const MIN_LABEL_FONT = 9;

/**
 * Victory / defeat screen over the arena (REQUIREMENTS §3.8, §5.6): the arena
 * is dimmed and a rounded panel pops in with the result title (gold for a
 * victory, red for a defeat), a one-line reason, a small final scoreboard
 * (score, time, captured) and a "PLAY AGAIN" button. The panel scales down to
 * fit small arenas.
 */
export class GameOverOverlay {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly panelBackground: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly stats: StatCard[] = [];
  private readonly playAgainButton: PillButton;

  constructor(scene: Phaser.Scene, arenaRect: Rect, pixelRatio: number, onRestart: () => void) {
    this.scene = scene;
    this.backdrop = scene.add.rectangle(0, 0, 1, 1, THEME.overlay, THEME.overlayAlpha);
    this.panelBackground = scene.add.graphics();
    this.title = scene.add
      .text(0, 0, '', { fontFamily: THEME.fontFamily, fontStyle: '800', color: THEME.victory })
      .setOrigin(0.5);
    this.subtitle = scene.add
      .text(0, 0, '', { fontFamily: THEME.fontFamily, fontStyle: '500', color: THEME.textMuted })
      .setOrigin(0.5);
    for (let i = 0; i < STAT_COUNT; i++) {
      this.stats.push(new StatCard(scene, { accent: i === 0 ? THEME.accentScore : THEME.accentNeutral }));
    }
    this.playAgainButton = new PillButton(scene, 'PLAY AGAIN', onRestart, { restartIcon: true });

    this.panel = scene.add.container(0, 0, [
      this.panelBackground,
      this.title,
      this.subtitle,
      ...this.stats.map((card) => card.container),
      this.playAgainButton.container,
    ]);
    this.container = scene.add.container(0, 0, [this.backdrop, this.panel]).setDepth(10).setVisible(false);
    this.applyLayout(arenaRect, pixelRatio);
  }

  applyLayout(arenaRect: Rect, pixelRatio: number): void {
    const r = pixelRatio;
    const cx = arenaRect.x + arenaRect.width / 2;
    const cy = arenaRect.y + arenaRect.height / 2;
    // CSS-pixel design scaled down (never up) to fit the arena with a margin.
    const k = Math.min(1, (arenaRect.width - 16 * r) / (PANEL_WIDTH * r), (arenaRect.height - 16 * r) / (PANEL_HEIGHT * r));
    const s = Math.max(k, 0.5) * r;
    const w = PANEL_WIDTH * s;
    const h = PANEL_HEIGHT * s;

    this.backdrop.setPosition(cx, cy).setSize(arenaRect.width, arenaRect.height);
    this.panel.setPosition(cx, cy);

    const g = this.panelBackground;
    g.clear();
    g.fillStyle(THEME.cardFill, 0.96);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 16 * s);
    g.lineStyle(r, THEME.cardBorder, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 16 * s);

    const top = -h / 2;
    this.title
      .setFontSize(40 * s)
      .setLetterSpacing(2 * s)
      .setStroke('#05070d', 6 * s)
      .setShadow(0, 3 * s, 'rgba(0, 0, 0, 0.6)', 6 * s, true, true)
      .setPosition(0, top + 48 * s);
    this.subtitle.setFontSize(Math.max(13 * s, 11 * r)).setPosition(0, top + 86 * s);

    const cardWidth = 120 * s;
    const cardGap = 12 * s;
    const rowLeft = -(STAT_COUNT * cardWidth + (STAT_COUNT - 1) * cardGap) / 2;
    const sizes = {
      labelFontSize: Math.max(10 * s, MIN_LABEL_FONT * r),
      valueFontSize: 19 * s,
      cornerRadius: 8 * s,
      pixelRatio: r,
    };
    this.stats.forEach((card, i) => {
      card.place({ x: rowLeft + i * (cardWidth + cardGap), y: top + 108 * s, width: cardWidth, height: 48 * s }, 'stacked', sizes);
    });

    const buttonWidth = 176 * s;
    const buttonHeight = Math.max(40 * s, MIN_TOUCH_TARGET * r);
    this.playAgainButton.place(
      { x: -buttonWidth / 2, y: top + 172 * s, width: buttonWidth, height: buttonHeight },
      Math.max(14 * s, 12 * r),
      r,
    );
  }

  /** Shows the screen for `model`, or hides it when undefined. */
  update(model: GameOverModel | undefined): void {
    if (model === undefined) {
      if (this.container.visible) this.container.setVisible(false);
      return;
    }
    if (this.title.text !== model.title) {
      this.title.setText(model.title).setColor(model.result === 'victory' ? THEME.victory : THEME.defeat);
    }
    if (this.subtitle.text !== model.subtitle) this.subtitle.setText(model.subtitle);
    model.stats.forEach((stat, i) => this.stats[i]?.set(stat));
    if (!this.container.visible) this.show();
  }

  /** Dims the arena and pops the panel in. */
  private show(): void {
    this.container.setVisible(true);
    this.backdrop.setAlpha(0);
    this.panel.setScale(0.9).setAlpha(0);
    this.scene.tweens.add({ targets: this.backdrop, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  }

  get visible(): boolean {
    return this.container.visible;
  }

  get titleText(): string {
    return this.title.text;
  }

  /** Canvas-space center of the "PLAY AGAIN" button, for tests. */
  get playAgainCenter(): Vec2 {
    return this.playAgainButton.center;
  }
}
