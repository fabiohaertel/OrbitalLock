# Orbital Lock — Implementation Roadmap

This roadmap breaks the MVP defined in [REQUIREMENTS.md](REQUIREMENTS.md) into
phases. The requirements remain the source of truth; if this roadmap conflicts
with them, follow the requirements. Design decisions D1–D7 are in
[REQUIREMENTS.md §11.1](REQUIREMENTS.md#111-resolved-decisions).

## How to use this roadmap

- Implement one phase at a time, in dependency order.
- Implement only the scope listed for that phase; do not pull in later phases.
- A phase is done when its tests pass, typecheck and lint are clean, and its
  "Done when" criteria are met.
- After finishing a phase, update its row in the status table below (status,
  date, and any notes or limitations worth carrying forward).

## Status

| # | Phase | Status | Notes |
| --- | --- | --- | --- |
| 0 | Decisions and scaffolding | ✅ Done (2026-11-24) | Vitest runs via `scripts/vitest.mjs` (see [DECISIONS.md](DECISIONS.md)) |
| 1 | Geometry primitives | ✅ Done (2026-11-24) | `src/geometry/`; default distance tolerance `DEFAULT_EPSILON` = 1e-6; RDP simplification is O(n²) worst case (fine for freehand path sizes) |
| 2 | Physics | ✅ Done (2026-11-24) | `src/physics/`; constant-speed model (see [DECISIONS.md](DECISIONS.md)); walls passed as `Segment[]`; logic only, no rendering yet; orb–orb pairs checked O(n²) |
| 3 | Drawing input and path processing | ✅ Done (2026-11-24) | `src/drawing/`, `src/layout/arenaTransform.ts`; pure logic, not yet wired to Phaser input (must handle `pointerupoutside` when wired); drawings start only inside the arena |
| 4 | Drawing validation and wall creation | ✅ Done (2026-11-24) | `WallBuilder` in `src/drawing/`; no manual cancel (D8); snap distance 15; caller must call `checkOrbContact` after each physics step and append created walls; not yet wired to Phaser |
| 5 | Region detection | ✅ Done (2026-11-24) | `detectRegions` in `src/geometry/regions.ts`; full rebuild per committed wall (~10 ms for 1,000 segments); islands become holes; `regionsBoundedByWall` gives the regions a new wall created |
| 6 | Capture system | ✅ Done (2026-11-24) | `resolveCaptures` in `src/capture/`; call after appending each new wall; reports verdicts per region (`captured` / `tooLarge` / `empty`) and captured regions for rendering |
| 7 | Game logic | ✅ Done (2026-11-24) | `GameWorld` in `src/world/` combines all systems; §9 headless scenarios in `tests/world/gameWorld.acceptance.test.ts`; too-large regions aren't failures (D3); 100 points per orb (D9); still no rendering or Phaser wiring |
| 8 | Rendering, HUD and screens | ✅ Done (2026-11-24) | Playable on desktop; fixed HUD-above-arena layout (responsive layout is Phase 9); Playwright e2e in `e2e/`; dev-only URL overrides and test hook |
| 9 | Responsive layout and devices | ✅ Done (2026-11-24) | `computeLayout` picks HUD top/side; canvas at device resolution (ratio capped at 2); touch gestures blocked; e2e covers resize, rotation, touch drawing and mobile viewports (Chromium emulation only, not real devices) |
| 10 | Acceptance and hardening | ⬜ Not started | |

## Architecture

Game rules are plain TypeScript with no Phaser imports, so they run and are
tested under Node. Phaser only renders state and forwards input (REQUIREMENTS
§7.4, §8).

```text
src/
  config/      gameplay config + defaults (§4)
  geometry/    vectors, segments, polylines, polygons, region detection (§8.2)
  physics/     orb movement, fixed-step loop, collisions (§8.1)
  drawing/     input path processing, validation, wall creation (§3.3, §3.4, §3.7)
  capture/     capture rules (§8.3)
  game/        state machine, failed attempts, score, timer, victory/defeat (§8.4)
  world/       GameWorld: combines the systems; driven by integration tests
  render/      Phaser drawing of arena, orbs, walls, preview (§5.4, §8.5)
  audio/       collision sound, miss whistle, goal sound: synthesis and playback (§5.5, §8.6)
  ui/          HUD, victory/defeat screens, restart
  layout/      viewport fitting, logical↔screen coordinate mapping
  scenes/      Phaser scenes: thin glue only
tests/         mirrors src/
```

All game state uses the fixed logical coordinate space `ARENA` (1000 × 625
units, `src/config/gameConfig.ts`), per D6.

## Dependencies

```text
0 ─► 1 ─┬─► 2 ─────────┐
        └─► 3 ─► 4 ◄───┘
                 │
                 ▼
                 5 ─► 6 ─► 7 ─► 10
   8 (in parallel from 2) ─► 9 ─► 10
```

Phases 2 and 3 can run in parallel. Rendering (8) grows alongside the other
phases so each mechanic can be checked visually as soon as it exists.

## Phases

### Phase 0 — Decisions and scaffolding ✅

- **Scope:** resolve open design decisions; Vite, TypeScript strict, Vitest,
  ESLint; minimal Phaser 4 boot scene; typed, validated gameplay config with
  defaults (max capture area 15%).
- **Depends on:** —
- **Tests:** config defaults; overrides for every §4 value; invalid values
  rejected; build and typecheck pass.

### Phase 1 — Geometry primitives ✅

- **Scope:** vectors; segment intersection (including collinear and touching
  cases); point-to-segment distance; polyline length; path simplification;
  clamping to the arena rectangle; polygon area (shoelace); point-in-polygon.
- **Depends on:** 0
- **Unit tests:** segment intersection — crossing, parallel, collinear overlap,
  endpoint touch, T-junction. Point-to-segment distance. Shoelace area for
  squares, triangles and concave shapes, either winding. Point-in-polygon for
  inside, outside, on edge, on corner, concave shapes. Clamping. Polyline
  length. Simplification keeps corners and stays within tolerance.
- **Done when:** all primitives are pure, deterministic and covered by edge-case
  tests.

### Phase 2 — Physics ✅

- **Scope:** orb model (position, velocity, radius, movement state, capture
  state); fixed-timestep loop with accumulator and a cap on large frame gaps;
  arena boundary bounces; orb–orb collisions; orb vs. wall-polyline collisions
  (segments and corners); captured orbs excluded.
- **Depends on:** 1
- **Unit tests:** boundary bounce on each edge and in corners; head-on and
  angled orb–orb collisions (momentum and chosen speed rule); collisions with a
  wall segment and a wall corner; no pass-through at maximum speed; captured
  orbs neither move nor collide; same total time gives the same result whether
  run as one large step or many small ones.
- **Integration tests:** many orbs simulated over N seconds stay inside the
  arena with no overlap beyond tolerance.
- **Done when:** §3.1, §3.2 and §7.1 physics requirements are met.

### Phase 3 — Drawing input and path processing ✅

- **Scope:** convert pointer input into a path in logical coordinates; sample
  and simplify; clamp to the arena; enforce minimum length; primary pointer only;
  data for the live preview.
- **Depends on:** 0, 1 (pure part)
- **Unit tests:** screen-to-logical conversion at several scales; points outside
  the arena are clamped; minimum-length rejection; secondary pointers ignored.
- **Done when:** §3.3 is met, except enclosure detection (Phase 5).

### Phase 4 — Drawing validation and wall creation ✅

- **Scope:** reject paths crossing an active orb; cancel when an orb touches the
  in-progress path (D2); snap endpoints to walls and arena edges (D1); detect
  closure and self-crossings; validate before committing; leave arena state
  unchanged on rejection.
- **Depends on:** 2, 3
- **Decision:** no manual cancel of a partial drawing (REQUIREMENTS D8).
- **Unit tests:** path through an orb → rejected; orb moving into the
  in-progress path → canceled; endpoint snapping to walls and edges; closed-loop
  detection; state unchanged after rejection.
- **Integration tests:** scripted drawing while orbs move; cancellation happens
  and world state is restored.
- **Done when:** §3.4 and §3.7 are met.

### Phase 5 — Region detection ✅

- **Scope:** build a graph of all wall segments and arena edges, split at
  intersections, extract enclosed regions (faces); compute each region's area,
  including regions with islands inside; assign orbs to regions.
- **Depends on:** 1, 4
- **Unit tests:** closed square or polygon gives one region with the correct
  area; wall-to-wall diagonal splits the arena correctly; loose wall end gives no
  false region; figure-eight gives two regions; island subtracted from area; orb
  assigned to the correct region.
- **Integration tests:** several walls added in sequence; regions stay
  consistent and their areas sum to the arena area.
- **Done when:** §3.5 is met.

### Phase 6 — Capture system ✅

- **Scope:** max-area rule per region (D5); empty-region rule; capture all orbs
  in a region at once; update orb states; remove captured orbs from physics;
  captured regions become solid (D4); report capture results.
- **Depends on:** 2, 5
- **Unit tests:** region ≤ 15% with orbs → captured; region > 15% → rejected;
  empty region → no capture; several orbs in one region captured together;
  results reported.
- **Integration tests:** capture an orb, keep simulating; it stays frozen and
  other orbs bounce off the captured area.
- **Done when:** §3.6 is met.

### Phase 7 — Game logic ✅

- **Scope:** state machine (playing, victory, defeat); failed-attempt counter
  (D3); basic score tracking (§6); elapsed timer; victory and defeat conditions;
  restart to the initial state. Single level only (D7).
- **Depends on:** 6
- **Unit tests:** victory when all orbs are captured; defeat when failed attempts
  exceed `maxFailedAttempts`; restart restores the initial state exactly; score
  updates; timer runs while playing and stops on victory or defeat.
- **Integration tests:** §9 acceptance scenarios run without a browser — square
  capture, polygon capture, diagonal wall, oversize region, empty region,
  drawing through an orb, orb hitting the path while drawing, victory, defeat,
  drawing outside the arena, restart.
- **Done when:** §3.8, §6 and §8.4 are met.

### Phase 8 — Rendering, HUD and screens ✅

- **Scope:** draw arena, orbs, walls, drawing preview; visual feedback for
  invalid or canceled drawings; HUD (captured, remaining, time, score, restart);
  victory and defeat screens.
- **Depends on:** 2 onward (built up incrementally)
- **Unit tests:** HUD values derived from game state (pure functions).
- **E2E tests (Playwright):** HUD shows counters; victory and defeat screens
  appear; restart button works.
- **Done when:** §5.2, §5.3 and §8.5 are met.

### Phase 9 — Responsive layout and devices ✅

- **Scope:** fit the arena to the viewport (D6); handle resize and orientation
  changes; account for pixel density; map pointer coordinates; disable browser
  touch gestures while drawing; mobile HUD layout.
- **Depends on:** 0, 3, 8
- **Unit tests:** logical↔screen mapping correct both ways across sizes, aspect
  ratios and pixel densities; positions unchanged after resize.
- **E2E tests (Playwright):** window resize; portrait and landscape on a mobile
  viewport; touch drawing with touch emulation; no horizontal scroll
  (`scrollWidth ≤ innerWidth`); HUD remains usable.
- **Done when:** §5.1, §7.2 and §7.3 are met.

### Phase 10 — Acceptance and hardening

- **Scope:** run the full §9 acceptance table; stress test with many orbs and
  walls; profile geometry on mobile; fix edge cases found.
- **Depends on:** all
- **Tests:** regression tests for every edge case found; performance check of a
  frame with many orbs and walls.
- **Done when:** every row of §9 passes.

## Main technical challenges

1. **Floating-point accuracy in geometry.** Nearly parallel or overlapping
   segments, intersections at endpoints and endpoints that almost touch a wall
   need consistent tolerances and snapping, or regions get gaps or zero-area
   slivers.
2. **Turning free-form paths into regions.** Paths can cross themselves, cross
   existing walls several times or leave loose ends. Splitting everything into a
   graph and extracting faces handles these uniformly. Hard cases: loose ends
   (no false regions), islands (subtract area, handle in inside test), one
   drawing creating several regions.
3. **Segment count.** Raw pointer samples produce hundreds of points; simplify
   within a tolerance smaller than the orb radius to keep region detection and
   collisions fast on mobile.
4. **Orb–wall collisions.** Concave corners need corner handling as well as
   segments. Cap the step size (speed × step < radius) or use swept tests to
   prevent pass-through; resolve overlaps so orbs don't get stuck.
5. **Frame-rate independence.** Fixed timestep with a cap on catch-up after the
   tab was in the background; likely normalize speed after collisions for an
   arcade feel.
6. **Checking orbs against the path while drawing.** New pointer segments vs.
   all orbs, and every physics step vs. the path so far, in sync with the fixed
   timestep.
7. **Responsive coordinates.** Resize, orientation and pixel density must map
   consistently; handle pointers that start or move outside the canvas.
8. **Touch.** Prevent scroll, zoom and pull-to-refresh while drawing; ignore a
   second finger; handle canceled touches.
9. **Phaser 4 API accuracy.** Use the official skills shipped in
   `node_modules/phaser/skills/` (for example `input-keyboard-mouse-touch`,
   `graphics-and-shapes`, `scale-and-responsive`, `text-and-bitmaptext`) and the
   Phaser 4 docs; do not rely on Phaser 3 examples.
