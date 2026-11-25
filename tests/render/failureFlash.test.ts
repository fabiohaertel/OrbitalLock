import { describe, expect, it } from 'vitest';
import { FAILURE_FLASH_SECONDS, FailureFlash } from '../../src/render/failureFlash';

const path = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
];

describe('FailureFlash', () => {
  it('is hidden initially', () => {
    const flash = new FailureFlash();
    expect(flash.visible).toBe(false);
    expect(flash.path).toEqual([]);
    expect(flash.alpha).toBe(0);
  });

  it('shows a failed path at full opacity, then fades it out', () => {
    const flash = new FailureFlash();
    flash.show(path);
    expect(flash.visible).toBe(true);
    expect(flash.path).toEqual(path);
    expect(flash.alpha).toBe(1);

    flash.tick(FAILURE_FLASH_SECONDS / 2);
    expect(flash.alpha).toBeCloseTo(0.5, 9);

    flash.tick(FAILURE_FLASH_SECONDS);
    expect(flash.visible).toBe(false);
    expect(flash.path).toEqual([]);
  });

  it('keeps its own copy of the path', () => {
    const flash = new FailureFlash();
    const mutable = [...path];
    flash.show(mutable);
    mutable.push({ x: 99, y: 99 });
    expect(flash.path).toHaveLength(2);
  });

  it('restarts when shown again, and can be cleared', () => {
    const flash = new FailureFlash();
    flash.show(path);
    flash.tick(FAILURE_FLASH_SECONDS * 0.9);
    flash.show(path);
    expect(flash.alpha).toBe(1);
    flash.clear();
    expect(flash.visible).toBe(false);
  });

  it('ignores negative time', () => {
    const flash = new FailureFlash();
    flash.show(path);
    flash.tick(-1);
    expect(flash.alpha).toBe(1);
  });

  it('does not show an empty path', () => {
    const flash = new FailureFlash();
    flash.show([]);
    expect(flash.visible).toBe(false);
  });
});
