import { describe, expect, it } from 'vitest';
import { polylineLength } from '../../src/geometry/polyline';
import {
  FAILURE_BREAK_DELAY_SECONDS,
  FAILURE_FLASH_SECONDS,
  FAILURE_PIECE_LENGTH,
  FailureFlash,
} from '../../src/render/failureFlash';

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
    expect(flash.pieces).toEqual([]);
  });
});

describe('FailureFlash: the failed line breaks apart (REQUIREMENTS §3.7, §5.4)', () => {
  const long = [
    { x: 100, y: 100 },
    { x: 340, y: 100 },
    { x: 340, y: 220 },
  ];
  const totalLength = 240 + 120;

  it('breaks the path into pieces about FAILURE_PIECE_LENGTH long that cover it', () => {
    const flash = new FailureFlash();
    flash.show(long);
    const pieces = flash.pieces;
    expect(pieces).toHaveLength(Math.round(totalLength / FAILURE_PIECE_LENGTH));
    const covered = pieces.reduce((sum, piece) => sum + polylineLength(piece.points), 0);
    expect(covered).toBeCloseTo(totalLength, 6);
    expect(pieces[0]?.points[0]).toEqual(long[0]);
    expect(pieces.at(-1)?.points.at(-1)).toEqual(long[2]);
    for (const piece of pieces) expect(piece.alpha).toBe(1);
  });

  it('stays whole briefly, then the pieces drift, spin and fall, keeping their length', () => {
    const flash = new FailureFlash();
    flash.show(long);
    const whole = flash.pieces;
    flash.tick(FAILURE_BREAK_DELAY_SECONDS * 0.5);
    expect(flash.pieces.map((p) => p.points)).toEqual(whole.map((p) => p.points));

    flash.tick(FAILURE_FLASH_SECONDS * 0.4);
    const moved = flash.pieces;
    const centerY = (points: readonly { y: number }[]) => points.reduce((s, p) => s + p.y, 0) / points.length;
    let fallen = 0;
    moved.forEach((piece, i) => {
      const before = whole[i]?.points ?? [];
      expect(piece.points).not.toEqual(before);
      expect(polylineLength(piece.points)).toBeCloseTo(polylineLength(before), 6);
      if (centerY(piece.points) > centerY(before)) fallen++;
    });
    expect(fallen).toBeGreaterThan(moved.length / 2);
    expect(moved[0]?.alpha).toBeLessThan(1);
  });

  it('fades the pieces out and hides them when the flash ends', () => {
    const flash = new FailureFlash();
    flash.show(long);
    flash.tick(FAILURE_FLASH_SECONDS / 2);
    expect(flash.pieces[0]?.alpha).toBeCloseTo(0.5, 9);
    flash.tick(FAILURE_FLASH_SECONDS);
    expect(flash.pieces).toEqual([]);
  });

  it('breaks the same way on every run (deterministic sequence)', () => {
    const run = () => {
      const flash = new FailureFlash();
      flash.show(long);
      flash.tick(0.3);
      const first = flash.pieces;
      flash.show(long);
      flash.tick(0.3);
      return [first, flash.pieces];
    };
    expect(run()).toEqual(run());
  });

  it('shows a single-point failure as one still piece', () => {
    const flash = new FailureFlash();
    flash.show([{ x: 5, y: 5 }]);
    expect(flash.pieces).toEqual([{ points: [{ x: 5, y: 5 }], alpha: 1 }]);
  });
});
