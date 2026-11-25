import Phaser from 'phaser';
import type { Rect } from '../geometry/rect';
import type { Vec2 } from '../geometry/vector';
import { THEME } from '../render/theme';

export interface PillButtonOptions {
  /** Draws a circular "restart" arrow before the label. */
  readonly restartIcon?: boolean;
}

/** Scale while the button is held down, for a pressed feel. */
const PRESSED_SCALE = 0.96;

/**
 * A primary game button (REQUIREMENTS §5.6): a gold pill with a drop shadow,
 * a dark bold label and an optional restart icon. Lighter on hover, slightly
 * smaller while pressed, and it fires on release, for mouse and touch.
 *
 * The container sits at the button's center, so its hit area (sized by
 * `place`) is centered too.
 */
export class PillButton {
  readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly restartIcon: boolean;
  private width = 1;
  private height = 1;
  private lineWidth = 1;
  private hovered = false;

  constructor(scene: Phaser.Scene, text: string, onPress: () => void, options: PillButtonOptions = {}) {
    this.restartIcon = options.restartIcon ?? false;
    this.background = scene.add.graphics();
    this.icon = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, text, { fontFamily: THEME.fontFamily, fontStyle: '800', color: THEME.buttonText })
      .setOrigin(0.5);
    this.container = scene.add.container(0, 0, [this.background, this.icon, this.label]);
    this.container.setSize(1, 1).setInteractive({ useHandCursor: true });

    this.container.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
    });
    this.container.on('pointerout', () => {
      this.hovered = false;
      this.container.setScale(1);
      this.redraw();
    });
    this.container.on('pointerdown', () => this.container.setScale(PRESSED_SCALE));
    this.container.on('pointerup', () => {
      this.container.setScale(1);
      onPress();
    });
  }

  /**
   * Places the button in its parent's coordinates and sizes its label.
   * `pixelRatio` keeps the shadow and outline at constant CSS-pixel sizes.
   */
  place(rect: Rect, fontSize: number, pixelRatio: number): void {
    this.width = rect.width;
    this.height = rect.height;
    this.lineWidth = pixelRatio;
    this.container.setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
    this.container.setSize(rect.width, rect.height);
    const hitArea: unknown = this.container.input?.hitArea;
    if (hitArea instanceof Phaser.Geom.Rectangle) hitArea.setTo(0, 0, rect.width, rect.height);

    this.label.setFontSize(fontSize);
    this.redraw();
  }

  /** Center in canvas coordinates, including any parent container's transform (for tests). */
  get center(): Vec2 {
    const bounds = this.container.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  }

  private redraw(): void {
    const { width: w, height: h } = this;
    const radius = h / 2;
    const g = this.background;
    g.clear();
    g.fillStyle(THEME.buttonShadow, 0.35);
    g.fillRoundedRect(-w / 2, -h / 2 + 2 * this.lineWidth, w, h, radius);
    g.fillStyle(this.hovered ? THEME.buttonFillHover : THEME.buttonFill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.lineStyle(this.lineWidth, 0xffffff, 0.35);
    g.strokeRoundedRect(-w / 2 + this.lineWidth, -h / 2 + this.lineWidth, w - 2 * this.lineWidth, h - 2 * this.lineWidth, radius);

    this.icon.clear();
    if (!this.restartIcon) {
      this.label.setPosition(0, 0);
      return;
    }
    // Icon and label are centered together as one group.
    const iconRadius = this.label.height * 0.3;
    const spacing = iconRadius * 1.2;
    const groupWidth = iconRadius * 2 + spacing + this.label.width;
    const iconX = -groupWidth / 2 + iconRadius;
    this.label.setPosition(iconX + iconRadius + spacing + this.label.width / 2, 0);
    drawRestartIcon(this.icon, iconX, 0, iconRadius, Math.max(this.lineWidth * 2, iconRadius * 0.35));
  }
}

/** A clockwise circular arrow (↻), drawn with lines so it does not depend on the font. */
function drawRestartIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, thickness: number): void {
  const color = Phaser.Display.Color.HexStringToColor(THEME.buttonText).color;
  const start = Phaser.Math.DegToRad(-60);
  const end = Phaser.Math.DegToRad(230);
  g.lineStyle(thickness, color, 1);
  g.beginPath();
  g.arc(cx, cy, radius, start, end, false);
  g.strokePath();

  // Arrowhead at the end of the arc, pointing along the clockwise tangent.
  const ex = cx + Math.cos(end) * radius;
  const ey = cy + Math.sin(end) * radius;
  const tx = -Math.sin(end);
  const ty = Math.cos(end);
  const nx = Math.cos(end);
  const ny = Math.sin(end);
  const size = thickness * 1.6;
  g.fillStyle(color, 1);
  g.fillTriangle(
    ex + tx * size,
    ey + ty * size,
    ex + nx * size - tx * size * 0.3,
    ey + ny * size - ty * size * 0.3,
    ex - nx * size - tx * size * 0.3,
    ey - ny * size - ty * size * 0.3,
  );
}
