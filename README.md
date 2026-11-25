# Orbital Lock

A 2D arcade puzzle game for the browser, inspired by classic territory-capture
games. Capture the moving orbs by drawing walls with your mouse or finger, and
trap every orb inside a region small enough to lock it in place.

> **Status: early development.** The game is playable in desktop and mobile
> browsers, with mouse or touch. Final acceptance testing and polish are in
> progress. Opening it in a browser
> currently shows only a title screen. See [Roadmap](#roadmap) for progress.

## How to play

- Orbs bounce continuously around a rectangular arena, colliding with the arena
  edges, the walls you draw, and each other.
- Press and drag (mouse or touch) to draw a path. Paths can be straight,
  diagonal or completely free-form.
- When you release, a valid path becomes a permanent wall. A path encloses a
  region when it forms a closed loop, or when it starts and ends on existing
  walls or the arena edges.
- An enclosed region captures every orb inside it, as long as the region is no
  larger than the maximum capture area (15% of the arena by default). A region
  with no orbs captures nothing.
- A drawing fails if it passes through an orb, or if an orb touches the path
  while you're still drawing it. Every failed drawing counts against you.
- **Win** by capturing every orb. **Lose** when your failed drawings exceed the
  allowed limit.

The full rules are in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

## Features

These are the goals for the first playable version. Most are still being built.

- Free-form wall drawing, not limited to horizontal or vertical lines
- Orb physics that doesn't depend on frame rate, with orb-to-orb collisions
- Detection of regions of any polygonal shape, with area-based capture rules
- Configurable gameplay: number of orbs, orb size and speed, maximum capture
  area, minimum drawing length, failure limit
- Responsive layout for desktop, tablet and mobile, in portrait and landscape
- Mouse and touch input
- HUD with captured and remaining orbs, elapsed time, score and restart

## Tech stack

- [Phaser 4](https://phaser.io/) for rendering and input
- [TypeScript](https://www.typescriptlang.org/) in strict mode
- [Vite](https://vite.dev/) for the dev server and build
- [Vitest](https://vitest.dev/) for tests
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
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run the browser tests (Playwright) |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm run lint` | Lint the project with ESLint |

Before the first `npm run test:e2e`, install the browser once with
`npx playwright install chromium`.

In development builds, gameplay values can be overridden from the URL for
quick balancing, e.g. `http://localhost:5173/?orbs=3&speed=200&seed=7`
(supported: `orbs`, `radius`, `speed`, `maxArea`, `minLength`, `maxMisses`,
`seed`).

Use `npm test` rather than calling `vitest` directly. It goes through a small
launcher that works around a Windows path issue (see
[docs/DECISIONS.md](docs/DECISIONS.md)).

## Project structure

```text
src/
  config/     gameplay configuration and defaults
  geometry/   vectors, segments, polylines, polygons, region detection
  physics/    orbs, fixed-timestep simulation, collisions
  drawing/    drawing input, wall validation and wall creation
  capture/    capture rules: area limit, empty regions, capturing orbs
  game/       game progress: status, failed attempts, score, timer
  world/      GameWorld: the complete game without rendering
  layout/     responsive layout, viewport watching, screen-to-arena mapping
  render/     drawing the arena, orbs, walls and feedback with Phaser
  ui/         HUD, victory/defeat screens, buttons
  scenes/     Phaser scenes (glue between input, GameWorld and rendering)
  main.ts     game entry point
tests/        unit and integration tests, mirroring src/
e2e/          browser tests (Playwright)
docs/         requirements, roadmap and technical decisions
scripts/      development helper scripts
```

The game rules (geometry, physics, capture and game logic) are written in plain
TypeScript with no Phaser dependency. They can be tested without a browser, and
Phaser is used only to draw the game and receive input.

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
- [ ] Phase 10 — Acceptance testing and polish

Planned for after the first playable version: multiple levels, high scores,
obstacles, power-ups, special orbs, and music.

## Documentation

- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md): game rules, technical
  requirements, acceptance criteria and design decisions
- [docs/ROADMAP.md](docs/ROADMAP.md): implementation phases, their status and
  the tests planned for each
- [docs/DECISIONS.md](docs/DECISIONS.md): technical decisions about tooling and
  architecture
