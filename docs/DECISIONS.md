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
- **Logical coordinates:** game state uses the fixed `ARENA` coordinate space in
  `src/config/gameConfig.ts` (1000 × 625 units), implementing D6.
