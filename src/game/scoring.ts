/** Scoring rules (REQUIREMENTS §6, D11). */

export const CAPTURE_POINTS_PER_LEVEL = 100;
export const LEVEL_BONUS_PER_LEVEL = 500;
export const BONUS_PER_UNUSED_FOUL = 200;
export const TIME_BONUS_PER_SECOND = 10;
/** Level time after which the time bonus is zero, in seconds. */
export const TIME_BONUS_WINDOW_SECONDS = 60;

/** Points for capturing `count` orbs on `level`: `100 × level` each. */
export function captureScore(count: number, level: number): number {
  return Math.max(0, count) * CAPTURE_POINTS_PER_LEVEL * level;
}

export interface LevelClearInput {
  readonly level: number;
  /** Fouls still unused: the level's foul limit minus the fouls committed. */
  readonly foulsLeft: number;
  /** Time spent on the level, in seconds. */
  readonly levelSeconds: number;
}

/** The level-clear bonus, part by part, as shown on the level-cleared screen. */
export interface LevelClearBonus {
  readonly level: number;
  readonly fouls: number;
  readonly time: number;
  readonly total: number;
}

/**
 * Bonus for clearing a level: `500 × level`, `200` per unused foul, and `10`
 * per whole second under 60 s. No part is negative.
 */
export function levelClearBonus({ level, foulsLeft, levelSeconds }: LevelClearInput): LevelClearBonus {
  const levelPart = LEVEL_BONUS_PER_LEVEL * level;
  const fouls = BONUS_PER_UNUSED_FOUL * Math.max(0, foulsLeft);
  const secondsLeft = Number.isFinite(levelSeconds) ? Math.floor(Math.max(0, TIME_BONUS_WINDOW_SECONDS - levelSeconds)) : 0;
  const time = TIME_BONUS_PER_SECOND * Math.min(TIME_BONUS_WINDOW_SECONDS, secondsLeft);
  return { level: levelPart, fouls, time, total: levelPart + fouls + time };
}
