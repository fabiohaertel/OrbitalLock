import type { GameplayConfig } from '../config/gameConfig';
import type { GameProgress } from '../game/progress';

/** One scoreboard card: a short label above a large value (REQUIREMENTS §5.3). */
export interface HudStat {
  /** Upper-case card label, e.g. `CAPTURED`. */
  readonly label: string;
  /** Value shown large, e.g. `3/8`. */
  readonly value: string;
  /** The whole field as plain text, e.g. `Captured: 3 / 8` (for tests and accessibility). */
  readonly text: string;
}

/** Failed attempts, shown as one pip per allowed foul (REQUIREMENTS §5.3). */
export interface HudFouls extends HudStat {
  /** Failed attempts so far. */
  readonly used: number;
  /** `maxFailedAttempts`: defeat comes with the foul after this many (D3). */
  readonly max: number;
  /** True when pips are drawn; above `MAX_FOUL_PIPS` the value is shown as text instead. */
  readonly showPips: boolean;
  /** True when the next foul loses the game. */
  readonly danger: boolean;
}

/** What each HUD card shows (REQUIREMENTS §5.2, §5.3). */
export interface HudModel {
  /** Current level (D10). */
  readonly level: HudStat;
  readonly captured: HudStat;
  readonly remaining: HudStat;
  /** The current level's time. */
  readonly time: HudStat;
  /** The whole game's score. */
  readonly score: HudStat;
  /** Failed attempts so far against the level's limit; defeat when exceeded (D3). */
  readonly fouls: HudFouls;
}

/** Most foul pips drawn; larger limits (e.g. development overrides) are shown as `used/max`. */
export const MAX_FOUL_PIPS = 8;

/** Formats seconds as `mm:ss` (minutes keep counting past 59). */
export function formatElapsed(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function stat(label: string, value: string, text: string): HudStat {
  return { label, value, text };
}

export function buildHudModel(
  progress: GameProgress,
  config: Pick<GameplayConfig, 'maxFailedAttempts'>,
): HudModel {
  const captured = String(progress.capturedOrbs);
  const total = String(progress.totalOrbs);
  const remaining = String(progress.totalOrbs - progress.capturedOrbs);
  const time = formatElapsed(progress.elapsedSeconds);
  const score = String(progress.score);
  const used = progress.failedAttempts;
  const max = config.maxFailedAttempts;

  const level = String(progress.level);

  return {
    level: stat('LEVEL', level, `Level: ${level}`),
    captured: stat('CAPTURED', `${captured}/${total}`, `Captured: ${captured} / ${total}`),
    remaining: stat('REMAINING', remaining, `Remaining: ${remaining}`),
    time: stat('TIME', time, `Time: ${time}`),
    score: stat('SCORE', score, `Score: ${score}`),
    fouls: {
      ...stat('FOULS', `${String(used)}/${String(max)}`, `Fouls: ${String(used)} / ${String(max)}`),
      used,
      max,
      showPips: max > 0 && max <= MAX_FOUL_PIPS,
      danger: progress.status === 'playing' && used >= max,
    },
  };
}

/** What the end-screen button does. */
export type EndScreenAction = 'nextLevel' | 'restart';

/** Level-cleared or defeat screen (REQUIREMENTS §3.8, §5.6). */
export interface EndScreenModel {
  readonly result: 'levelComplete' | 'defeat';
  readonly title: string;
  /** One line under the title: the bonus and new score, or why the game ended. */
  readonly subtitle: string;
  /** Level cleared: the bonus parts (D11). Defeat: score, level reached and total time. */
  readonly stats: readonly HudStat[];
  readonly button: { readonly label: string; readonly action: EndScreenAction };
}

function points(value: number): string {
  return `+${String(value)}`;
}

/** Level-cleared or defeat screen content; undefined while playing (REQUIREMENTS §3.8, §5.6). */
export function buildEndScreenModel(progress: GameProgress): EndScreenModel | undefined {
  const level = String(progress.level);
  const score = String(progress.score);

  if (progress.status === 'levelComplete') {
    const bonus = progress.levelBonus ?? { level: 0, fouls: 0, time: 0, total: 0 };
    return {
      result: 'levelComplete',
      title: `LEVEL ${level} CLEAR`,
      subtitle: `Bonus ${points(bonus.total)} · Score ${score}`,
      stats: [
        stat('LEVEL', points(bonus.level), `Level bonus: ${points(bonus.level)}`),
        stat('FOULS', points(bonus.fouls), `Fouls bonus: ${points(bonus.fouls)}`),
        stat('TIME', points(bonus.time), `Time bonus: ${points(bonus.time)}`),
      ],
      button: { label: 'NEXT LEVEL', action: 'nextLevel' },
    };
  }

  if (progress.status === 'defeat') {
    const time = formatElapsed(progress.totalSeconds);
    return {
      result: 'defeat',
      title: 'DEFEAT',
      subtitle: 'Too many fouls.',
      stats: [
        stat('SCORE', score, `Score: ${score}`),
        stat('LEVEL', level, `Level: ${level}`),
        stat('TIME', time, `Time: ${time}`),
      ],
      button: { label: 'PLAY AGAIN', action: 'restart' },
    };
  }

  return undefined;
}
