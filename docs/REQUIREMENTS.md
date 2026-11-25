# Orbital Lock — Game Requirements

## 1. Overview

Orbital Lock is a 2D arcade puzzle game inspired by classic territory-capture games such as JezzBall.

The player must capture moving orbs by drawing free-form lines with the mouse or touch input, creating enclosed regions.

Unlike traditional territory-capture games, the player can draw arbitrary shapes, including horizontal, vertical, diagonal, and free-form lines.

The objective is to capture all orbs while ensuring that each captured region does not exceed the maximum allowed area.

## 2. Technology

- Game engine: Phaser 4
- Programming language: TypeScript
- Runtime: Web browser
- Target platforms: Desktop, tablet, and mobile browsers.

## 3. Gameplay

### 3.1 Arena

- The game must provide a rectangular, bounded play area.
- The arena must adapt dynamically to the available game viewport.
- Orbs move continuously within the arena.
- Orbs must remain inside the arena boundaries.
- The arena boundaries must prevent orbs from escaping.

### 3.2 Orbs

Each orb must have:

- Position (X and Y coordinates).
- Velocity (horizontal and vertical components).
- Radius.
- Movement state.
- Capture state.

Functional requirements:

- Orbs move continuously.
- Orbs bounce when colliding with arena boundaries.
- Orbs collide with other active orbs.
- Orb collisions must alter their movement directions and velocities according to the physics model.
- Captured orbs must stop participating in movement and collision calculations.

### 3.3 Drawing System

- The player starts drawing by pressing and holding the primary mouse button or touching the screen.
- Mouse or touch movement defines the drawing path.
- Releasing the primary mouse button or ending the touch finishes the drawing attempt.
- The player can draw horizontal, vertical, diagonal, and arbitrary free-form paths.
- Drawings must have a configurable minimum length.
- Drawing must be constrained to the arena boundaries.
- The drawing system must provide immediate visual feedback.
- The system must identify when a drawing creates an enclosed region.
- Drawing input must work consistently on desktop and touch-enabled devices.

### 3.4 Wall Creation

- A valid drawing becomes a permanent wall.
- Walls prevent active orbs from passing through them.
- Walls can connect to existing walls or arena boundaries to create enclosed regions.
- Walls must not be created through active orbs.
- Invalid drawings must be rejected.
- The system must validate a drawing before committing it to the arena.
- Region closure rules: see D1 (§11.1).

### 3.5 Region Detection

- The game must identify enclosed regions created by new walls.
- Regions may have arbitrary polygonal shapes.
- The area of each enclosed region must be calculated.
- The system must identify which orbs belong to each enclosed region.
- A region containing no active orbs must not count as a successful capture.

### 3.6 Capture Rules

- A region can contain one or multiple orbs.
- All active orbs inside a successfully captured region are captured simultaneously.
- Captured orbs must no longer participate in physics simulation.
- A region is eligible for capture only if its area does not exceed the configured maximum capture area.
- Regions exceeding the maximum area must not be accepted as successful captures.
- The maximum area applies to each region on its own, and captured regions become solid: see D4 and D5 (§11.1).

### 3.7 Drawing Safety

- A drawing must not intersect an active orb.
- If an active orb collides with a wall while it is being constructed, the drawing attempt must be canceled.
- Invalid drawing attempts must provide visual feedback.
- The arena must remain in a consistent state after a canceled drawing.
- Construction semantics: see D2 (§11.1).

### 3.8 Victory and Defeat

Victory:

- All orbs have been successfully captured.

Defeat:

- The player exceeds the configured number of failed drawing attempts or available lives.
- Every rejected or canceled drawing counts as a failed attempt: see D3 (§11.1).

The game must provide:

- Victory screen.
- Defeat screen.
- Restart functionality.

## 4. Gameplay Configuration

The following values must be configurable:

- Initial number of orbs.
- Orb radius.
- Orb movement speed.
- Maximum capture area percentage.
- Minimum drawing length.
- Maximum failed attempts or available lives.

Initial balancing defaults:

- Maximum capture area: 15% of total arena area.

Other values should be selected during prototype development and remain configurable.

## 5. User Interface

### 5.1 Game Layout

- The game layout should follow a structure similar to the classic JezzBall 2D game.
- The main game arena must occupy the available game viewport, maximizing the usable screen area.
- The arena dimensions must adapt dynamically to the available browser viewport.
- The layout must support desktop, tablet, and mobile devices.
- The arena must resize when the browser window or device orientation changes.
- Game elements, including orbs, walls, and drawing paths, must maintain their relative positions and proportions when the arena is resized.
- The game HUD must remain accessible without unnecessarily reducing the playable area.
- The arena must maintain its rectangular proportions while adapting to different screen dimensions.
- The game must not require horizontal scrolling.
- The interface must prioritize the playable arena over decorative elements.
- Arena proportions and resizing behavior: see D6 (§11.1).

### 5.2 Game Elements

The initial interface must include:

- Main game arena.
- Moving orbs.
- Permanent walls.
- Temporary drawing preview.
- Captured orb counter.
- Remaining orb counter.
- Elapsed time.
- Current score.
- Restart control.

### 5.3 HUD

The HUD must display relevant gameplay information without obstructing the arena.

Example:

    ORBITAL LOCK

    Captured: 3 / 8
    Remaining: 5
    Time: 00:42
    Score: 450

    [Restart]

## 6. Scoring

The game must maintain a score for the current session.

The scoring formula and bonuses will be defined during gameplay balancing.

The initial implementation must provide the score tracking infrastructure without requiring a complex scoring system.

Placeholder rule for the MVP: see D9 (§11.1).

## 7. Non-Functional Requirements

### 7.1 Performance

- The game must run smoothly in modern desktop and mobile browsers.
- Physics simulation must be independent of rendering frame rate.
- Delta time must be used appropriately.
- Collision detection must support multiple simultaneously moving orbs.
- Drawing and geometry calculations must not cause noticeable frame drops.

### 7.2 Responsiveness

- The game must adapt to different browser window sizes and device dimensions.
- The arena must resize dynamically when the available viewport changes.
- The arena must maintain its intended proportions.
- Mouse and touch coordinates must be correctly translated into arena coordinates.
- The game must support different screen resolutions and pixel densities.
- Resizing must not introduce unexpected changes to the relative positions of game elements.
- The interface must support both portrait and landscape orientations where practical.

### 7.3 Input

- Mouse input must be supported on desktop devices.
- Touch input must be supported on mobile and tablet devices.
- Drawing interactions must provide immediate visual feedback.
- Browser gestures must not unintentionally interfere with gameplay while drawing.

### 7.4 Maintainability

- Keep physics, geometry, capture rules, rendering, and UI logic separated.
- Avoid coupling game logic directly to Phaser display objects.
- Use TypeScript strict mode.
- Keep important gameplay rules configurable.

## 8. Architecture Guidelines

The game should separate the following responsibilities:

### 8.1 Physics System

Responsible for:

- Orb movement.
- Velocity updates.
- Collision detection.
- Collision response.
- Boundary interactions.

### 8.2 Geometry System

Responsible for:

- Drawing path processing.
- Line and segment intersection.
- Polygon validation.
- Region detection.
- Polygon area calculation.
- Point-in-region detection.

### 8.3 Capture System

Responsible for:

- Identifying captured orbs.
- Validating capture area.
- Updating orb states.
- Reporting capture results.

### 8.4 Game Logic

Responsible for:

- Game state.
- Scoring.
- Lives and failed attempts.
- Victory and defeat conditions.
- Level progression (single level for the MVP: see D7, §11.1).

### 8.5 Rendering and UI

Responsible for:

- Arena rendering.
- Orb visualization.
- Wall visualization.
- Drawing preview.
- HUD and game screens.
- Responsive layout.

## 9. Acceptance Criteria

The initial implementation must satisfy the following scenarios:

| Scenario | Expected Result |
|---|---|
| Draw a closed square around an orb | Orb is captured |
| Draw a closed polygon around an orb | Orb is captured |
| Draw a diagonal wall | Wall is created if valid |
| Draw a region larger than the maximum area | Capture is rejected |
| Draw a region containing no active orbs | No capture occurs |
| Draw through an active orb | Drawing is rejected |
| Orb hits a wall during construction | Drawing is canceled |
| Capture all orbs | Victory is triggered |
| Exceed the failure limit | Defeat is triggered |
| Attempt to draw outside the arena | Drawing is constrained to arena boundaries |
| Restart the game | Initial game state is restored |
| Resize the browser window | Arena adapts to the available viewport |
| Change mobile device orientation | Arena adapts to the new dimensions |
| Draw using touch input | Drawing works as expected |
| Play on a mobile viewport | HUD and arena remain usable without horizontal scrolling |

## 10. Future Features

The following features are outside the initial MVP scope:

- Multiple levels with increasing difficulty.
- Different orb sizes and movement speeds.
- Time limits.
- High scores and leaderboards.
- Fixed obstacles.
- Special orb behaviors.
- Power-ups.
- Different wall types.
- Advanced visual effects.
- Sound effects and music.

These features may be introduced after the core gameplay mechanics are implemented and validated.

## 11. Design Decisions

### 11.1 Resolved Decisions

The following decisions were approved for the MVP on 2026-11-24.

#### D1 — Region closure

Resolves: whether a drawing must be a closed loop or can connect two existing walls, and whether drawing can begin and end on any existing wall segment.

- A drawing can enclose a region in either of two ways:
  - **Closed loop:** the path ends near its starting point or crosses itself.
  - **Wall-to-wall:** the path starts and ends on existing walls or arena boundaries.
- Start and end points may lie anywhere on any existing wall segment or arena boundary.
- Endpoints within a small tolerance of a wall or boundary are snapped onto it.

#### D2 — Wall construction

Clarifies §3.7: "If an active orb collides with a wall while it is being constructed".

- A wall is under construction while the player is drawing it, from pointer or touch down to release.
- During construction, the in-progress path does not block orbs.
- Any active orb touching the in-progress path cancels the drawing attempt.
- On release, the drawing is validated and, if valid, committed instantly as a permanent wall.
- Walls do not grow over time.

#### D3 — Failed attempts

Resolves: whether invalid drawings consume lives.

- Every rejected or canceled drawing counts as one failed attempt.
- Defeat is triggered when the number of failed attempts exceeds the configured `maxFailedAttempts` (§3.8).
- A valid wall whose enclosed region exceeds the maximum capture area is not a failed attempt: the wall stays and no capture occurs.

#### D4 — Captured regions

Resolves: whether captured regions remain physically separated.

- A successfully captured region becomes solid, filled space.
- Orbs in a captured region stop moving and no longer take part in physics.
- Active orbs collide with the captured region's boundary walls.

#### D5 — Maximum capture area and multiple regions

Resolves: whether the maximum capture area applies to the entire region or the individual region containing each captured orb, and how multiple regions created by a single drawing are evaluated.

- The maximum capture area (default 15% of the total arena area) applies to each enclosed region on its own.
- When one drawing creates several regions, each region is evaluated independently.

#### D6 — Arena proportions and resizing

Resolves: whether the arena should preserve a fixed aspect ratio or use all available viewport space, and how game elements should be repositioned or scaled when the arena dimensions change.

- The arena keeps a fixed aspect ratio and scales to fit the available viewport.
- The HUD is placed beside or above the arena, depending on orientation and available space.
- All game state uses a fixed logical coordinate space, independent of screen size.
- Rendering scales logical coordinates to screen pixels, so resizing does not change the relative positions or proportions of game elements.

#### D7 — Level progression

Clarifies §8.4, which lists level progression although multiple levels are a future feature (§10).

- The MVP has a single level plus restart.
- No level-progression system is built for the MVP.

#### D8 — Manual cancellation

Resolves: whether a wall can be partially drawn and then canceled manually.

- The player cannot cancel a drawing in progress.
- A drawing ends only when it is released (and then validated) or when the game cancels it: an active orb touches it (D2), or the browser cancels the input.

#### D9 — Placeholder scoring

Clarifies §6, which leaves the scoring formula to gameplay balancing.

- Until balancing defines the formula, each captured orb awards 100 points.

### 11.2 Open Decisions

No open decisions remain for the MVP.
