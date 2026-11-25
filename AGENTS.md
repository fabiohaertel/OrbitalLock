# Agent Instructions

## Project Overview

Goal Lock is a 2D arcade puzzle game inspired by classic territory-capture games such as JezzBall.

The player must capture moving orbs by drawing free-form lines with the mouse. Lines can be horizontal, vertical, diagonal, or follow arbitrary paths. The objective is to enclose all orbs within regions that respect the maximum capture area.

## Project Requirements

**Before implementing any feature, read and follow:**

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)

This document is the source of truth for game functionality, gameplay rules, technical constraints, and acceptance criteria.

Implementation is organized into phases in [`docs/ROADMAP.md`](docs/ROADMAP.md). When implementing a phase, follow its scope, dependencies and tests, and update its status row when the phase is complete.

If an implementation decision conflicts with the requirements, follow the requirements and ask for clarification when necessary.

## General Development Guidelines

### Architecture

- Keep the code modular and maintain clear separation of responsibilities.
- Separate physics simulation, geometry calculations, game rules, rendering, and UI.
- Avoid tightly coupling game logic to Phaser rendering objects.
- Prefer small, focused modules with well-defined responsibilities.
- Avoid unnecessary abstractions and premature optimization.

### Code Quality

- Use TypeScript.
- Enable strict type checking.
- Prefer explicit types and descriptive names.
- Avoid `any` unless there is a clear justification.
- Keep functions focused and reasonably small.
- Avoid duplicated logic.
- Do not introduce dependencies without a clear need.

### Game Development

- Keep physics calculations independent of rendering frame rate.
- Use delta time appropriately for movement and simulation.
- Ensure collision detection is reliable and predictable.
- Keep geometric calculations deterministic whenever possible.
- Handle edge cases in drawing, polygon validation, collision detection, and region capture.
- Avoid relying exclusively on visual Phaser objects for game-state calculations.

### Testing

- Add tests for important game mechanics and business rules.
- Prioritize geometry, collision, region detection, and capture logic.
- Test edge cases, not only ideal scenarios.
- Run relevant tests after modifying existing functionality.
- Do not consider a feature complete until its acceptance criteria are satisfied.

### Working With Existing Code

- Inspect the existing project structure before making changes.
- Follow established conventions unless there is a good reason to change them.
- Avoid unrelated modifications.
- Do not remove existing functionality without explicit justification.
- Update documentation when implementation decisions change the documented behavior.

## AI Agent Workflow

Before starting a task:

1. Read this file.
2. Read `docs/REQUIREMENTS.md`.
3. Inspect the relevant source code and existing tests.
4. Identify dependencies and potential side effects.
5. Implement the smallest coherent solution.

After implementation:

1. Run relevant tests.
2. Run type checking and linting when available.
3. Verify that existing functionality remains intact.
4. Report what changed, tests performed, and any known limitations.

## Phaser AI Skills

- Before implementing or modifying Phaser-related code, agents must inspect and use the official Phaser AI Agent Skills whenever applicable.
- Prefer official Phaser documentation and skills over assumptions or outdated API knowledge.
- Identify and follow the relevant skills for the task being implemented.
- Do not invent Phaser APIs or rely on examples from incompatible Phaser versions.
- If a relevant skill is unavailable, consult the official Phaser 4 documentation.
- Keep implementations compatible with Phaser 4.

Official resources:

- Phaser repository: https://github.com/phaserjs/phaser
- Phaser documentation: <https://docs.phaser.io/>

## Important Principles

- Requirements take precedence over assumptions.
- Correctness is more important than implementation shortcuts.
- Prefer simple, maintainable solutions.
- Do not silently change gameplay rules.
- Ask for clarification when requirements are ambiguous or contradictory.
