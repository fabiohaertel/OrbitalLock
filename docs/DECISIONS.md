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
    Whether it counts as a failed attempt is decided in Phase 7. The player
    cannot cancel a drawing manually (REQUIREMENTS D8).
  - Not yet wired to Phaser. When it is, the scene must also end the drawing on
    `pointerupoutside`, so a release outside the canvas isn't missed.
- **Wall validation** (`src/drawing/wallBuilder.ts`, `pathAnalysis.ts`):
  - An orb "touches" a path when its center is within its radius of any part
    of the path, exact contact included. Only active orbs count.
  - While drawing (D2), the whole in-progress path is checked against the orbs
    after every pointer move and after every physics step. A touch cancels the
    drawing at once, including a press that starts on an orb.
  - On release, a path whose end is within 15 units of its start, with at
    least 4 points, becomes a closed loop (the end is moved onto the start).
    Otherwise each endpoint within 15 units of an existing wall or arena edge
    is snapped onto the nearest one.
  - The final path is checked again after snapping, against the minimum
    length and against orbs: snapping can move an end through an orb.
  - Open walls whose ends touch nothing are valid. They block orbs but enclose
    nothing.
  - Self-crossings are recorded on the wall for region detection (Phase 5).
  - The builder only reports outcomes. The caller adds a created wall to its
    list, so a rejected or canceled drawing leaves the arena unchanged.
- **Region detection** (`src/geometry/planarGraph.ts`, `regions.ts`):
  - Rebuilt from scratch after each committed wall. All wall segments and
    the four arena edges are split at every crossing or touch, and points
    within 1e-6 units are merged into one vertex. Loose chains are pruned, and
    the faces of the resulting planar graph become the regions.
  - Every point of the arena not on a wall belongs to exactly one region, so
    region areas always add up to the arena area.
  - A closed group of walls floating inside a region (an island) is a hole in
    that region. Its area is subtracted, and its inside forms separate
    regions.
  - An orb belongs to a region when its center is strictly inside the
    region's outline and outside its holes.
  - `regionsBoundedByWall(regions, wallId)` returns the regions a new wall
    created or reshaped. Phase 6 applies the capture rules to these.
  - Performance: pairs of segments are compared after a bounding-box check.
    About 1,000 segments take roughly 10 ms, run once per committed wall.
- **Logical coordinates:** game state uses the fixed `ARENA` coordinate space in
  `src/config/gameConfig.ts` (1000 × 625 units), implementing D6.
