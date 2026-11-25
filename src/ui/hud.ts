import Phaser from 'phaser';
import type { HudLayout } from '../layout/screenLayout';
import { THEME } from '../render/theme';
import type { HudModel } from './hudModel';
import { createTextButton, placeTextButton } from './textButton';

type HudField = keyof HudModel;
const FIELDS: readonly HudField[] = ['captured', 'remaining', 'time', 'score', 'misses'];

/**
 * HUD (REQUIREMENTS §5.3): title, counters, time, score, misses and the
 * restart control. Positions and font sizes come from the screen layout and
 * are re-applied on every resize; the HUD never overlaps the arena.
 */
export class Hud {
  private readonly title: Phaser.GameObjects.Text;
  private readonly fields = new Map<HudField, Phaser.GameObjects.Text>();
  readonly restartButton: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, layout: HudLayout, onRestart: () => void) {
    this.title = scene.add
      .text(0, 0, 'ORBITAL LOCK', { fontFamily: THEME.fontFamily, fontStyle: 'bold', color: THEME.text })
      .setOrigin(0, 0.5);

    for (const field of FIELDS) {
      const text = scene.add
        .text(0, 0, '', { fontFamily: THEME.fontFamily, color: THEME.textMuted })
        .setOrigin(0, 0.5);
      this.fields.set(field, text);
    }

    this.restartButton = createTextButton(scene, 'Restart', onRestart);
    this.applyLayout(layout);
  }

  applyLayout(layout: HudLayout): void {
    this.title.setFontSize(layout.titleFontSize).setPosition(layout.title.x, layout.title.y);
    FIELDS.forEach((field, index) => {
      const anchor = layout.fields[index];
      if (anchor !== undefined) {
        this.fields.get(field)?.setFontSize(layout.fieldFontSize).setPosition(anchor.x, anchor.y);
      }
    });
    placeTextButton(this.restartButton, layout.restart.x, layout.restart.y, layout.buttonFontSize);
  }

  /** Updates the texts, re-rendering only those whose value changed. */
  update(model: HudModel): void {
    for (const field of FIELDS) {
      const text = this.fields.get(field);
      if (text !== undefined && text.text !== model[field]) text.setText(model[field]);
    }
  }

  /** Current HUD texts, for tests. */
  read(): Record<HudField, string> {
    const result = {} as Record<HudField, string>;
    for (const field of FIELDS) result[field] = this.fields.get(field)?.text ?? '';
    return result;
  }
}
