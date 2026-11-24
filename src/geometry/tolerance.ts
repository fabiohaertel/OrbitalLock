/**
 * Default distance tolerance, in arena units, used by geometric predicates
 * (touching, collinearity, on-boundary). The arena is ~1000 units wide, so this
 * is far below anything visible while still absorbing floating-point error.
 */
export const DEFAULT_EPSILON = 1e-6;
