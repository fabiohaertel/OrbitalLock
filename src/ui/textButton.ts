import Phaser from 'phaser';
import { THEME } from '../render/theme';

/** A clickable text label (mouse and touch), centered on its position. */
export function createTextButton(
  scene: Phaser.Scene,
  label: string,
  onPress: () => void,
): Phaser.GameObjects.Text {
  const button = scene.add
    .text(0, 0, label, {
      fontFamily: THEME.fontFamily,
      fontStyle: 'bold',
      color: THEME.button,
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  button.on('pointerover', () => button.setColor(THEME.buttonHover));
  button.on('pointerout', () => button.setColor(THEME.button));
  button.on('pointerup', onPress);
  return button;
}

/**
 * Moves and resizes a button. The padding grows with the font so the touch
 * target stays comfortable (REQUIREMENTS §7.3).
 */
export function placeTextButton(button: Phaser.GameObjects.Text, x: number, y: number, fontSize: number): void {
  button.setFontSize(fontSize).setPadding(fontSize * 0.6, fontSize * 0.35).setPosition(x, y);
}
