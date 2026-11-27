import type { Wall } from '../drawing/wall';

/** How long a new wall takes to be painted from its start to its end, in seconds. */
export const WALL_PAINT_SECONDS = 0.2;

/**
 * The "painting" of newly created walls (REQUIREMENTS §5.4): when a wall is
 * committed, its chalk line is painted from the start of the path to its end.
 * Purely visual: the wall blocks orbs in full from the moment it is created.
 */
export class WallPaint {
  private readonly elapsed = new Map<Wall, number>();

  /** Starts painting a newly created wall. */
  start(wall: Wall): void {
    this.elapsed.set(wall, 0);
  }

  tick(seconds: number): void {
    if (!(seconds > 0)) return;
    for (const [wall, time] of this.elapsed) {
      const next = time + seconds;
      if (next >= WALL_PAINT_SECONDS) this.elapsed.delete(wall);
      else this.elapsed.set(wall, next);
    }
  }

  /** Forgets every wall in progress (restart, next level): they all count as painted. */
  clear(): void {
    this.elapsed.clear();
  }

  /**
   * How much of the wall is painted, 0..1, easing out so the paint starts fast
   * and settles. A wall that is not being painted is fully painted (1).
   */
  progress(wall: Wall): number {
    const time = this.elapsed.get(wall);
    if (time === undefined) return 1;
    const t = Math.min(1, time / WALL_PAINT_SECONDS);
    return 1 - (1 - t) ** 3;
  }
}
