import { resolveCaptures, type CaptureReport } from '../capture/captureSystem';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG, type ArenaDimensions, type GameplayConfig } from '../config/gameConfig';
import type { PointerInput } from '../drawing/drawingSession';
import { wallSegments, type Wall } from '../drawing/wall';
import { WallBuilder, createWallBuilderOptions, type WallBuildOutcome } from '../drawing/wallBuilder';
import { FIRST_LEVEL, levelConfig } from '../game/levels';
import {
  advanceClock,
  createProgress,
  recordCaptures,
  recordFailedAttempt,
  startLevel,
  type GameProgress,
  type GameStatus,
} from '../game/progress';
import type { LevelClearBonus } from '../game/scoring';
import type { Region } from '../geometry/regions';
import type { Segment } from '../geometry/segment';
import type { Vec2 } from '../geometry/vector';
import { FixedTimestep } from '../physics/fixedTimestep';
import type { Orb } from '../physics/orb';
import { stepPhysics, type OrbCollision } from '../physics/simulation';
import { createOrbs } from '../physics/spawn';

/** A drawing attempt that failed: rejected on release or canceled while drawing (D3). */
export type FailedAttempt = Extract<WallBuildOutcome, { kind: 'rejected' | 'canceled' }>;

/** Something that happened in the world, for rendering and feedback. */
export type GameEvent =
  | { readonly kind: 'wallCreated'; readonly wall: Wall; readonly capture: CaptureReport }
  | { readonly kind: 'attemptFailed'; readonly attempt: FailedAttempt }
  /** An orb bounced off the arena, a wall or another orb (REQUIREMENTS §5.5). */
  | { readonly kind: 'collision'; readonly collision: OrbCollision }
  /** Every orb of the level was captured; the next level waits for `nextLevel()` (D10). */
  | { readonly kind: 'levelComplete'; readonly level: number; readonly bonus: LevelClearBonus }
  | { readonly kind: 'gameOver'; readonly status: 'defeat' };

/** Gameplay config of one level, built from the base config (REQUIREMENTS §4, D10). */
export type LevelConfigSource = (level: number, base: GameplayConfig) => GameplayConfig;

export interface GameWorldOptions {
  /** Base config; each level's config is built from it (REQUIREMENTS §4). */
  readonly config?: GameplayConfig;
  readonly arena?: ArenaDimensions;
  /** Config of each level. Defaults to the level table (`levelConfig`, D10). */
  readonly levelConfig?: LevelConfigSource;
  /** Level a new game starts at. Defaults to `FIRST_LEVEL`; other values are for development. */
  readonly firstLevel?: number;
  /**
   * Creates the orbs for a level, from that level's config. Called on
   * construction, on every restart and on every new level. Defaults to
   * `config.initialOrbCount` orbs at random positions.
   */
  readonly spawnOrbs?: (config: GameplayConfig, arena: ArenaDimensions) => Orb[];
}

/**
 * The whole game without rendering: orbs, walls, drawing, captures and game
 * rules, driven by frame time and pointer input. Phaser scenes only forward
 * input to it and draw its state.
 */
export class GameWorld {
  /** Base config; `config` is the current level's. */
  readonly baseConfig: GameplayConfig;
  readonly arena: ArenaDimensions;
  private readonly configForLevel: LevelConfigSource;
  private readonly firstLevel: number;
  private readonly spawnOrbs: (config: GameplayConfig, arena: ArenaDimensions) => Orb[];

  private currentConfig!: GameplayConfig;
  private orbList: Orb[] = [];
  private wallList: Wall[] = [];
  private segments: Segment[] = [];
  private captured: Region[] = [];
  private builder!: WallBuilder;
  private timestep!: FixedTimestep;
  private state!: GameProgress;

  constructor(options: GameWorldOptions = {}) {
    this.baseConfig = options.config ?? DEFAULT_GAMEPLAY_CONFIG;
    this.arena = options.arena ?? ARENA;
    this.configForLevel = options.levelConfig ?? ((level, base) => levelConfig(level, base, this.arena));
    this.firstLevel = options.firstLevel ?? FIRST_LEVEL;
    this.spawnOrbs = options.spawnOrbs ?? ((config, arena) => createOrbs(config, arena));
    this.restart();
  }

  /** Config of the current level (D10). */
  get config(): GameplayConfig {
    return this.currentConfig;
  }

  get level(): number {
    return this.state.level;
  }

  get progress(): GameProgress {
    return this.state;
  }

  get status(): GameStatus {
    return this.state.status;
  }

  get orbs(): readonly Orb[] {
    return this.orbList;
  }

  get walls(): readonly Wall[] {
    return this.wallList;
  }

  /** Regions that became solid when their orbs were captured (D4). */
  get capturedRegions(): readonly Region[] {
    return this.captured;
  }

  get isDrawing(): boolean {
    return this.builder.isDrawing;
  }

  /** In-progress drawing for the live preview. */
  get previewPath(): readonly Vec2[] {
    return this.builder.previewPath;
  }

  /** Starts a new game at the first level with a score of 0 (REQUIREMENTS §3.8 "restart", D10). */
  restart(): void {
    this.setUpLevel(this.firstLevel);
    this.state = createProgress(this.orbList.length, this.firstLevel);
  }

  /**
   * Starts the next level after the current one was cleared: an empty arena,
   * new orbs and the next level's config. Fouls and the level clock reset; the
   * score and total time are kept (D10). Does nothing unless the level is
   * complete. Returns whether a new level started.
   */
  nextLevel(): boolean {
    if (this.state.status !== 'levelComplete') return false;
    const level = this.state.level + 1;
    this.setUpLevel(level);
    this.state = startLevel(this.state, level, this.orbList.length);
    return true;
  }

  /** Clears the arena and spawns `level`'s orbs; the caller sets the progress. */
  private setUpLevel(level: number): void {
    this.currentConfig = this.configForLevel(level, this.baseConfig);
    this.orbList = this.spawnOrbs(this.currentConfig, this.arena);
    this.wallList = [];
    this.segments = [];
    this.captured = [];
    this.builder = new WallBuilder(this.arena, createWallBuilderOptions(this.currentConfig));
    this.timestep = new FixedTimestep();
  }

  /**
   * Advances the simulation by one frame. Physics, the drawing-contact check
   * and the clock all run in fixed steps, so results do not depend on frame
   * rate. Nothing moves once the level is cleared or the game is lost.
   */
  update(frameSeconds: number): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.state.status !== 'playing') return events;

    this.timestep.advance(frameSeconds, (dt) => {
      if (this.state.status !== 'playing') return;
      const collisions = stepPhysics(this.orbList, { arena: this.arena, walls: this.segments }, dt);
      for (const collision of collisions) events.push({ kind: 'collision', collision });
      this.state = advanceClock(this.state, dt);
      this.handle(this.builder.checkOrbContact(this.orbList), events);
    });
    return events;
  }

  /**
   * A press only records where the pointer went down. It produces no events:
   * the drawing starts once the pointer moves away (REQUIREMENTS §3.3).
   */
  pointerDown(input: PointerInput): GameEvent[] {
    return this.whilePlaying(() => {
      this.builder.begin(input);
    });
  }

  pointerMove(input: PointerInput): GameEvent[] {
    return this.whilePlaying((events) => {
      this.handle(this.builder.move(input, this.orbList), events);
    });
  }

  pointerUp(input: PointerInput): GameEvent[] {
    return this.whilePlaying((events) => {
      this.handle(this.builder.end(input, this.orbList, this.wallList), events);
    });
  }

  /** The browser canceled the input (e.g. `pointercancel`); counts as a canceled drawing (D3, D8). */
  pointerCancel(): GameEvent[] {
    return this.whilePlaying((events) => {
      this.handle(this.builder.cancelInput(), events);
    });
  }

  private whilePlaying(action: (events: GameEvent[]) => void): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.state.status === 'playing') action(events);
    return events;
  }

  private handle(outcome: WallBuildOutcome | undefined, events: GameEvent[]): void {
    if (outcome === undefined) return;

    if (outcome.kind === 'wallCreated') {
      this.wallList = [...this.wallList, outcome.wall];
      this.segments = wallSegments(this.wallList);
      const capture = resolveCaptures(this.arena, this.wallList, outcome.wall.id, this.orbList, this.config);
      this.captured = [...this.captured, ...capture.capturedRegions];
      this.state = recordCaptures(this.state, capture.capturedOrbIds.length, this.config.maxFailedAttempts);
      events.push({ kind: 'wallCreated', wall: outcome.wall, capture });
    } else {
      // Every rejected or canceled drawing is a failed attempt (D3). A valid wall
      // whose region is too large is not: the wall stays and nothing is counted.
      this.state = recordFailedAttempt(this.state, this.config.maxFailedAttempts);
      events.push({ kind: 'attemptFailed', attempt: outcome });
    }

    if (this.state.status === 'playing') return;
    // Also drops a press that has not started drawing yet.
    this.builder.cancelInput();
    if (this.state.status === 'levelComplete' && this.state.levelBonus !== undefined) {
      events.push({ kind: 'levelComplete', level: this.state.level, bonus: this.state.levelBonus });
    } else if (this.state.status === 'defeat') {
      events.push({ kind: 'gameOver', status: 'defeat' });
    }
  }
}
