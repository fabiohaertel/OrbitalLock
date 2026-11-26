import { FIRST_LEVEL } from './levels';
import { captureScore, levelClearBonus, type LevelClearBonus } from './scoring';

/**
 * Overall game state (REQUIREMENTS §3.8, §8.4, D10): playing a level, the
 * level was cleared (waiting for the player to start the next one), or the
 * game was lost. There is no final victory.
 */
export type GameStatus = 'playing' | 'levelComplete' | 'defeat';

/**
 * Game progress: the current level's counters and clock, plus the score and
 * time of the whole game. Immutable; every change returns a new value.
 */
export interface GameProgress {
  readonly status: GameStatus;
  /** Current level, starting at `FIRST_LEVEL`. */
  readonly level: number;
  /** Orbs on the current level. */
  readonly totalOrbs: number;
  /** Orbs captured on the current level. */
  readonly capturedOrbs: number;
  /** Fouls on the current level; they reset every level (D10). */
  readonly failedAttempts: number;
  /** Score of the whole game; accumulates across levels (D10, D11). */
  readonly score: number;
  /** Simulated play time of the current level in seconds; stops when the level is over. */
  readonly elapsedSeconds: number;
  /** Simulated play time of the whole game in seconds. */
  readonly totalSeconds: number;
  /** Bonus awarded when the current level was cleared; undefined until then (D11). */
  readonly levelBonus: LevelClearBonus | undefined;
}

/** Progress of a new game, starting at `level` with `totalOrbs` orbs. */
export function createProgress(totalOrbs: number, level: number = FIRST_LEVEL): GameProgress {
  return {
    status: 'playing',
    level,
    totalOrbs,
    capturedOrbs: 0,
    failedAttempts: 0,
    score: 0,
    elapsedSeconds: 0,
    totalSeconds: 0,
    levelBonus: undefined,
  };
}

/**
 * Starts `level` with `totalOrbs` orbs: the level's counters and clock reset,
 * the game's score and total time are kept (D10). Only after a cleared level.
 */
export function startLevel(progress: GameProgress, level: number, totalOrbs: number): GameProgress {
  if (progress.status !== 'levelComplete') return progress;
  return {
    ...createProgress(totalOrbs, level),
    score: progress.score,
    totalSeconds: progress.totalSeconds,
  };
}

/**
 * Counts one failed drawing attempt (D3). Defeat is triggered when the number
 * of failed attempts exceeds `maxFailedAttempts` (REQUIREMENTS §3.8).
 */
export function recordFailedAttempt(progress: GameProgress, maxFailedAttempts: number): GameProgress {
  if (progress.status !== 'playing') return progress;
  const failedAttempts = progress.failedAttempts + 1;
  return {
    ...progress,
    failedAttempts,
    status: failedAttempts > maxFailedAttempts ? 'defeat' : 'playing',
  };
}

/**
 * Adds captured orbs and their score (`100 × level` each, D11). When every orb
 * of the level is captured, the level is cleared and the level-clear bonus is
 * added (REQUIREMENTS §3.8, D10, D11).
 */
export function recordCaptures(progress: GameProgress, count: number, maxFailedAttempts: number): GameProgress {
  if (progress.status !== 'playing' || count <= 0) return progress;
  const capturedOrbs = Math.min(progress.totalOrbs, progress.capturedOrbs + count);
  const score = progress.score + captureScore(count, progress.level);
  if (capturedOrbs < progress.totalOrbs) return { ...progress, capturedOrbs, score };

  const levelBonus = levelClearBonus({
    level: progress.level,
    foulsLeft: remainingAttempts(progress, maxFailedAttempts),
    levelSeconds: progress.elapsedSeconds,
  });
  return { ...progress, capturedOrbs, score: score + levelBonus.total, status: 'levelComplete', levelBonus };
}

/** Advances the level's and the game's clocks while playing. */
export function advanceClock(progress: GameProgress, seconds: number): GameProgress {
  if (progress.status !== 'playing' || !(seconds > 0)) return progress;
  return {
    ...progress,
    elapsedSeconds: progress.elapsedSeconds + seconds,
    totalSeconds: progress.totalSeconds + seconds,
  };
}

/** Failed attempts the player can still afford before the next one causes defeat. */
export function remainingAttempts(progress: GameProgress, maxFailedAttempts: number): number {
  return Math.max(0, maxFailedAttempts - progress.failedAttempts);
}
