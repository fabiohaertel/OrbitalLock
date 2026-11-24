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
  /** True for the primary mouse button or a touch. Only primary input can start a drawing. */
  readonly isPrimary: boolean;
}

export interface DrawingOptions {
  /** Minimum drawing length in arena units (REQUIREMENTS §3.3, §4). */
  readonly minLength: number;
  /** Minimum distance between recorded samples, in arena units. Filters pointer jitter. */
  readonly sampleSpacing: number;
  /**
   * Simplification tolerance applied when the drawing finishes, in arena units.
   * Must stay well below the orb radius so the simplified wall follows the stroke.
   */
  readonly simplifyTolerance: number;
}

/** Default sampling and simplification values, in arena units. */
export const DEFAULT_SAMPLE_SPACING = 2;
export const DEFAULT_SIMPLIFY_TOLERANCE = 1;

/** Drawing options from the gameplay config, with default sampling and simplification. */
export function createDrawingOptions(config: Pick<GameplayConfig, 'minDrawingLength'>): DrawingOptions {
  return {
    minLength: config.minDrawingLength,
    sampleSpacing: DEFAULT_SAMPLE_SPACING,
    simplifyTolerance: DEFAULT_SIMPLIFY_TOLERANCE,
  };
}

export type DrawingResult =
  /** The path is long enough to be validated as a wall (validation happens in a later step). */
  | { readonly kind: 'completed'; readonly path: readonly Vec2[]; readonly length: number }
  /** The path is shorter than the configured minimum length. */
  | { readonly kind: 'tooShort'; readonly path: readonly Vec2[]; readonly length: number };

/**
 * Tracks a single drawing attempt from press to release (REQUIREMENTS §3.3).
 *
 * - Only primary input (left mouse button or a touch) starts a drawing, and
 *   only when it starts inside the arena.
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
  private activePointerId: number | undefined;
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
    if (!(options.simplifyTolerance >= 0)) {
      throw new RangeError('simplifyTolerance must be a number >= 0');
    }
    this.bounds = { x: 0, y: 0, width: arena.width, height: arena.height };
    this.options = options;
  }

  get isDrawing(): boolean {
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

  /** Starts a drawing. Returns false (and ignores the input) if it cannot start. */
  begin(input: PointerInput): boolean {
    if (this.isDrawing || !input.isPrimary || !this.isInsideArena(input.position)) {
      return false;
    }
    this.activePointerId = input.pointerId;
    this.samples = [input.position];
    this.tip = input.position;
    return true;
  }

  /** Extends the drawing. Input from any pointer other than the active one is ignored. */
  move(input: PointerInput): void {
    if (input.pointerId !== this.activePointerId) {
      return;
    }
    const point = clampPointToRect(input.position, this.bounds);
    const last = this.samples.at(-1);
    const spacing = this.options.sampleSpacing;
    if (last === undefined || distanceSquared(last, point) >= spacing * spacing) {
      this.samples.push(point);
    }
    this.tip = point;
  }

  /**
   * Finishes the drawing when the active pointer is released, including the
   * release position. Returns undefined for any other pointer.
   */
  end(input: PointerInput): DrawingResult | undefined {
    if (input.pointerId !== this.activePointerId) {
      return undefined;
    }
    this.move(input);

    const path = simplifyPolyline(this.previewPath, this.options.simplifyTolerance);
    const length = polylineLength(path);
    this.clear();

    // A drawing must cover some distance, even when the configured minimum is 0.
    return length > 0 && length >= this.options.minLength
      ? { kind: 'completed', path, length }
      : { kind: 'tooShort', path, length };
  }

  /**
   * Discards the drawing in progress, e.g. when the browser cancels the touch.
   * Returns true if a drawing was discarded.
   */
  cancel(): boolean {
    const wasDrawing = this.isDrawing;
    this.clear();
    return wasDrawing;
  }

  private clear(): void {
    this.activePointerId = undefined;
    this.samples = [];
    this.tip = undefined;
  }

  private isInsideArena(point: Vec2): boolean {
    return (
      point.x >= 0 && point.x <= this.bounds.width && point.y >= 0 && point.y <= this.bounds.height
    );
  }
}
