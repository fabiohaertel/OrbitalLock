import { polylineLength } from '../geometry/polyline';
import type { Vec2 } from '../geometry/vector';
import { createSeededRandom } from '../physics/random';
import { slicePath } from './dashedPath';

/** How long a failed drawing stays visible, in seconds. */
export const FAILURE_FLASH_SECONDS = 0.6;
/** The failed line is broken into pieces about this long (arena units). */
export const FAILURE_PIECE_LENGTH = 24;
/** The line stays whole, flashing red, this long before it breaks apart. */
export const FAILURE_BREAK_DELAY_SECONDS = 0.08;
/** Pieces drift apart at this speed range (arena units per second)... */
const DRIFT_SPEED_MIN = 20;
const DRIFT_SPEED_MAX = 70;
/** ...spin at up to this rate (radians per second)... */
const MAX_SPIN = 5;
/** ...and fall, pulled down the screen (arena units per second squared). */
const FALL_ACCELERATION = 320;
/** Base seed: each foul breaks differently, but the sequence is reproducible. */
const PIECE_SEED = 0xfa17;

/** One broken piece of a failed line, ready to draw. */
export interface FailurePiece {
  readonly points: readonly Vec2[];
  readonly alpha: number;
}

interface PieceMotion {
  readonly points: readonly Vec2[];
  readonly center: Vec2;
  readonly velocity: Vec2;
  readonly spin: number;
}

/**
 * Visual feedback for a rejected or canceled drawing (REQUIREMENTS §3.7,
 * §5.4): the failed path turns red, breaks into pieces that drift apart,
 * spin, fall and fade out. Purely visual.
 */
export class FailureFlash {
  private flashPath: readonly Vec2[] = [];
  private motions: readonly PieceMotion[] = [];
  private remaining = 0;
  private shown = 0;

  /** Starts showing `path`, replacing any flash in progress. */
  show(path: readonly Vec2[]): void {
    this.flashPath = [...path];
    this.remaining = FAILURE_FLASH_SECONDS;
    this.motions = breakIntoPieces(this.flashPath, PIECE_SEED + this.shown++);
  }

  tick(seconds: number): void {
    if (seconds > 0) this.remaining = Math.max(0, this.remaining - seconds);
  }

  clear(): void {
    this.remaining = 0;
  }

  get visible(): boolean {
    return this.remaining > 0 && this.flashPath.length > 0;
  }

  /** The failed path as drawn, before it broke; empty when not visible. */
  get path(): readonly Vec2[] {
    return this.visible ? this.flashPath : [];
  }

  /** Opacity in (0, 1], fading linearly; 0 when not visible. */
  get alpha(): number {
    return this.visible ? this.remaining / FAILURE_FLASH_SECONDS : 0;
  }

  /** The broken pieces at their current position and opacity; empty when not visible. */
  get pieces(): readonly FailurePiece[] {
    if (!this.visible) return [];
    const alpha = this.alpha;
    const t = Math.max(0, FAILURE_FLASH_SECONDS - this.remaining - FAILURE_BREAK_DELAY_SECONDS);
    return this.motions.map((motion) => ({ points: movePiece(motion, t), alpha }));
  }
}

/** Cuts the path into pieces of about `FAILURE_PIECE_LENGTH`, each with its own drift and spin. */
function breakIntoPieces(path: readonly Vec2[], seed: number): PieceMotion[] {
  const total = polylineLength(path);
  if (path.length < 2 || total <= 0) {
    return path.length === 1 ? [still(path)] : [];
  }
  const random = createSeededRandom(seed);
  const count = Math.max(1, Math.round(total / FAILURE_PIECE_LENGTH));
  const length = total / count;
  const motions: PieceMotion[] = [];
  for (let i = 0; i < count; i++) {
    const points = slicePath(path, i * length, (i + 1) * length);
    if (points.length < 2) continue;
    const angle = random() * 2 * Math.PI;
    const speed = DRIFT_SPEED_MIN + (DRIFT_SPEED_MAX - DRIFT_SPEED_MIN) * random();
    motions.push({
      points,
      center: centroid(points),
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      spin: (random() * 2 - 1) * MAX_SPIN,
    });
  }
  return motions;
}

function still(points: readonly Vec2[]): PieceMotion {
  return { points, center: centroid(points), velocity: { x: 0, y: 0 }, spin: 0 };
}

/** The piece `t` seconds after the break: turned about its centre, drifted and fallen. */
function movePiece(motion: PieceMotion, t: number): Vec2[] {
  if (t <= 0) return [...motion.points];
  const angle = motion.spin * t;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = motion.velocity.x * t;
  const dy = motion.velocity.y * t + 0.5 * FALL_ACCELERATION * t * t;
  const { x: cx, y: cy } = motion.center;
  return motion.points.map((p) => ({
    x: cx + (p.x - cx) * cos - (p.y - cy) * sin + dx,
    y: cy + (p.x - cx) * sin + (p.y - cy) * cos + dy,
  }));
}

function centroid(points: readonly Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}
