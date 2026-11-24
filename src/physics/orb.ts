import type { Vec2 } from '../geometry/vector';

/** Whether the orb is currently moving (REQUIREMENTS §3.2 "movement state"). */
export type OrbMovementState = 'moving' | 'stopped';

/** Whether the orb is still in play or has been captured (REQUIREMENTS §3.2 "capture state"). */
export type OrbCaptureState = 'active' | 'captured';

/**
 * A moving orb. Mutable: the physics step updates position and velocity in
 * place every fixed step. Units are arena units and arena units per second.
 */
export interface Orb {
  readonly id: number;
  position: Vec2;
  velocity: Vec2;
  readonly radius: number;
  movement: OrbMovementState;
  capture: OrbCaptureState;
}

/**
 * True when the orb takes part in movement and collisions. Captured or stopped
 * orbs are ignored by the physics step (REQUIREMENTS §3.2, §3.6).
 */
export function isPhysicallyActive(orb: Orb): boolean {
  return orb.capture === 'active' && orb.movement === 'moving';
}
