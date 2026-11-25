/** Overall game state (REQUIREMENTS §3.8, §8.4). */
export type GameStatus = 'playing' | 'victory' | 'defeat';

/** Placeholder scoring rule until balancing defines the formula (REQUIREMENTS §6). */
export const POINTS_PER_CAPTURED_ORB = 100;

/** Session progress: counters, score and clock. Immutable; every change returns a new value. */
export interface GameProgress {
  readonly status: GameStatus;
  readonly totalOrbs: number;
  readonly capturedOrbs: number;
  readonly failedAttempts: number;
  readonly score: number;
  /** Simulated play time in seconds; stops when the game is over. */
  readonly elapsedSeconds: number;
}

export function createProgress(totalOrbs: number): GameProgress {
  return {
    status: 'playing',
    totalOrbs,
    capturedOrbs: 0,
    failedAttempts: 0,
    score: 0,
    elapsedSeconds: 0,
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

/** Adds captured orbs and their score. Victory when every orb is captured (REQUIREMENTS §3.8). */
export function recordCaptures(progress: GameProgress, count: number): GameProgress {
  if (progress.status !== 'playing' || count <= 0) return progress;
  const capturedOrbs = Math.min(progress.totalOrbs, progress.capturedOrbs + count);
  return {
    ...progress,
    capturedOrbs,
    score: progress.score + count * POINTS_PER_CAPTURED_ORB,
    status: capturedOrbs >= progress.totalOrbs ? 'victory' : 'playing',
  };
}

/** Advances the clock while playing. */
export function advanceClock(progress: GameProgress, seconds: number): GameProgress {
  if (progress.status !== 'playing' || !(seconds > 0)) return progress;
  return { ...progress, elapsedSeconds: progress.elapsedSeconds + seconds };
}

/** Failed attempts the player can still afford before the next one causes defeat. */
export function remainingAttempts(progress: GameProgress, maxFailedAttempts: number): number {
  return Math.max(0, maxFailedAttempts - progress.failedAttempts);
}
