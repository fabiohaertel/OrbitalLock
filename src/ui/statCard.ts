import Phaser from 'phaser';
import type { Rect } from '../geometry/rect';
import type { HudCardStyle } from '../layout/screenLayout';
import { THEME } from '../render/theme';
import type { HudFouls, HudStat } from './hudModel';

export interface StatCardSizes {
  readonly labelFontSize: number;
  readonly valueFontSize: number;
  readonly cornerRadius: number;
  /** Canvas pixels per CSS pixel, for constant-width outlines. */
  readonly pixelRatio: number;
}

export interface StatCardOptions {
  /** CSS color of the value. */
  readonly accent: string;
  /** Briefly enlarges the value when it goes up (used for the score). */
  readonly popOnIncrease?: boolean;
}

/** Pulse period of a card in danger (the next foul loses), in milliseconds. */
const DANGER_PULSE_MS = 900;

/**
 * One scoreboard card (REQUIREMENTS §5.3, §5.6): a rounded dark panel with a
 * small upper-case label and a large value, either stacked (label above
 * value) or inline (label left, value right). A fouls card shows one pip
 * per allowed foul, filled for each foul used, and pulses red when the next
 * foul loses the game.
 *
 * The container sits at the card's top-left corner.
 */
export class StatCard {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly value: Phaser.GameObjects.Text;
  private readonly options: StatCardOptions;
  private rect: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private style: HudCardStyle = 'stacked';
  private sizes: StatCardSizes = { labelFontSize: 10, valueFontSize: 18, cornerRadius: 8, pixelRatio: 1 };
  private fouls: HudFouls | undefined;
  private dangerAlpha = 0;

  constructor(scene: Phaser.Scene, options: StatCardOptions) {
    this.scene = scene;
    this.options = options;
    this.background = scene.add.graphics();
    this.pips = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', {
      fontFamily: THEME.fontFamily,
      fontStyle: '500',
      color: THEME.textMuted,
    });
    this.value = scene.add.text(0, 0, '', { fontFamily: THEME.fontFamily, fontStyle: '800', color: options.accent });
    this.container = scene.add.container(0, 0, [this.background, this.label, this.value, this.pips]);
  }

  place(rect: Rect, style: HudCardStyle, sizes: StatCardSizes): void {
    this.rect = rect;
    this.style = style;
    this.sizes = sizes;
    this.container.setPosition(rect.x, rect.y);
    this.label.setFontSize(sizes.labelFontSize);
    this.value.setFontSize(sizes.valueFontSize);

    const { width: w, height: h } = rect;
    const inset = Math.min(12 * sizes.pixelRatio, w * 0.1);
    if (style === 'stacked') {
      this.label.setOrigin(0.5).setPosition(w / 2, h * 0.3);
      this.value.setOrigin(0.5).setPosition(w / 2, h * 0.66);
    } else {
      this.label.setOrigin(0, 0.5).setPosition(inset, h / 2);
      this.value.setOrigin(1, 0.5).setPosition(w - inset, h / 2);
    }
    this.drawBackground();
    this.drawPips();
  }

  /** Shows a stat; for a fouls stat, pass it as `fouls` to draw pips. */
  set(stat: HudStat, fouls?: HudFouls): void {
    if (this.label.text !== stat.label) this.label.setText(stat.label);
    const previous = this.value.text;
    if (previous !== stat.value) {
      this.value.setText(stat.value);
      if (this.options.popOnIncrease === true && previous !== '' && Number(stat.value) > Number(previous)) {
        this.scene.tweens.add({ targets: this.value, scale: { from: 1.3, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      }
    }

    const pipsChanged =
      fouls?.used !== this.fouls?.used || fouls?.max !== this.fouls?.max || fouls?.showPips !== this.fouls?.showPips;
    this.fouls = fouls;
    this.value.setVisible(fouls?.showPips !== true);
    if (pipsChanged) this.drawPips();
  }

  /**
   * Animates the danger glow; call every frame with the scene time. Only
   * redraws while the glow changes.
   */
  tick(timeMs: number): void {
    const danger = this.fouls?.danger === true;
    const alpha = danger ? 0.55 + 0.45 * Math.sin((timeMs / DANGER_PULSE_MS) * Math.PI * 2) : 0;
    if (alpha === this.dangerAlpha) return;
    this.dangerAlpha = alpha;
    this.label.setColor(danger ? THEME.dangerText : THEME.textMuted);
    this.drawBackground();
  }

  private drawBackground(): void {
    const { width: w, height: h } = this.rect;
    const { cornerRadius, pixelRatio } = this.sizes;
    const g = this.background;
    g.clear();
    g.fillStyle(THEME.cardFill, THEME.cardFillAlpha);
    g.fillRoundedRect(0, 0, w, h, cornerRadius);
    g.lineStyle(pixelRatio, THEME.cardBorder, 1);
    g.strokeRoundedRect(0, 0, w, h, cornerRadius);
    if (this.dangerAlpha > 0) {
      g.lineStyle(2 * pixelRatio, THEME.danger, this.dangerAlpha);
      g.strokeRoundedRect(0, 0, w, h, cornerRadius);
    }
  }

  private drawPips(): void {
    const g = this.pips;
    g.clear();
    const fouls = this.fouls;
    if (fouls?.showPips !== true) return;

    const { width: w } = this.rect;
    const count = fouls.max;
    const available = this.style === 'stacked' ? w * 0.8 : w * 0.5;
    const radius = Math.min(this.sizes.valueFontSize * 0.26, available / (count * 2.8));
    const spacing = radius * 2.8;
    const rowWidth = (count - 1) * spacing;
    const firstX = this.style === 'stacked' ? w / 2 - rowWidth / 2 : this.value.x - rowWidth - radius;
    const y = this.value.y;

    for (let i = 0; i < count; i++) {
      const x = firstX + i * spacing;
      if (i < fouls.used) {
        g.fillStyle(THEME.foulUsed, 1);
        g.fillCircle(x, y, radius);
      } else {
        g.lineStyle(Math.max(this.sizes.pixelRatio, radius * 0.35), THEME.foulFree, 1);
        g.strokeCircle(x, y, radius * 0.85);
      }
    }
  }
}
