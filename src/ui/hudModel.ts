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
  readonly captured: HudStat;
  readonly remaining: HudStat;
  readonly time: HudStat;
  readonly score: HudStat;
  /** Failed attempts so far against the limit; defeat when exceeded (D3). */
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

  return {
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

/** Victory or defeat screen (REQUIREMENTS §3.8). */
export interface GameOverModel {
  readonly result: 'victory' | 'defeat';
  readonly title: string;
  /** One line under the title saying why the game ended. */
  readonly subtitle: string;
  /** Final scoreboard: score, time and captured orbs. */
  readonly stats: readonly HudStat[];
}

/** Victory or defeat screen content; undefined while playing (REQUIREMENTS §3.8). */
export function buildGameOverModel(progress: GameProgress): GameOverModel | undefined {
  if (progress.status === 'playing') return undefined;
  const time = formatElapsed(progress.elapsedSeconds);
  const captured = `${String(progress.capturedOrbs)}/${String(progress.totalOrbs)}`;
  const stats = [
    stat('SCORE', String(progress.score), `Score: ${String(progress.score)}`),
    stat('TIME', time, `Time: ${time}`),
    stat('CAPTURED', captured, `Captured: ${String(progress.capturedOrbs)} / ${String(progress.totalOrbs)}`),
  ];
  return progress.status === 'victory'
    ? { result: 'victory', title: 'VICTORY', subtitle: 'All orbs captured!', stats }
    : { result: 'defeat', title: 'DEFEAT', subtitle: 'Too many fouls.', stats };
}
