# Orbital Lock — Technical Decisions

Gameplay design decisions (D1–D7) are part of the requirements: see
[REQUIREMENTS.md §11](REQUIREMENTS.md#11-design-decisions).

This document records project-level technical decisions only.

- **Toolchain:** Vite, TypeScript (strict), Phaser 4, Vitest, ESLint with
  `typescript-eslint` (strict, type-checked).
- **TypeScript 6.0:** pinned because `typescript-eslint` does not yet support
  TypeScript 7.
- **Vitest launcher:** `npm test` runs Vitest through `scripts/vitest.mjs`. On
  Windows, starting from a directory with a lowercase drive letter (`c:\...`)
  makes Vitest load its runner twice, and every test file fails with
  "Cannot read properties of undefined (reading 'config')". The launcher
  normalizes the drive letter first.
- **Game logic without Phaser:** physics, geometry, capture and game rules do
  not import Phaser and are tested with Vitest under Node. Phaser scenes only
  render state and forward input.
- **Physics model** (REQUIREMENTS §3.2 "according to the physics model";
  `src/physics/simulation.ts`): custom code rather than Phaser Arcade Physics,
  which only supports rectangle and circle bodies, not free-form wall segments.
  - Constant-speed arcade model. Orbs move in straight lines. Arena edges and
    walls reflect them (angle in = angle out), and wall ends act as rounded
    corners.
  - Orb–orb collisions are elastic along the contact normal, with mass ∝ radius².
    Afterwards each orb keeps its own speed, so collisions change direction but
    never speed up or slow down an orb.
  - Captured or stopped orbs are ignored.
  - Simulation runs at a fixed 120 steps per second. Frames longer than 0.25 s
    are cut to 0.25 s.
  - Each step is split into sub-steps so no orb moves more than half its radius
    per sub-step. That prevents orbs passing through walls at any speed.
- **Drawing input** (`src/drawing/drawingSession.ts`):
  - A drawing starts only from primary input (left mouse button or a touch)
    pressed inside the arena. A press outside the arena (e.g. on the HUD) does
    not start one. After that, points outside the arena are clamped onto its
    border.
  - Only the pointer that started the drawing is followed; other pointers,
    such as a second finger, are ignored.
  - Samples closer than 2 units to the previous one are dropped to filter
    jitter. On release, the path is simplified with a 1-unit tolerance, then
    checked against `minDrawingLength`. A tap with no movement is always too
    short.
  - `cancel()` exists for browser-initiated cancels (e.g. `pointercancel`).
    Whether it counts as a failed attempt is decided in Phase 7. Manual
    cancellation by the player is still an open decision (REQUIREMENTS §11.2).
  - Not yet wired to Phaser. When it is, the scene must also end the drawing on
    `pointerupoutside`, so a release outside the canvas isn't missed.
- **Logical coordinates:** game state uses the fixed `ARENA` coordinate space in
  `src/config/gameConfig.ts` (1000 × 625 units), implementing D6.
