import { describe, expect, it } from 'vitest';
import {
  applyCaptures,
  evaluateRegions,
  maxCaptureArea,
  resolveCaptures,
} from '../../src/capture/captureSystem';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import { detectRegions, type RegionWall } from '../../src/geometry/regions';
import { vec } from '../../src/geometry/vector';
import { isPhysicallyActive } from '../../src/physics/orb';
import { makeOrb } from '../physics/helpers';

const config = DEFAULT_GAMEPLAY_CONFIG;
const maxArea = maxCaptureArea(ARENA, config);

let nextWallId = 1;
function wall(...points: [number, number][]): RegionWall {
  return { id: nextWallId++, path: points.map(([x, y]) => vec(x, y)) };
}

function square(x: number, y: number, size: number): RegionWall {
  return wall([x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]);
}

describe('maxCaptureArea', () => {
  it('is 15% of the arena area by default', () => {
    expect(maxArea).toBeCloseTo(ARENA.width * ARENA.height * 0.15, 9);
  });

  it('follows the configured ratio', () => {
    expect(maxCaptureArea(ARENA, { maxCaptureAreaRatio: 0.5 })).toBeCloseTo(
      ARENA.width * ARENA.height * 0.5,
      9,
    );
  });
});

describe('evaluateRegions', () => {
  it('captures a small region containing an active orb', () => {
    const loop = square(100, 100, 100);
    const orb = makeOrb(150, 150, 10, 0);
    const [inside] = evaluateRegions(
      detectRegions(ARENA, [loop]).filter((r) => r.area < 20_000),
      [orb],
      maxArea,
    );
    expect(inside?.verdict).toBe('captured');
    expect(inside?.orbs).toEqual([orb]);
  });

  it('rejects a region larger than the maximum area', () => {
    const big = square(100, 100, 400); // 160,000 > 93,750
    const orb = makeOrb(300, 300, 10, 0);
    const regions = detectRegions(ARENA, [big]).filter((r) => r.area === 160_000);
    expect(evaluateRegions(regions, [orb], maxArea)[0]?.verdict).toBe('tooLarge');
  });

  it('accepts a region exactly at the maximum area', () => {
    const regions = detectRegions(ARENA, [square(100, 100, 100)]).filter((r) => r.area === 10_000);
    expect(evaluateRegions(regions, [makeOrb(150, 150, 0, 0)], 10_000)[0]?.verdict).toBe('captured');
  });

  it('treats a region with no active orbs as empty', () => {
    const regions = detectRegions(ARENA, [square(100, 100, 100)]).filter((r) => r.area === 10_000);
    expect(evaluateRegions(regions, [makeOrb(600, 400, 0, 0)], maxArea)[0]?.verdict).toBe('empty');
  });

  it('ignores captured orbs when deciding whether a region is empty', () => {
    const regions = detectRegions(ARENA, [square(100, 100, 100)]).filter((r) => r.area === 10_000);
    const captured = makeOrb(150, 150, 0, 0, 10, { capture: 'captured', movement: 'stopped' });
    const [evaluation] = evaluateRegions(regions, [captured], maxArea);
    expect(evaluation?.verdict).toBe('empty');
    expect(evaluation?.orbs).toEqual([]);
  });

  it('checks emptiness before size: a large empty region is empty, not too large', () => {
    const regions = detectRegions(ARENA, [square(100, 100, 400)]).filter((r) => r.area === 160_000);
    expect(evaluateRegions(regions, [], maxArea)[0]?.verdict).toBe('empty');
  });
});

describe('applyCaptures', () => {
  it('captures every orb in an eligible region at once and stops them', () => {
    const regions = detectRegions(ARENA, [square(100, 100, 100)]).filter((r) => r.area === 10_000);
    const a = makeOrb(130, 130, 40, 10);
    const b = makeOrb(170, 170, -20, 30);
    const outside = makeOrb(600, 400, 10, 10);
    const report = applyCaptures(evaluateRegions(regions, [a, b, outside], maxArea));

    expect(report.capturedOrbIds).toEqual([a.id, b.id]);
    expect(report.capturedRegions).toHaveLength(1);
    for (const orb of [a, b]) {
      expect(orb.capture).toBe('captured');
      expect(orb.movement).toBe('stopped');
      expect(orb.velocity).toEqual({ x: 0, y: 0 });
      expect(isPhysicallyActive(orb)).toBe(false);
    }
    expect(outside.capture).toBe('active');
    expect(isPhysicallyActive(outside)).toBe(true);
  });

  it('changes nothing for too-large or empty regions', () => {
    const big = detectRegions(ARENA, [square(100, 100, 400)]).filter((r) => r.area === 160_000);
    const orb = makeOrb(300, 300, 10, 0);
    const report = applyCaptures(evaluateRegions(big, [orb], maxArea));
    expect(report.capturedOrbIds).toEqual([]);
    expect(report.capturedRegions).toEqual([]);
    expect(report.evaluations[0]?.verdict).toBe('tooLarge');
    expect(orb.capture).toBe('active');
    expect(orb.velocity).toEqual({ x: 10, y: 0 });
  });
});

describe('resolveCaptures', () => {
  it('captures an orb enclosed by a closed square (acceptance: closed square)', () => {
    const loop = square(100, 100, 100);
    const orb = makeOrb(150, 150, 10, 0);
    const report = resolveCaptures(ARENA, [loop], loop.id, [orb], config);
    expect(report.capturedOrbIds).toEqual([orb.id]);
    // The surrounding region (the rest of the arena) was reshaped too; it has no active orbs.
    expect(report.evaluations.map((e) => e.verdict).sort()).toEqual(['captured', 'empty']);
  });

  it('captures an orb enclosed by a free-form polygon (acceptance: closed polygon)', () => {
    const polygon = wall([300, 100], [420, 160], [380, 300], [260, 260], [300, 100]);
    const orb = makeOrb(340, 200, 0, 0);
    expect(resolveCaptures(ARENA, [polygon], polygon.id, [orb], config).capturedOrbIds).toEqual([
      orb.id,
    ]);
  });

  it('rejects a capture when the region exceeds the maximum area (acceptance)', () => {
    const divider = wall([500, 0], [500, 625]); // halves: 312,500 each
    const orb = makeOrb(250, 300, 10, 0);
    const report = resolveCaptures(ARENA, [divider], divider.id, [orb], config);
    expect(report.capturedOrbIds).toEqual([]);
    expect(report.evaluations.map((e) => e.verdict).sort()).toEqual(['empty', 'tooLarge']);
    expect(orb.capture).toBe('active');
  });

  it('does not capture anything in a region without active orbs (acceptance)', () => {
    const loop = square(100, 100, 100);
    const orb = makeOrb(700, 400, 10, 0);
    const report = resolveCaptures(ARENA, [loop], loop.id, [orb], config);
    expect(report.capturedOrbIds).toEqual([]);
    expect(report.capturedRegions).toEqual([]);
  });

  it('evaluates each region of one drawing independently (D5)', () => {
    // A wall cutting a small corner pocket off a strip: the pocket is small, the rest is large.
    const strip = wall([0, 200], [1000, 200]); // top strip: 200,000 (too large)
    const pocket = wall([0, 100], [100, 100], [100, 200]); // 100×100 pocket inside the strip
    const inPocket = makeOrb(50, 150, 10, 0);
    const inStrip = makeOrb(500, 100, 10, 0);
    const report = resolveCaptures(ARENA, [strip, pocket], pocket.id, [inPocket, inStrip], config);

    expect(report.capturedOrbIds).toEqual([inPocket.id]);
    const verdicts = report.evaluations.map((e) => e.verdict).sort();
    expect(verdicts).toEqual(['captured', 'tooLarge']);
    expect(inStrip.capture).toBe('active');
  });

  it('only evaluates regions the new wall created or reshaped', () => {
    const left = square(100, 100, 100);
    const right = square(600, 300, 100);
    const orbInLeft = makeOrb(150, 150, 0, 0);
    // `left` existed before; its orb is not captured by drawing `right`.
    const report = resolveCaptures(ARENA, [left, right], right.id, [orbInLeft], config);
    expect(report.capturedOrbIds).toEqual([]);
    expect(orbInLeft.capture).toBe('active');
  });

  it('captures several orbs in one region together', () => {
    const loop = square(100, 100, 200);
    const orbs = [makeOrb(150, 150, 0, 0), makeOrb(250, 250, 0, 0), makeOrb(150, 250, 0, 0)];
    const report = resolveCaptures(ARENA, [loop], loop.id, orbs, config);
    expect(report.capturedOrbIds).toEqual(orbs.map((orb) => orb.id));
    expect(report.capturedRegions).toHaveLength(1);
  });
});
