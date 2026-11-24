import type { ArenaDimensions, GameplayConfig } from '../config/gameConfig';
import { polylineLength } from '../geometry/polyline';
import { distanceSquared, type Vec2 } from '../geometry/vector';
import type { Orb } from '../physics/orb';
import { DrawingSession, createDrawingOptions, type DrawingOptions, type PointerInput } from './drawingSession';
import { findSelfIntersections, findTouchedOrb, snapEndpoint } from './pathAnalysis';
import { wallSegments, type Wall } from './wall';

/** Default endpoint snapping distance in arena units (D1). */
export const DEFAULT_SNAP_DISTANCE = 15;

export interface WallBuilderOptions {
  readonly drawing: DrawingOptions;
  /**
   * Endpoints within this distance of an existing wall or arena edge are snapped
   * onto it, and a path ending this close to its start is closed into a loop.
   */
  readonly snapDistance: number;
}

export function createWallBuilderOptions(
  config: Pick<GameplayConfig, 'minDrawingLength'>,
): WallBuilderOptions {
  return { drawing: createDrawingOptions(config), snapDistance: DEFAULT_SNAP_DISTANCE };
}

/** The result of a drawing attempt that has ended. */
export type WallBuildOutcome =
  /** The drawing was valid; the caller adds `wall` to the arena. */
  | { readonly kind: 'wallCreated'; readonly wall: Wall }
  /** The drawing was released but is not a valid wall (REQUIREMENTS §3.4). */
  | { readonly kind: 'rejected'; readonly reason: 'tooShort' }
  | { readonly kind: 'rejected'; readonly reason: 'touchesOrb'; readonly orbId: number }
  /** The drawing was canceled before release (REQUIREMENTS §3.7, D2, D8). */
  | { readonly kind: 'canceled'; readonly reason: 'orbContact'; readonly orbId: number }
  | { readonly kind: 'canceled'; readonly reason: 'inputCanceled' };

/**
 * Turns pointer input into validated walls (REQUIREMENTS §3.4, §3.7).
 *
 * The builder never changes the arena itself: it only reports outcomes, and the
 * caller adds a created wall to its wall list. A rejected or canceled drawing
 * therefore leaves the arena exactly as it was.
 *
 * While a drawing is in progress (D2), the caller must:
 * - pass every pointer move to `move`, and
 * - call `checkOrbContact` after every physics step,
 * so that an active orb touching the path cancels it, whether the path was
 * drawn into the orb or the orb moved into the path.
 */
export class WallBuilder {
  private readonly arena: ArenaDimensions;
  private readonly options: WallBuilderOptions;
  private readonly session: DrawingSession;
  private nextWallId = 1;

  constructor(arena: ArenaDimensions, options: WallBuilderOptions) {
    if (!(options.snapDistance >= 0)) {
      throw new RangeError('snapDistance must be a number >= 0');
    }
    this.arena = arena;
    this.options = options;
    this.session = new DrawingSession(arena, options.drawing);
  }

  get isDrawing(): boolean {
    return this.session.isDrawing;
  }

  /** In-progress path for the live preview; empty when not drawing. */
  get previewPath(): readonly Vec2[] {
    return this.session.previewPath;
  }

  /**
   * Starts a drawing. Returns undefined if the input did not start one (or
   * started it cleanly), or a cancel outcome if it started on an active orb.
   */
  begin(input: PointerInput, orbs: readonly Orb[]): WallBuildOutcome | undefined {
    if (!this.session.begin(input)) {
      return undefined;
    }
    return this.checkOrbContact(orbs);
  }

  /** Extends the drawing; returns a cancel outcome if the path now touches an active orb. */
  move(input: PointerInput, orbs: readonly Orb[]): WallBuildOutcome | undefined {
    if (!this.session.isDrawing) {
      return undefined;
    }
    this.session.move(input);
    return this.checkOrbContact(orbs);
  }

  /**
   * Cancels the drawing if any active orb touches the in-progress path (D2).
   * Call after every physics step while drawing.
   */
  checkOrbContact(orbs: readonly Orb[]): WallBuildOutcome | undefined {
    if (!this.session.isDrawing) {
      return undefined;
    }
    const touched = findTouchedOrb(this.session.previewPath, orbs);
    if (touched === undefined) {
      return undefined;
    }
    this.session.cancel();
    return { kind: 'canceled', reason: 'orbContact', orbId: touched.id };
  }

  /** Discards the drawing when the browser cancels the input (D8). */
  cancelInput(): WallBuildOutcome | undefined {
    return this.session.cancel() ? { kind: 'canceled', reason: 'inputCanceled' } : undefined;
  }

  /**
   * Finishes the drawing on release and validates it against the current orbs
   * and walls. Returns undefined for input from any other pointer.
   */
  end(
    input: PointerInput,
    orbs: readonly Orb[],
    walls: readonly Wall[],
  ): WallBuildOutcome | undefined {
    const result = this.session.end(input);
    if (result === undefined) {
      return undefined;
    }
    if (result.kind === 'tooShort') {
      return { kind: 'rejected', reason: 'tooShort' };
    }

    const wall = this.shapeWall(result.path, walls);
    if (polylineLength(wall.path) < this.options.drawing.minLength) {
      return { kind: 'rejected', reason: 'tooShort' };
    }

    const touched = findTouchedOrb(wall.path, orbs);
    if (touched !== undefined) {
      return { kind: 'rejected', reason: 'touchesOrb', orbId: touched.id };
    }

    this.nextWallId++;
    return { kind: 'wallCreated', wall };
  }

  /** Applies loop closure or endpoint snapping (D1) and records self-crossings. */
  private shapeWall(rawPath: readonly Vec2[], walls: readonly Wall[]): Wall {
    const path = [...rawPath];
    const first = path[0] as Vec2;
    const last = path[path.length - 1] as Vec2;
    const snapSq = this.options.snapDistance * this.options.snapDistance;
    const id = this.nextWallId;

    // Closed loop: at least a triangle whose end returns near its start.
    if (path.length >= 4 && distanceSquared(first, last) <= snapSq) {
      path[path.length - 1] = first;
      return {
        id,
        path,
        closed: true,
        startAnchor: 'free',
        endAnchor: 'free',
        selfIntersections: findSelfIntersections(path, true),
      };
    }

    const segments = wallSegments(walls);
    const start = snapEndpoint(first, segments, this.arena, this.options.snapDistance);
    const end = snapEndpoint(last, segments, this.arena, this.options.snapDistance);
    path[0] = start.point;
    path[path.length - 1] = end.point;

    return {
      id,
      path,
      closed: false,
      startAnchor: start.anchor,
      endAnchor: end.anchor,
      selfIntersections: findSelfIntersections(path, false),
    };
  }
}
