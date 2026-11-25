import type { ArenaDimensions, GameplayConfig } from '../config/gameConfig';
import { polylineLength, simplifyPolyline } from '../geometry/polyline';
import { clampPointToRect, type Rect } from '../geometry/rect';
import { distanceSquared, type Vec2 } from '../geometry/vector';

/** One pointer event, already converted to arena coordinates. */
export interface PointerInput {
  /** Identifies the mouse or the individual touch. */
  readonly pointerId: number;
  /** Arena coordinates; may lie outside the arena. */
  readonly position: Vec2;
  /**
   * True for the primary mouse button or a touch. Only primary input can start
   * a drawing, and only releasing it ends one: on a release, this is the
   * button that was released.
   */
  readonly isPrimary: boolean;
}

export interface DrawingOptions {
  /** Minimum drawing length in arena units (REQUIREMENTS §3.3, §4). */
  readonly minLength: number;
  /** Minimum distance between recorded samples, in arena units. Filters pointer jitter. */
  readonly sampleSpacing: number;
  /**
   * How far the pointer must move from where it was pressed before the press
   * becomes a drawing, in arena units (REQUIREMENTS §3.3). A press released
   * before that (a click or tap) is not a drawing attempt.
   */
  readonly startDistance: number;
  /**
   * Simplification tolerance applied when the drawing finishes, in arena units.
   * Must stay well below the orb radius so the simplified wall follows the stroke.
   */
  readonly simplifyTolerance: number;
}

/** Default sampling and simplification values, in arena units. */
export const DEFAULT_SAMPLE_SPACING = 2;
/** Above the jitter of a click or tap, and well below the minimum drawing length. */
export const DEFAULT_START_DISTANCE = 8;
export const DEFAULT_SIMPLIFY_TOLERANCE = 1;

/** Drawing options from the gameplay config, with default sampling and simplification. */
export function createDrawingOptions(config: Pick<GameplayConfig, 'minDrawingLength'>): DrawingOptions {
  return {
    minLength: config.minDrawingLength,
    sampleSpacing: DEFAULT_SAMPLE_SPACING,
    startDistance: DEFAULT_START_DISTANCE,
    simplifyTolerance: DEFAULT_SIMPLIFY_TOLERANCE,
  };
}

export type DrawingResult =
  /** The path is long enough to be validated as a wall (validation happens in a later step). */
  | { readonly kind: 'completed'; readonly path: readonly Vec2[]; readonly length: number }
  /** The path is shorter than the configured minimum length. */
  | { readonly kind: 'tooShort'; readonly path: readonly Vec2[]; readonly length: number }
  /** Released before the pointer moved far enough to start drawing: not a drawing attempt. */
  | { readonly kind: 'notStarted' };

/**
 * Tracks a single drawing attempt from press to release (REQUIREMENTS §3.3).
 *
 * - Only a primary press (left mouse button or a touch) inside the arena can
 *   start a drawing. The drawing starts once the pointer has moved
 *   `startDistance` away from the press point, and its path begins at the
 *   press point. Until then nothing is drawn, and a release or a browser
 *   cancel ends the press without a drawing attempt.
 * - While drawing, only the pointer that started it is followed; other
 *   pointers (e.g. a second finger) are ignored.
 * - Every point is clamped to the arena, so the path never leaves it.
 * - On release the path is simplified and checked against the minimum length.
 *
 * It holds no game rules beyond that: validation against orbs and walls is
 * done elsewhere.
 */
export class DrawingSession {
  private readonly bounds: Rect;
  private readonly options: DrawingOptions;
  /** The pointer currently pressed, whether or not its drawing has started. */
  private activePointerId: number | undefined;
  private pressPoint: Vec2 | undefined;
  /** Recorded path; empty until the drawing starts. */
  private samples: Vec2[] = [];
  /** Latest clamped pointer position, which may be closer than `sampleSpacing` to the last sample. */
  private tip: Vec2 | undefined;

  constructor(arena: ArenaDimensions, options: DrawingOptions) {
    if (!(options.minLength >= 0)) {
      throw new RangeError('minLength must be a number >= 0');
    }
    if (!(options.sampleSpacing >= 0)) {
      throw new RangeError('sampleSpacing must be a number >= 0');
    }
    if (!(options.startDistance >= 0)) {
      throw new RangeError('startDistance must be a number >= 0');
    }
    if (!(options.simplifyTolerance >= 0)) {
      throw new RangeError('simplifyTolerance must be a number >= 0');
    }
    this.bounds = { x: 0, y: 0, width: arena.width, height: arena.height };
    this.options = options;
  }

  /** True from the moment a press becomes a drawing until the drawing ends. */
  get isDrawing(): boolean {
    return this.samples.length > 0;
  }

  /** True while a pointer is pressed, whether or not it has started drawing. */
  get isPressed(): boolean {
    return this.activePointerId !== undefined;
  }

  /**
   * Current stroke for the live preview (REQUIREMENTS §3.3 "immediate visual
   * feedback"): the recorded samples followed by the latest pointer position.
   * Empty when not drawing.
   */
  get previewPath(): readonly Vec2[] {
    const last = this.samples.at(-1);
    if (this.tip === undefined || last === undefined || distanceSquared(this.tip, last) === 0) {
      return this.samples;
    }
    return [...this.samples, this.tip];
  }

  /**
   * Records a press that may become a drawing. Returns false (and ignores the
   * input) if it cannot start one.
   */
  begin(input: PointerInput): boolean {
    if (this.isPressed || !input.isPrimary || !this.isInsideArena(input.position)) {
      return false;
    }
    this.activePointerId = input.pointerId;
    this.pressPoint = input.position;
    return true;
  }

  /** Extends the drawing. Input from any pointer other than the active one is ignored. */
  move(input: PointerInput): void {
    if (input.pointerId !== this.activePointerId) {
      return;
    }
    const point = clampPointToRect(input.position, this.bounds);
    if (!this.isDrawing) {
      if (this.pressPoint === undefined || !this.leavesStartArea(this.pressPoint, point)) {
        return;
      }
      this.samples = [this.pressPoint];
    }
    const last = this.samples.at(-1);
    const spacing = this.options.sampleSpacing;
    if (last === undefined || distanceSquared(last, point) >= spacing * spacing) {
      this.samples.push(point);
    }
    this.tip = point;
  }

  /**
   * Finishes the press when the active pointer is released, including the
   * release position. Returns `notStarted` if it never became a drawing, and
   * undefined for any other pointer. Releasing another mouse button (e.g. a
   * right click while drawing) shares the mouse's pointer id but is not
   * primary, so it is ignored too: only releasing the primary button ends the
   * drawing (REQUIREMENTS §3.3).
   */
  end(input: PointerInput): DrawingResult | undefined {
    if (input.pointerId !== this.activePointerId || !input.isPrimary) {
      return undefined;
    }
    this.move(input);
    if (!this.isDrawing) {
      this.clear();
      return { kind: 'notStarted' };
    }

    const path = simplifyPolyline(this.previewPath, this.options.simplifyTolerance);
    const length = polylineLength(path);
    this.clear();

    // A drawing must cover some distance, even when the configured minimum is 0.
    return length > 0 && length >= this.options.minLength
      ? { kind: 'completed', path, length }
      : { kind: 'tooShort', path, length };
  }

  /**
   * Discards the press and any drawing in progress, e.g. when the browser
   * cancels the touch. Returns true only if a started drawing was discarded.
   */
  cancel(): boolean {
    const wasDrawing = this.isDrawing;
    this.clear();
    return wasDrawing;
  }

  private clear(): void {
    this.activePointerId = undefined;
    this.pressPoint = undefined;
    this.samples = [];
    this.tip = undefined;
  }

  /** True when `point` is far enough from the press to start drawing; any real movement if the distance is 0. */
  private leavesStartArea(press: Vec2, point: Vec2): boolean {
    const distanceSq = distanceSquared(press, point);
    const threshold = this.options.startDistance;
    return distanceSq > 0 && distanceSq >= threshold * threshold;
  }

  private isInsideArena(point: Vec2): boolean {
    return (
      point.x >= 0 && point.x <= this.bounds.width && point.y >= 0 && point.y <= this.bounds.height
    );
  }
}
