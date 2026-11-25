import type { GameplayConfig } from '../config/gameConfig';
import type { GameProgress } from '../game/progress';

/** Text shown in each HUD field (REQUIREMENTS §5.2, §5.3). */
export interface HudModel {
  readonly captured: string;
  readonly remaining: string;
  readonly time: string;
  readonly score: string;
  /** Failed attempts so far against the limit; defeat when exceeded (D3). */
  readonly misses: string;
}

/** Formats seconds as `mm:ss` (minutes keep counting past 59). */
export function formatElapsed(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function buildHudModel(
  progress: GameProgress,
  config: Pick<GameplayConfig, 'maxFailedAttempts'>,
): HudModel {
  return {
    captured: `Captured: ${String(progress.capturedOrbs)} / ${String(progress.totalOrbs)}`,
    remaining: `Remaining: ${String(progress.totalOrbs - progress.capturedOrbs)}`,
    time: `Time: ${formatElapsed(progress.elapsedSeconds)}`,
    score: `Score: ${String(progress.score)}`,
    misses: `Misses: ${String(progress.failedAttempts)} / ${String(config.maxFailedAttempts)}`,
  };
}

export interface GameOverModel {
  readonly title: string;
  readonly detail: string;
}

/** Victory or defeat screen text; undefined while playing (REQUIREMENTS §3.8). */
export function buildGameOverModel(progress: GameProgress): GameOverModel | undefined {
  const summary = `Score: ${String(progress.score)}   Time: ${formatElapsed(progress.elapsedSeconds)}`;
  switch (progress.status) {
    case 'victory':
      return { title: 'VICTORY', detail: `All orbs captured!\n${summary}` };
    case 'defeat':
      return {
        title: 'DEFEAT',
        detail: `Too many failed drawings.\nCaptured ${String(progress.capturedOrbs)} of ${String(progress.totalOrbs)}   ${summary}`,
      };
    case 'playing':
      return undefined;
  }
}
