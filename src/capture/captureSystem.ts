import type { ArenaDimensions, GameplayConfig } from '../config/gameConfig';
import {
  detectRegions,
  itemsInRegion,
  regionsBoundedByWall,
  type Region,
  type RegionWall,
} from '../geometry/regions';
import type { Orb } from '../physics/orb';

/** How one region was judged after a new wall (REQUIREMENTS §3.5, §3.6). */
export type RegionVerdict =
  /** Contains active orbs and is within the maximum area: its orbs are captured. */
  | 'captured'
  /** Contains active orbs but exceeds the maximum capture area: no capture. */
  | 'tooLarge'
  /** Contains no active orbs: never counts as a capture. */
  | 'empty';

export interface RegionEvaluation {
  readonly region: Region;
  /** Active orbs inside the region at the moment of evaluation. */
  readonly orbs: readonly Orb[];
  readonly verdict: RegionVerdict;
}

/** Result of applying the capture rules after one new wall (REQUIREMENTS §8.3 "reporting capture results"). */
export interface CaptureReport {
  /** Every region the new wall created or reshaped, with its verdict. */
  readonly evaluations: readonly RegionEvaluation[];
  /** Ids of orbs captured by this wall, in evaluation order. */
  readonly capturedOrbIds: readonly number[];
  /** Regions that became solid captured space (D4), as they were at capture time. */
  readonly capturedRegions: readonly Region[];
}

/** Largest region area eligible for capture, in square arena units. */
export function maxCaptureArea(
  arena: ArenaDimensions,
  config: Pick<GameplayConfig, 'maxCaptureAreaRatio'>,
): number {
  return arena.width * arena.height * config.maxCaptureAreaRatio;
}

/**
 * Judges each region on its own (D5). Only active orbs count: a region holding
 * only captured orbs, or none, is empty. A region whose area equals the
 * maximum is still eligible ("does not exceed", REQUIREMENTS §3.6).
 */
export function evaluateRegions(
  regions: readonly Region[],
  orbs: readonly Orb[],
  maxArea: number,
): RegionEvaluation[] {
  const active = orbs.filter((orb) => orb.capture === 'active');
  return regions.map((region) => {
    const inside = itemsInRegion(region, active);
    const verdict: RegionVerdict =
      inside.length === 0 ? 'empty' : region.area > maxArea ? 'tooLarge' : 'captured';
    return { region, orbs: inside, verdict };
  });
}

/**
 * Captures the orbs of every `'captured'` evaluation, all at once (REQUIREMENTS
 * §3.6): they become `captured` and `stopped` with zero velocity, so the physics
 * step ignores them from now on.
 */
export function applyCaptures(evaluations: readonly RegionEvaluation[]): CaptureReport {
  const capturedOrbIds: number[] = [];
  const capturedRegions: Region[] = [];

  for (const evaluation of evaluations) {
    if (evaluation.verdict !== 'captured') continue;
    capturedRegions.push(evaluation.region);
    for (const orb of evaluation.orbs) {
      orb.capture = 'captured';
      orb.movement = 'stopped';
      orb.velocity = { x: 0, y: 0 };
      capturedOrbIds.push(orb.id);
    }
  }

  return { evaluations, capturedOrbIds, capturedRegions };
}

/**
 * Runs the capture rules after `newWallId` has been added to `walls`: detects
 * the regions, evaluates those the new wall created or reshaped, and captures
 * the eligible orbs.
 *
 * Captured regions need no extra physics: their boundary is made of walls, so
 * active orbs outside already collide with it (D4).
 */
export function resolveCaptures(
  arena: ArenaDimensions,
  walls: readonly RegionWall[],
  newWallId: number,
  orbs: readonly Orb[],
  config: Pick<GameplayConfig, 'maxCaptureAreaRatio'>,
): CaptureReport {
  const affected = regionsBoundedByWall(detectRegions(arena, walls), newWallId);
  return applyCaptures(evaluateRegions(affected, orbs, maxCaptureArea(arena, config)));
}
