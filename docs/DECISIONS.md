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
- **Capture rules** (`src/capture/captureSystem.ts`):
  - After each committed wall, only the regions that wall created or reshaped
    are evaluated, each on its own (D5).
  - A region with no active orbs is `empty`, checked before size. One larger
    than `maxCaptureAreaRatio` × total arena area is `tooLarge`. Otherwise it
    is `captured`; a region exactly at the limit still counts.
  - Captured orbs become `captured` and `stopped` with zero velocity, all at
    once, and physics ignores them.
  - Captured regions are reported as they were at capture time, for drawing
    them as solid space. They need no extra physics, because their boundary is
    walls that active orbs already collide with (D4).
  - The capture system never counts failures. A `tooLarge` capture is not a
    failed attempt (REQUIREMENTS D3).
- **Game logic** (`src/game/progress.ts`, `src/world/gameWorld.ts`):
  - `GameWorld` is the whole game without rendering. It takes frame time and
    pointer input, and returns events (`wallCreated` with its capture report,
    `attemptFailed`, `gameOver`) for rendering and feedback.
  - Failed attempts follow D3 literally: too-short strokes (including a tap
    inside the arena), drawings that touch an orb, and browser input cancels
    all count. A press outside the arena starts nothing and costs nothing.
  - Physics, the drawing-contact check and the clock run in the same fixed
    steps. When the game is over, everything freezes and input is ignored
    until restart.
  - Restart creates a fresh set of orbs with the configured count. By default
    the positions are random, so each game has a new layout; tests pass a
    seeded spawner to check exact restoration.
  - Score: 100 points per captured orb (REQUIREMENTS D9), defined in
    `POINTS_PER_CAPTURED_ORB`.
- **Rendering and UI** (`src/render/`, `src/ui/`, `src/scenes/GameScene.ts`):
  - One Phaser Graphics object, positioned and scaled by the arena
    transform, redraws everything in arena coordinates each frame: arena,
    captured regions (filled solid, D4), walls, orbs (greyed when captured),
    the drawing preview and the failure flash. Phaser Text objects form the
    HUD and the victory/defeat overlay.
  - Failed drawings flash red for 0.6 s along the path the player drew
    (REQUIREMENTS §3.7).
  - The HUD shows "Misses: n / max" (failed attempts against the limit) in
    addition to the §5.2 fields, so the player can see how close defeat is.
  - Line widths and HUD fonts are set in CSS pixels, so they look the same at
    any arena scale or pixel density.
  - The scene holds no rules. It forwards pointer input (left button or
    touch; `pointerup`, `pointerupoutside`, and touch cancels reported as
    `wasCanceled`) and frame time to `GameWorld`, then draws its state.
- **Responsive layout** (`src/layout/screenLayout.ts`, `viewport.ts`, `src/main.ts`):
  - The canvas always fills the page (`#game` is fixed to the viewport, using
    `100dvh` for mobile toolbars). Phaser runs in scale mode `NONE`: the canvas
    is CSS size × pixel ratio, displayed at zoom 1 / pixel ratio, so it renders
    at device resolution. Phaser 4 has no resolution setting.
  - The pixel ratio is capped at 2 to bound GPU fill-rate, as the
    scale-and-responsive skill advises. 3× phones render at 2× and are
    upscaled.
  - `computeLayout` is a pure function. It tries the HUD on top (fields wrap
    into rows on narrow screens) and in a 176-px side column, and keeps
    whichever leaves the larger arena: top on desktop and portrait, side on
    landscape phones. The arena keeps its 16:10 ratio (D6), is centered in the
    remaining space, and never overlaps the HUD. In portrait the arena is
    necessarily small.
  - Resize, orientation change and mobile toolbar changes are watched
    (ResizeObserver, `resize`, `orientationchange`, `visualViewport`) and
    coalesced per animation frame. Each change recomputes the layout and calls
    `game.scale.resize`; the scene repositions the renderer, HUD and overlay
    and resizes the camera. Game state is in arena coordinates, so nothing in
    the game moves.
  - Pointer positions arrive in canvas pixels (Phaser maps them through the
    canvas bounds) and are converted to arena coordinates with the current
    layout.
  - Browser gestures are blocked on the game element: `touch-action: none`,
    no text selection or callout, and `overscroll-behavior: none` on the page
    (REQUIREMENTS §7.3).
- **Development aids** (development builds only; absent from `npm run build`):
  - URL overrides for manual balancing and browser tests: `?orbs=`,
    `radius=`, `speed=`, `maxArea=`, `minLength=`, `maxMisses=`, and `seed=`
    for a reproducible layout.
  - `window.__orbitalLock`, a test hook exposing the world, scene and
    coordinate conversions to Playwright.
- **Browser tests:** Playwright 1.65.0 with Chromium only (`npm run test:e2e`,
  tests in `e2e/`). It starts its own Vite dev server on port 5199.
  - Mobile tests emulate a Pixel 7. Touch drags are sent as real touch events
    through the Chrome DevTools Protocol.
  - Two workers and a 60 s timeout. With more workers, software-rendered WebGL
    starves the CPU and tests time out.
- **Logical coordinates:** game state uses the fixed `ARENA` coordinate space in
  `src/config/gameConfig.ts` (1000 × 625 units), implementing D6.
