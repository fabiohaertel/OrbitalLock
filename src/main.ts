import Phaser from 'phaser';
import { ARENA } from './config/gameConfig';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0e17',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: ARENA.width,
    height: ARENA.height,
  },
  scene: [GameScene],
});
