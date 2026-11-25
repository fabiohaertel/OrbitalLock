import Phaser from 'phaser';
import type { Vec2 } from '../geometry/vector';
import type { HudLayout } from '../layout/screenLayout';
import { THEME } from '../render/theme';
import type { HudModel } from './hudModel';
import { PillButton } from './pillButton';
import { StatCard } from './statCard';

type HudField = keyof HudModel;
const FIELDS: readonly HudField[] = ['captured', 'remaining', 'time', 'score', 'fouls'];

const ACCENTS: Record<HudField, string> = {
  captured: THEME.accentCaptured,
  remaining: THEME.accentNeutral,
  time: THEME.accentNeutral,
  score: THEME.accentScore,
  fouls: THEME.accentNeutral,
};

/**
 * HUD (REQUIREMENTS §5.3, §5.6): the "GOAL LOCK" title, one scoreboard
 * card per field (captured, remaining, time, score, fouls) and the restart
 * button. Positions and sizes come from the screen layout and are re-applied
 * on every resize; the HUD never overlaps the arena.
 */
export class Hud {
  private readonly titleStart: Phaser.GameObjects.Text;
  private readonly titleEnd: Phaser.GameObjects.Text;
  private readonly cards = new Map<HudField, StatCard>();
  private readonly restartButton: PillButton;
  private model: HudModel | undefined;

  constructor(scene: Phaser.Scene, layout: HudLayout, pixelRatio: number, onRestart: () => void) {
    const titleStyle = { fontFamily: THEME.fontFamily, fontStyle: '800' };
    this.titleStart = scene.add.text(0, 0, 'GOAL', { ...titleStyle, color: THEME.text }).setOrigin(0, 0.5);
    this.titleEnd = scene.add.text(0, 0, 'LOCK', { ...titleStyle, color: THEME.accentScore }).setOrigin(0, 0.5);

    for (const field of FIELDS) {
      this.cards.set(field, new StatCard(scene, { accent: ACCENTS[field], popOnIncrease: field === 'score' }));
    }

    this.restartButton = new PillButton(scene, 'RESTART', onRestart, { restartIcon: true });
    this.applyLayout(layout, pixelRatio);
  }

  applyLayout(layout: HudLayout, pixelRatio: number): void {
    const spacing = layout.titleFontSize * 0.08;
    for (const part of [this.titleStart, this.titleEnd]) {
      part
        .setFontSize(layout.titleFontSize)
        .setLetterSpacing(spacing)
        .setShadow(0, 2 * pixelRatio, 'rgba(0, 0, 0, 0.6)', 4 * pixelRatio, false, true);
    }
    this.titleStart.setPosition(layout.title.x, layout.title.y);
    this.titleEnd.setPosition(layout.title.x + this.titleStart.width + layout.titleFontSize * 0.4, layout.title.y);

    const sizes = {
      labelFontSize: layout.labelFontSize,
      valueFontSize: layout.valueFontSize,
      cornerRadius: layout.cornerRadius,
      pixelRatio,
    };
    FIELDS.forEach((field, index) => {
      const rect = layout.cards[index];
      if (rect !== undefined) this.cards.get(field)?.place(rect, layout.cardStyle, sizes);
    });
    this.restartButton.place(layout.restart, layout.buttonFontSize, pixelRatio);
  }

  /** Updates the cards; only text that changed is re-rendered. `timeMs` drives the danger pulse. */
  update(model: HudModel, timeMs: number): void {
    this.model = model;
    for (const field of FIELDS) {
      const card = this.cards.get(field);
      if (card === undefined) continue;
      if (field === 'fouls') card.set(model.fouls, model.fouls);
      else card.set(model[field]);
      card.tick(timeMs);
    }
  }

  /** Canvas-space center of the restart button, for tests. */
  get restartCenter(): Vec2 {
    return this.restartButton.center;
  }

  /** Right edge of the title in canvas pixels, for checking that it fits its slot. */
  get titleRight(): number {
    return this.titleEnd.x + this.titleEnd.width;
  }

  /** Current HUD fields as plain text (e.g. `Fouls: 1 / 3`), for tests and accessibility. */
  read(): Record<HudField, string> {
    const result = {} as Record<HudField, string>;
    for (const field of FIELDS) result[field] = this.model?.[field].text ?? '';
    return result;
  }
}
