import type { GameEvent } from '../world/gameWorld';

/** Which sounds one batch of game events calls for (REQUIREMENTS §5.5). */
export interface SoundCues {
  /** At least one bounce: one kick sound for the whole batch (same frame). */
  readonly kick: boolean;
  /** One referee whistle per miss (a rejected or canceled drawing). */
  readonly whistles: number;
  /** At least one wall captured orbs, turning a region into a goal net: one goal sound. */
  readonly goal: boolean;
}

/**
 * Maps the events reported by one world call (one frame or one input) to the
 * sounds to play. Pure, so the rules can be tested without Phaser or audio.
 */
export function soundCuesFor(events: readonly GameEvent[]): SoundCues {
  let kick = false;
  let whistles = 0;
  let goal = false;
  for (const event of events) {
    switch (event.kind) {
      case 'collision':
        kick = true;
        break;
      case 'attemptFailed':
        whistles++;
        break;
      case 'wallCreated':
        if (event.capture.capturedOrbIds.length > 0) goal = true;
        break;
      case 'gameOver':
        break;
    }
  }
  return { kick, whistles, goal };
}
