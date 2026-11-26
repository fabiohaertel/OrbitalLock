# Goal Lock — Implementation Roadmap

This roadmap breaks the MVP defined in [REQUIREMENTS.md](REQUIREMENTS.md) into
phases (0–10), followed by level progression (11–16). The requirements remain the source of truth; if this roadmap conflicts
with them, follow the requirements. Design decisions D1–D11 are in
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
| 10 | Acceptance and hardening | ✅ Done (2026-11-25) | Every §9 row covered (headless + Playwright); seeded stress test and frame-budget check; fixes: right-click release no longer ends a drawing, orb–wall bounding-box early-out (~8× faster physics with many walls); mobile profiled with CPU throttling in emulation only, not on real devices |
| 11 | Level progression decisions | ✅ Done (2026-11-25) | D10 (levels) and D11 (scoring) in REQUIREMENTS, replacing D7 and D9; time bonus counts whole seconds under 60 s |
| 12 | Level definitions | ✅ Done (2026-11-25) | `src/game/levels.ts`; invalid levels throw `RangeError`; not yet used by `GameWorld` (Phase 14), and URL dev overrides of the four level values will be overwritten by the level once it is (decide in Phase 15) |
| 13 | Per-level scoring | ✅ Done (2026-11-25) | `src/game/scoring.ts`; `POINTS_PER_CAPTURED_ORB` removed, `recordCaptures` scores as level 1 until Phase 14; level-clear bonus not applied yet (Phase 14) |
| 14 | Level progression in game logic | ✅ Done (2026-11-25) | `GameWorld.nextLevel()`, per-level `config`, `levelComplete` event; `GameProgress` has level and game totals; headless tests play levels 1 → 3 |
| 15 | Level UI | ✅ Done (2026-11-25) | LEVEL card (6 HUD cards; side cards 30 px); level-cleared and defeat panels; `?level=N`; URL config overrides win on every level; e2e covers next level, defeat on level 2 and the level table |
| 16 | Level balancing and hardening | ✅ Done (2026-11-25) | Stress test at the hardest level (16 orbs, 300 units/s, 8%) and the 60-orb frame budget pass; the initial D10 table and D11 bonuses were approved as final without changes |

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
  audio/       collision sound, foul whistle, goal sound: synthesis and playback (§5.5, §8.6)
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

Level progression (after the MVP):

```text
11 ─┬─► 12 ─┐
    └─► 13 ─┴─► 14 ─► 15 ─► 16
```

Phases 12 and 13 can run in parallel.

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

### Phase 10 — Acceptance and hardening ✅

- **Scope:** run the full §9 acceptance table; stress test with many orbs and
  walls; profile geometry on mobile; fix edge cases found.
- **Depends on:** all
- **Tests:** regression tests for every edge case found; performance check of a
  frame with many orbs and walls.
- **Done when:** every row of §9 passes.

## Level progression (Phases 11–16)

Clearing a level leads to the next, harder one, until the player loses. These
phases replace the single-level MVP (D7) and the placeholder scoring (D9).

### Agreed rules (REQUIREMENTS D10)

- **Endless:** levels continue until defeat. After the last table level,
  difficulty grows by formula up to its caps, then stays there.
- **Level cleared:** the simulation stops and a "LEVEL N CLEAR" panel shows the
  bonuses and a "NEXT LEVEL" button. No automatic advance.
- **New level:** the arena is cleared (no walls or nets); new orbs are spawned
  from the level's config.
- **Fouls reset every level.** The limit may change per level. Defeat is still
  exceeding the limit (D3), now within the current level.
- **Score accumulates** across levels. The HUD shows the level's time; the
  defeat screen shows the total time.
- **Defeat** shows the level reached, total score and total time. "PLAY AGAIN"
  goes back to level 1 with the score reset.
- **HUD restart** restarts the whole game (level 1). There is no
  "restart this level".

### Difficulty curve (REQUIREMENTS D10; final values, approved in Phase 16)

Uses the existing `GameplayConfig` levers only. `orbRadius` stays at 12.

| Level | Orbs | Speed | Max area | Fouls |
| --- | --- | --- | --- | --- |
| 1 | 3 | 220 | 15% | 4 |
| 2 | 4 | 230 | 15% | 4 |
| 3 | 5 | 240 | 14% | 3 |
| 4 | 6 | 250 | 13% | 3 |
| 5 | 7 | 250 | 12% | 3 |
| 6 | 8 | 260 | 11% | 3 |
| 7 | 9 | 270 | 10% | 3 |
| 8 | 10 | 280 | 10% | 2 |
| 9 | 11 | 290 | 9% | 2 |
| 10 | 12 | 300 | 8% | 2 |
| 11+ | +1 per level, cap 16 | 300 (cap) | 8% (floor) | 2 |

Speed is capped at 300 because playtesting found 320 too fast (§4). The orb cap
of 16 keeps spawning reliable and stays well inside the Phase 10 stress test
(60 orbs).

### Scoring (REQUIREMENTS D11, replaces D9)

- **Capture:** `100 × level` points per orb.
- **Level-clear bonus:** `500 × level` + `200 × unused fouls` +
  `10 × floor(max(0, 60 − level seconds))`.
- The "LEVEL CLEAR" panel lists each bonus and the total added to the score.

### Phase 11 — Level progression decisions ✅

- **Scope:** documentation only. In REQUIREMENTS: mark D7 as replaced by
  **D10 — Level progression** (rules above) and D9 by **D11 — Per-level
  scoring**; update §3.8 (level cleared instead of victory; level-clear and
  defeat screens), §4 (per-level values come from the level table; current
  values become the base config), §5.2/§5.3 (LEVEL card), §5.6 (level-clear
  panel), §8.4 (level progression), §9 (new acceptance rows, see Phase 15) and
  §10 (remove "Multiple levels with increasing difficulty").
- **Depends on:** 10
- **Done when:** REQUIREMENTS and this roadmap agree, and no open decision
  remains for Phases 12–16.

### Phase 12 — Level definitions ✅

- **Scope:** new `src/game/levels.ts` (pure): `LevelDefinition` (level, orb
  count, speed, max capture area, max fouls), `LEVEL_TABLE` for levels 1–10,
  `levelDefinition(level)` applying the formula and caps after the table, and
  `levelConfig(level, base)` returning a config validated by
  `createGameplayConfig`.
- **Depends on:** 11
- **Unit tests:** table values; formula after level 10; caps and floors hold at
  very high levels; invalid levels (0, negative, non-integer) rejected; every
  level's config is valid; `createOrbs` always places 16 orbs.
- **Done when:** any level number maps to a valid, deterministic config.

### Phase 13 — Per-level scoring ✅

- **Scope:** new `src/game/scoring.ts` (pure): `captureScore(count, level)` and
  `levelClearBonus({ level, foulsLeft, levelSeconds })` returning each part and
  the total. Replaces `POINTS_PER_CAPTURED_ORB`.
- **Depends on:** 11
- **Unit tests:** capture score scales with level; each bonus part; time bonus
  is zero after 60 s and never negative; no fouls left gives no foul bonus.
- **Done when:** D11 is implemented and covered.

### Phase 14 — Level progression in game logic ✅

- **Scope:** `src/game/progress.ts`: status becomes `playing | levelComplete |
  defeat`; progress gains `level`, `totalScore` and `totalSeconds`; clearing
  all orbs applies the level-clear bonus; `startLevel` resets the level's
  counters and keeps the totals. `src/world/gameWorld.ts`: `config` is the
  current level's config; `restart()` goes back to level 1; new `nextLevel()`
  (only when the level is complete) clears walls and regions, recreates the wall
  builder and timestep and spawns the new level's orbs; `levelComplete` and
  `gameOver` (defeat) events. Still no UI.
- **Depends on:** 12, 13
- **Unit tests:** capturing every orb → `levelComplete` with the bonus;
  `nextLevel` ignored while playing or after defeat; fouls reset per level;
  score and total time accumulate; defeat on level N keeps N; restart restores
  level 1 exactly.
- **Integration tests:** headless run through levels 1 → 3 with seeded orbs;
  arena empty and new config applied after each `nextLevel`.
- **Done when:** D10 rules hold without a browser.

### Phase 15 — Level UI ✅

- **Scope:** LEVEL card in the HUD in all three layouts (bar, rows, side
  column); level-clear panel ("LEVEL N CLEAR", bonus breakdown, "NEXT LEVEL"
  button) reusing `GameOverOverlay`, `StatCard` and `PillButton`; defeat panel
  with level reached, total score and total time; the scene's panel button calls
  `nextLevel()` or `restart()`; the goal sound also marks the level clear (no
  new sound). Dev override `?level=N` and test-hook access to the level.
- **Depends on:** 14
- **Unit tests:** HUD and panel models for level clear and defeat.
- **E2E tests (Playwright):** clear a level → panel with bonuses; "NEXT LEVEL"
  → empty arena, level N+1, fouls reset, score kept; defeat on level N shows N;
  restart and "PLAY AGAIN" → level 1, score 0; LEVEL card visible on desktop and
  mobile without horizontal scroll.
- **Done when:** the new §9 rows pass.

### Phase 16 — Level balancing and hardening ✅

- **Scope:** playtest levels 1–12 and tune the table, caps and bonuses; stress
  and frame-budget check at the cap level (16 orbs, 300 units/s, small max
  area); record the final values in REQUIREMENTS §4 and this roadmap.
- **Depends on:** 15
- **Tests:** regression tests for any edge case found; performance check at the
  cap level.
- **Done when:** the curve is tuned and documented, and every §9 row passes.
- **Status (2026-11-25):**
  - Done: a stress test at the hardest level (`levelConfig(1000)`: 16 orbs,
    300 units/s, 8% area; three seeds, 60 s each) in
    `tests/world/gameWorld.stress.test.ts`. The existing frame-budget check
    (60 orbs, ~1,000 wall segments) already covers more than the hardest level.
    Every §9 row passes (unit and Playwright).
  - Balancing: the initial D10 table and D11 bonuses were reviewed and
    approved as final, with no changes. REQUIREMENTS §4, D10 and D11 record
    them as final. Later tuning can use `npm run dev` with `?level=N`.

### Later candidates (not scheduled)

Each needs its own decision in REQUIREMENTS before it becomes a phase:

- Local best score and highest level in `localStorage` (§10 "High scores").
- Level intro: "LEVEL N" and a kickoff whistle before the orbs start moving.
- Orbs of different sizes and speeds from a given level (§10).
- Fixed obstacles (pre-built walls) on some levels (§10).
- Time limit per level (§10).

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
