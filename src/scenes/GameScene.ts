import Phaser from 'phaser';
import { ARENA } from '../config/gameConfig';

export const GAME_SCENE_KEY = 'GameScene';

/**
 * Main gameplay scene. Phase 0: boot placeholder only; gameplay systems are
 * wired in later phases.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super(GAME_SCENE_KEY);
  }

  create(): void {
    this.add
      .text(ARENA.width / 2, ARENA.height / 2, 'ORBITAL LOCK', {
        fontFamily: 'sans-serif',
        fontSize: '48px',
        color: '#e6ecff',
      })
      .setOrigin(0.5);
  }
}
