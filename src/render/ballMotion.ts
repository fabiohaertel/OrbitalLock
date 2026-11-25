import { length, subtract, type Vec2 } from '../geometry/vector';
import { isPhysicallyActive, type Orb } from '../physics/orb';
import { rollRotation, type Rotation } from './ballOrientation';
import { DEFAULT_BALL_ORIENTATION } from './soccerBall';

/** One translucent copy of the ball that makes up the motion-blur trail. */
export interface TrailGhost {
  readonly position: Vec2;
  readonly radius: number;
  /** Opacity in (0, 1). */
  readonly alpha: number;
}

export interface BallMotionOptions {
  /** The trail covers the distance the ball travels in this many seconds. */
  readonly trailSeconds: number;
  /** Number of ghosts in a full-length trail. */
  readonly ghostCount: number;
  /** Opacity of the ghost nearest the ball; later ghosts fade linearly towards 0. */
  readonly maxAlpha: number;
  /** Radius of the last ghost as a fraction of the ball's; ghosts narrow linearly towards it. */
  readonly tailRadiusRatio: number;
}

export const DEFAULT_BALL_MOTION_OPTIONS: BallMotionOptions = Object.freeze({
  trailSeconds: 0.15,
  ghostCount: 10,
  maxAlpha: 0.2,
  tailRadiusRatio: 0.7,
});

interface BallState {
  orientation: Rotation;
  /** Recent ball centers, newest last; only as long as the trail needs. */
  history: Vec2[];
}

/**
 * Visual motion of the balls (REQUIREMENTS §5.4): how far each ball has
 * rolled, and its motion-blur trail.
 *
 * Both are derived only from how the orbs' positions change between calls to
 * `update`, so they never affect physics and do not depend on frame rate:
 * a ball turns by distance ÷ radius however that distance is split across
 * frames, and the trail is measured in distance along the travelled path.
 * Because the trail follows the recorded path, it bends around bounces instead
 * of crossing the wall the ball bounced off.
 *
 * State is kept per orb object, so the new orbs created by a restart start
 * fresh (resting orientation, no trail). Pure: no Phaser.
 */
export class BallMotion {
  private readonly options: BallMotionOptions;
  private readonly states = new WeakMap<Orb, BallState>();

  constructor(options: BallMotionOptions = DEFAULT_BALL_MOTION_OPTIONS) {
    this.options = options;
  }

  /** Records the orbs' current positions; call once per rendered frame. */
  update(orbs: readonly Orb[]): void {
    for (const orb of orbs) {
      const state = this.states.get(orb);
      if (state === undefined) {
        this.states.set(orb, { orientation: DEFAULT_BALL_ORIENTATION, history: [orb.position] });
        continue;
      }
      const last = state.history[state.history.length - 1] ?? orb.position;
      const moved = subtract(orb.position, last);
      if (moved.x !== 0 || moved.y !== 0) {
        state.orientation = rollRotation(state.orientation, moved, orb.radius);
      }
      if (!isPhysicallyActive(orb)) {
        state.history = [orb.position];
        continue;
      }
      if (moved.x !== 0 || moved.y !== 0) state.history.push(orb.position);
      trimHistory(state.history, this.trailLength(orb));
    }
  }

  /** The ball's current orientation; the resting orientation before its first update. */
  orientation(orb: Orb): Rotation {
    return this.states.get(orb)?.orientation ?? DEFAULT_BALL_ORIENTATION;
  }

  /**
   * Motion-blur ghosts behind the ball, nearest first. Spaced evenly along the
   * travelled path up to the trail length; empty for captured or stopped balls
   * and for balls that have not moved yet.
   */
  trail(orb: Orb): TrailGhost[] {
    const state = this.states.get(orb);
    if (state === undefined || !isPhysicallyActive(orb)) return [];
    const { ghostCount, maxAlpha, tailRadiusRatio } = this.options;
    const spacing = this.trailLength(orb) / ghostCount;
    if (!(spacing > 0)) return [];

    const ghosts: TrailGhost[] = [];
    for (let i = 1; i <= ghostCount; i++) {
      const position = pointBehind(state.history, spacing * i);
      if (position === undefined) break;
      const t = i / ghostCount;
      ghosts.push({
        position,
        radius: orb.radius * (1 - (1 - tailRadiusRatio) * t),
        alpha: maxAlpha * (1 - (i - 1) / ghostCount),
      });
    }
    return ghosts;
  }

  private trailLength(orb: Orb): number {
    return length(orb.velocity) * this.options.trailSeconds;
  }
}

/** Drops the oldest points that are not needed to cover `maxLength` along the path. */
function trimHistory(history: Vec2[], maxLength: number): void {
  let covered = 0;
  for (let i = history.length - 1; i > 0; i--) {
    covered += length(subtract(history[i] as Vec2, history[i - 1] as Vec2));
    if (covered >= maxLength) {
      history.splice(0, i - 1);
      return;
    }
  }
}

/** The point `distance` back along the path from its newest point, or undefined if the path is shorter. */
function pointBehind(history: readonly Vec2[], distance: number): Vec2 | undefined {
  let remaining = distance;
  for (let i = history.length - 1; i > 0; i--) {
    const from = history[i] as Vec2;
    const to = history[i - 1] as Vec2;
    const step = length(subtract(to, from));
    if (step >= remaining && step > 0) {
      const t = remaining / step;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    }
    remaining -= step;
  }
  return undefined;
}
