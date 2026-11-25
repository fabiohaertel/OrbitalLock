import type { Vec2 } from '../geometry/vector';

/** How long a failed drawing stays visible, in seconds. */
export const FAILURE_FLASH_SECONDS = 0.6;

/**
 * Visual feedback for a rejected or canceled drawing (REQUIREMENTS §3.7): the
 * failed path stays on screen briefly and fades out.
 */
export class FailureFlash {
  private flashPath: readonly Vec2[] = [];
  private remaining = 0;

  /** Starts showing `path`, replacing any flash in progress. */
  show(path: readonly Vec2[]): void {
    this.flashPath = [...path];
    this.remaining = FAILURE_FLASH_SECONDS;
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

  get path(): readonly Vec2[] {
    return this.visible ? this.flashPath : [];
  }

  /** Opacity in (0, 1], fading linearly; 0 when not visible. */
  get alpha(): number {
    return this.visible ? this.remaining / FAILURE_FLASH_SECONDS : 0;
  }
}
