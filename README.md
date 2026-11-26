# Goal Lock

A 2D arcade puzzle game for the browser, set on a soccer field. Soccer balls
bounce around the pitch; draw walls with your mouse or finger to fence them in,
and lock every ball inside a goal net. Inspired by classic territory-capture
games, but your walls can take any shape.

> **Status: complete MVP.** The full game loop works in desktop and mobile
> browsers, with mouse or touch: draw walls, capture balls, win or lose, and
> restart. All roadmap phases are done and every acceptance scenario in the
> requirements passes. See [Roadmap](#roadmap).

## How to play

- Soccer balls bounce continuously around the field, off its edges, off the
  walls you draw and off each other.
- Press and drag (mouse or touch) to draw a wall. It can be straight, diagonal
  or completely free-form. A click or tap without dragging draws nothing.
- When you release, a valid path becomes a permanent wall. A wall encloses a
  region when it forms a closed loop, or when it starts and ends on other walls
  or the field's edges.
- An enclosed region captures every ball inside it, as long as it is no larger
  than the maximum capture area (15% of the field). The region becomes a goal
  net with the balls trapped behind it, and you hear a goal jingle. A region
  with no balls captures nothing, and a region that is too large just stays a
  wall: neither is a foul.
- A drawing is a **foul** if it passes through a ball, or if a ball touches the
  path while you are still drawing it. The referee blows the whistle, and the
  fouls card in the HUD fills a pip.
- **Clear a level** by capturing every ball, then start the next, harder one:
  more and faster balls, smaller nets and fewer fouls allowed. Levels never
  end. **Lose** when you commit more fouls than the level allows (4 on level 1,
  2 from level 8): the fouls card pulses red when the next foul would end the
  game. Fouls reset every level; the score carries over.
- Each ball scores 100 × the level. Clearing a level adds a bonus for the
  level, for each unused foul and for clearing it in under 60 seconds.

The full rules are in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

## Features

- Free-form wall drawing, not limited to horizontal or vertical lines
- Ball physics that doesn't depend on frame rate, with ball-to-ball collisions.
  Stress-tested with dozens of fast balls and hundreds of wall segments
- Detection of regions of any polygonal shape, with area-based capture rules
- Endless levels from a difficulty table: from 3 balls at speed 220 (field
  units per second, on a 1000 × 625 field) with a 15% maximum capture area,
  up to 16 balls at speed 300 with 8%
- Soccer theme: a striped green field with faint markings, shaded balls that
  roll in their direction of travel with a motion-blur trail, and goal nets
  over captured regions
- Stadium-scoreboard HUD in the bundled Orbitron font: cards for the level,
  captured and remaining balls, the level's time, score (it pops when it goes
  up) and fouls (shown as pips), a pill restart button, and animated
  level-cleared (bonus breakdown, "Next level") and defeat (level reached,
  final score and time) screens
- Synthesized sound effects (no audio files): a soft kick on every bounce, a
  referee whistle on every foul, and a short goal jingle on every capture. The
  game runs silently if the browser has no Web Audio support
- Responsive layout for desktop, tablet and mobile, in portrait and landscape;
  mouse and touch input

## Tech stack

- [Phaser 4](https://phaser.io/) for rendering and input
- [TypeScript](https://www.typescriptlang.org/) in strict mode
- [Vite](https://vite.dev/) for the dev server and build
- [Vitest](https://vitest.dev/) for unit and integration tests
- [Playwright](https://playwright.dev/) for browser tests
- [ESLint](https://eslint.org/) with `typescript-eslint`

## Getting started

Requires [Node.js](https://nodejs.org/) 22.12 or later.

```bash
npm install
npm run dev
```

Then open the URL that Vite prints (by default <http://localhost:5173>).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the unit and integration tests once |
| `npm run test:watch` | Run those tests in watch mode |
| `npm run test:e2e` | Run the browser tests (Playwright) |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm run lint` | Lint the project with ESLint |

Before the first `npm run test:e2e`, install the browser once with
`npx playwright install chromium`.

Use `npm test` rather than calling `vitest` directly. It goes through a small
launcher that works around a Windows path issue (see
[docs/DECISIONS.md](docs/DECISIONS.md)).

### Development aids

Development builds only (absent from `npm run build`):

- Gameplay values can be overridden from the URL for quick balancing, e.g.
  `http://localhost:5173/?orbs=3&speed=200&seed=7`. Supported: `orbs` (number
  of balls), `radius`, `speed`, `maxArea`, `minLength`, `maxFouls` (these
  replace the level's values on every level), `seed` (a reproducible ball
  layout) and `level` (start at that level).
- `window.__goalLock` exposes the running game to the browser tests.

### Tests

Besides unit tests for geometry, physics, capture rules and the HUD, the suite
includes the acceptance scenarios from the requirements, a seeded stress test
(many balls and random walls, checking that nothing escapes the field or
crosses a wall) and a frame-budget check. Mobile performance was profiled only
in Chromium emulation with CPU throttling, not on real devices.

## Project structure

```text
src/
  config/     gameplay configuration and defaults
  geometry/   vectors, segments, polylines, polygons, region detection
  physics/    balls ("orbs" in the code), fixed-timestep simulation, collisions
  drawing/    drawing input, wall validation and wall creation
  capture/    capture rules: area limit, empty regions, capturing balls
  game/       game progress: status, fouls, score, timer
  world/      GameWorld: the complete game without rendering
  audio/      synthesized sound effects: kick, whistle and goal sounds
  layout/     responsive layout, viewport watching, screen-to-field mapping
  render/     drawing the soccer field, balls, goal nets and feedback with Phaser
  ui/         HUD scoreboard cards, buttons, level-cleared/defeat screens, font loading
  scenes/     Phaser scenes (glue between input, GameWorld and rendering)
  assets/     bundled Orbitron UI font (SIL Open Font License)
  main.ts     game entry point
tests/        unit and integration tests, mirroring src/
e2e/          browser tests (Playwright)
docs/         requirements, roadmap and technical decisions
scripts/      development helper scripts
```

The game rules (geometry, physics, capture and game logic) are written in plain
TypeScript with no Phaser dependency. They can be tested without a browser, and
Phaser is used only to draw the game and receive input. In the code, balls are
called orbs and fouls are failed attempts, the names the rules use.

## Roadmap

Development follows the phases in [docs/ROADMAP.md](docs/ROADMAP.md):

- [x] Phase 0 — Project setup and design decisions
- [x] Phase 1 — Geometry primitives
- [x] Phase 2 — Physics
- [x] Phase 3 — Drawing input
- [x] Phase 4 — Drawing validation and walls
- [x] Phase 5 — Region detection
- [x] Phase 6 — Capture rules
- [x] Phase 7 — Game logic (win, lose, score, restart)
- [x] Phase 8 — Rendering, HUD and screens
- [x] Phase 9 — Responsive layout and touch devices
- [x] Phase 10 — Acceptance testing and hardening
- [x] Phase 11 — Level progression decisions
- [x] Phase 12 — Level definitions
- [x] Phase 13 — Per-level scoring
- [x] Phase 14 — Level progression in game logic
- [x] Phase 15 — Level UI
- [x] Phase 16 — Level balancing and hardening

The production build uses relative asset paths and bundles its font, so it
also runs offline and from a sub-path, such as inside itch.io's iframe.

Planned next: high scores, obstacles, power-ups, special balls, and music.

## Documentation

- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md): game rules, technical
  requirements, acceptance criteria and design decisions
- [docs/ROADMAP.md](docs/ROADMAP.md): implementation phases, their status and
  the tests planned for each
- [docs/DECISIONS.md](docs/DECISIONS.md): technical decisions about tooling and
  architecture
