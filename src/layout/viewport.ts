import type { Viewport } from './screenLayout';

/**
 * Highest pixel ratio rendered. Higher-density screens are drawn at this ratio
 * and upscaled by the browser, keeping the canvas size (GPU fill-rate) bounded.
 */
export const MAX_PIXEL_RATIO = 2;

/** Device pixel ratio clamped to [1, MAX_PIXEL_RATIO]; invalid values count as 1. */
export function capPixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio < 1) return 1;
  return Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
}

/** Measures the element the game fills. */
export function readViewport(element: HTMLElement): Viewport {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
    pixelRatio: capPixelRatio(window.devicePixelRatio),
  };
}

/**
 * Calls `onChange` whenever the element's size or the pixel ratio changes:
 * window resizes, orientation changes and mobile browser toolbars showing or
 * hiding (REQUIREMENTS §5.1, §7.2). Bursts of events are coalesced into one
 * call per animation frame. Returns a function that stops watching.
 */
export function watchViewport(element: HTMLElement, onChange: (viewport: Viewport) => void): () => void {
  let last = readViewport(element);
  let frame: number | undefined;

  const check = () => {
    frame = undefined;
    const next = readViewport(element);
    if (next.width !== last.width || next.height !== last.height || next.pixelRatio !== last.pixelRatio) {
      last = next;
      onChange(next);
    }
  };
  const schedule = () => {
    frame ??= requestAnimationFrame(check);
  };

  const observer = new ResizeObserver(schedule);
  observer.observe(element);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
}
