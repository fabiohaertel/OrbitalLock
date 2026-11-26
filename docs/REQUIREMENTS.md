# Goal Lock — Game Requirements

## 1. Overview

Goal Lock is a 2D arcade puzzle game inspired by classic territory-capture games such as JezzBall.

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

- The player starts drawing by pressing and holding the primary mouse button or touching the screen, then moving the pointer. The drawing starts once the pointer has moved a small distance away from where it was pressed. That distance is just large enough to ignore the jitter of a click or tap. The path begins at the press point.
- A press that is released (a click or tap) or canceled before the drawing starts is not a drawing attempt. It draws nothing, is not rejected and is not a foul (D3). This applies anywhere in the arena, including on an orb.
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

### 3.8 Levels and Defeat

The game is a sequence of levels, each harder than the last (D10, §11.1).

Level cleared:

- All orbs of the current level have been successfully captured.
- The player then starts the next level. There is no final victory: levels continue until defeat.

Defeat:

- The player exceeds the current level's number of failed drawing attempts (fouls) or available lives.
- Every rejected or canceled drawing counts as a failed attempt, called a foul in the game. A click or tap that never started a drawing (§3.3) does not: see D3 (§11.1).

The game must provide:

- Level-cleared screen, with a control to start the next level.
- Defeat screen.
- Restart functionality (back to level 1).

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
- Initial number of orbs: 7.
- Orb movement speed: 250 arena units per second (the arena is 1000 × 625 units, D6). Playtesting found 160 and 200 too slow and 320 too fast.

Other values should be selected during prototype development and remain configurable.

These values form the base configuration. With level progression (D10), each level sets its own number of orbs, orb speed, maximum capture area and maximum failed attempts from the level table; the orb radius and minimum drawing length come from the base configuration on every level. The level table in D10 holds the final balancing values (approved 2026-11-25).

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
- Current level.
- Restart control.

### 5.3 HUD

The HUD must display relevant gameplay information without obstructing the arena.

- Each field is a scoreboard card: a small upper-case label above (or, in a narrow side column, beside) a large value.
- The HUD also shows the fouls: failed attempts against the allowed limit (D3). They are shown as one pip per allowed foul, filled for each foul used. When the next foul would lose the game, the fouls card pulses red. Very large or zero limits are shown as a number (`used/max`) instead of pips.
- The score value briefly enlarges when it goes up.
- The HUD shows the current level. The time is the current level's time; the score is the whole game's score (D10).

Example (wide screen, one bar):

    GOAL LOCK  [LEVEL 3] [CAPTURED 3/5] [REMAINING 2] [TIME 00:42] [SCORE 4650] [FOULS ●○○]  (↻ RESTART)

### 5.4 Visual Style

The arena is themed as a soccer field and the orbs as soccer balls. The theme is purely visual: it does not change any gameplay rule, size or collision shape.

- The arena background must be green and resemble a soccer field: alternating light and dark green mowing stripes and faint white field markings (halfway line, center circle and spot, penalty and goal areas, penalty spots and arcs).
- Field markings must be faint enough that they cannot be confused with permanent walls or the drawing preview.
- Each orb must be drawn as a soccer ball: a white ball with black pentagonal patches and seams in the classic truncated-icosahedron pattern, with shading so it reads as a sphere. A generated texture may be used.
- The ball's on-screen size must match the orb's collision radius.
- Moving balls must roll like a real soccer ball seen from above:
  - the patches and seams turn in the direction the ball is travelling, around the horizontal axis perpendicular to its movement;
  - the rolling speed matches the distance travelled (rolling without slipping: the ball turns by distance ÷ radius radians), so faster balls spin faster;
  - after a bounce the ball keeps its current orientation and rolls in its new direction;
  - the shading and highlight stay fixed (the light does not turn with the ball), so it keeps reading as a sphere;
  - a ball that stops moving (captured, or the level or game is over) keeps the orientation it had and stops rolling.
- Moving balls must show a motion-blur trail, like a photo of a ball in flight:
  - a soft, translucent light-gray streak behind the ball that fades out and narrows towards its end;
  - the trail follows the path the ball actually travelled, so after a bounce it bends around the bounce point and never extends through a wall, an arena boundary or a captured region;
  - its length is proportional to the ball's speed (the distance covered in a fixed fraction of a second), and it is drawn beneath all balls;
  - captured or stopped balls have no trail; a ball that has just appeared (game start or restart) has none until it moves.
- Rolling and the trail are purely visual. They are derived from the orbs' positions, never change the physics, and do not depend on the frame rate.
- Captured orbs must remain visually distinguishable from active orbs (captured balls are drawn dimmed).
- A captured region (D4) must look like a soccer goal net with the captured balls trapped inside it:
  - a shadowed backdrop in a medium-dark green: noticeably darker than the field's stripes, so captured regions still stand out from the open field, but not so dark that it looks black, and light enough that the white net cords and the captured balls stay clearly visible;
  - a mesh of white net cords in a diamond pattern, clipped to the region's shape;
  - the net is drawn over the captured balls, so they appear caught behind it.
- Inside a captured region, areas that are not captured, such as uncaptured islands, have no net and keep the field's stripes.
- The net is purely visual. Only active orbs move, and they never enter a captured region, so the net never covers an active ball.

### 5.5 Sound Effects

#### Collision sound

- Every time an active orb collides with something, a short collision sound must be played.
- A collision is a bounce, where an orb's movement direction changes because it hit:
  - an arena boundary,
  - a permanent wall, including the boundary of a captured region (D4), or
  - another active orb.
- An orb that touches without bouncing (for example, one already moving away from the wall it overlaps) does not make a sound. An orb touching an in-progress drawing is not a collision: that cancels the drawing (D2) and is a foul (see below).
- The collision sound is a soft kick of a soccer ball: a short, muffled, low-pitched thump played at a low volume.
- Collisions that happen within the same rendered frame are played as one sound, so simultaneous impacts do not stack into a loud, clipped sound.
- Browsers block audio until the user interacts with the page. Collisions before the first interaction are silent; sounds play normally after it.

#### Foul whistle

- Every time a foul occurs, a referee's whistle must be played: a single short blow, as when a referee calls a foul.
- A foul is a failed attempt as defined in D3: every rejected or canceled drawing. A click or tap that never started a drawing (§3.3) is not a foul and plays no whistle. A foul is the same event that increments the HUD's foul counter and shows the failure feedback (§3.7).
- A valid wall whose region is too large is not a foul (D3), so it plays no whistle.
- The foul that triggers defeat also plays the whistle.
- A foul always follows the player's input, so the whistle plays even on the player's very first interaction.

#### Goal sound

- Every time a capture occurs, a short, celebratory goal sound must be played.
- A capture occurs when a new wall captures at least one orb. Its region becomes a goal net (D4, §5.4), and the goal sound starts at that moment.
- One wall plays one goal sound, however many orbs or regions it captures.
- A capture that clears a level also plays the goal sound. It is the only sound for the level clear (no separate sound).
- No goal sound plays when a wall captures nothing: an empty region, a region over the maximum capture area (D3, D5), or a wall that encloses nothing. No goal sound plays for a foul either.
- The goal sound is synthesized and about half a second long:
  - a short swish of the ball hitting the net (noise whose pitch sweeps down);
  - then a rising three-note major arpeggio (C, E, G) in a soft, retro tone, the last note ringing out and fading.
- It is mid-pitched, between the low kick and the high whistle, so the three sounds stay distinct, and it is played at a moderate volume.
- A capture always follows the player's input, so the goal sound plays even if it is the player's first interaction.

#### General

- Missing audio support must not affect gameplay. If the browser has no Web Audio support, the game runs silently.

### 5.6 Interface Style

The HUD, buttons and level-cleared/defeat screens look like a stadium scoreboard. The style is purely visual: it does not change any gameplay rule.

- Font: Orbitron, bundled with the game (no external font service), so it also works offline and inside embedding pages. It is loaded before the game starts; if it cannot load, the game starts with a system font.
- Scoreboard cards are dark navy rounded panels with a thin border. Labels are muted; each value has an accent color: captured green, score gold, the others white.
- The title reads "GOAL LOCK", with "LOCK" in gold.
- Buttons are gold pills with a dark bold label and an icon where it helps (a circular arrow for restart). They lighten on hover, shrink slightly while pressed, and act on release. Each is at least 40 CSS pixels tall, so it is easy to tap.
- On wide screens the title, cards and restart button share one bar above the arena. On narrower screens the cards wrap into centered rows below the title and button. In a side column the cards are stacked, with the label left and the value right.
- The level-cleared and defeat screens dim the arena and pop in a rounded panel that shrinks to fit small arenas:
  - Level cleared: a gold "LEVEL N CLEAR" title, each level-clear bonus and their total (D11), the new score, and a "Next level" button.
  - Defeat: a red "DEFEAT" title, a one-line reason, a final scoreboard (level reached, total score, total time) and a "Play again" button that starts again at level 1.
- Text and the elements it sits on keep a contrast ratio of at least 4.5:1.

## 6. Scoring

The game must maintain a score for the current session.

The score accumulates across levels and resets when the game restarts at level 1 (D10).

Captures and level clears award points that grow with the level: see D11 (§11.1).

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
- Level-cleared and defeat conditions.
- Level progression and per-level configuration (D10, §11.1).

### 8.5 Rendering and UI

Responsible for:

- Arena rendering.
- Orb visualization.
- Wall visualization.
- Drawing preview.
- HUD and game screens.
- Responsive layout.

### 8.6 Audio

Responsible for:

- Collision sound, foul whistle and goal sound (§5.5).

The physics system reports collisions, and the game logic reports fouls and captures. Neither plays sounds itself.

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
| Capture all orbs of a level | The level-cleared screen shows the level-clear bonuses |
| Start the next level | Empty arena, next level's orbs and limits, fouls reset, score kept |
| Exceed the failure limit | Defeat is triggered, showing the level reached and the total score |
| Click or tap the arena without moving the pointer | Nothing is drawn and no foul is counted |
| Attempt to draw outside the arena | Drawing is constrained to arena boundaries |
| Restart the game | Initial game state is restored at level 1 with a score of 0 |
| Resize the browser window | Arena adapts to the available viewport |
| Change mobile device orientation | Arena adapts to the new dimensions |
| Draw using touch input | Drawing works as expected |
| Play on a mobile viewport | HUD and arena remain usable without horizontal scrolling |
| View the HUD and the level-cleared/defeat screen | Scoreboard cards and pill buttons in the Orbitron font; fouls shown as pips; current level shown |
| View the arena | Arena looks like a green soccer field; orbs look like soccer balls |
| Watch a moving ball | It rolls in its direction of travel and leaves a fading motion-blur trail |
| An orb bounces off an arena boundary, a wall or another orb | A soft kick sound plays |
| Capture an orb | The captured region looks like a goal net with the ball trapped behind it |
| A drawing is rejected or canceled (a foul) | A single referee whistle blow plays |
| Capture one or more orbs with a wall | A short goal sound (net swish and rising notes) plays once as the goal net appears |

## 10. Future Features

The following features are outside the current scope (multiple levels with increasing difficulty were added by D10):

- Different orb sizes and movement speeds.
- Time limits.
- High scores and leaderboards.
- Fixed obstacles.
- Special orb behaviors.
- Power-ups.
- Different wall types.
- Advanced visual effects.
- Music and sound effects other than those in §5.5.

These features may be introduced after the core gameplay mechanics are implemented and validated.

## 11. Design Decisions

### 11.1 Resolved Decisions

D1–D9 were approved for the MVP on 2026-11-24. D10 and D11 were approved on 2026-11-25 and replace D7 and D9.

#### D1 — Region closure

Resolves: whether a drawing must be a closed loop or can connect two existing walls, and whether drawing can begin and end on any existing wall segment.

- A drawing can enclose a region in either of two ways:
  - **Closed loop:** the path ends near its starting point or crosses itself.
  - **Wall-to-wall:** the path starts and ends on existing walls or arena boundaries.
- Start and end points may lie anywhere on any existing wall segment or arena boundary.
- Endpoints within a small tolerance of a wall or boundary are snapped onto it.

#### D2 — Wall construction

Clarifies §3.7: "If an active orb collides with a wall while it is being constructed".

- A wall is under construction while the player is drawing it: from the moment the drawing starts (the pointer has moved away from the press point, §3.3) until release.
- Before the drawing starts there is no path, so nothing can touch it.
- During construction, the in-progress path does not block orbs.
- Any active orb touching the in-progress path cancels the drawing attempt.
- On release, the drawing is validated and, if valid, committed instantly as a permanent wall.
- Walls do not grow over time.

#### D3 — Failed attempts

Resolves: whether invalid drawings consume lives.

- Every rejected or canceled drawing counts as one failed attempt.
- In the game, following the soccer theme (§5.4), a failed attempt is called a **foul**: the HUD counts fouls, and the referee blows the whistle for each one (§5.5). This is a name only; the rules below are unchanged.
- A press released or canceled before its drawing started (a click or tap, §3.3) is not a drawing and does not count.
- Once a drawing has started, it counts as usual, including when it is released shorter than the minimum drawing length.
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

#### D7 — Level progression (replaced by D10)

The MVP had a single level plus restart and no level-progression system. Replaced by D10.

#### D8 — Manual cancellation

Resolves: whether a wall can be partially drawn and then canceled manually.

- The player cannot cancel a drawing in progress.
- A drawing ends only when it is released (and then validated) or when the game cancels it: an active orb touches it (D2), or the browser cancels the input.
- A browser cancel before the drawing has started (§3.3) discards the press and is not a failed attempt.

#### D9 — Placeholder scoring (replaced by D11)

The MVP awarded 100 points per captured orb. Replaced by D11, which gives the same 100 points per orb on level 1.

#### D10 — Level progression

Replaces D7. Resolves: what happens when every orb is captured, and how difficulty grows.

- The game is **endless**: clearing a level leads to the next one, until the player is defeated. There is no final victory.
- When the last orb of a level is captured, the simulation stops and the level-cleared screen (§5.6) appears. The next level starts only when the player chooses it; there is no automatic advance.
- A new level starts with an empty arena (no walls or captured regions) and new orbs at random positions, created from that level's values.
- **Fouls reset every level.** Each level has its own foul limit; defeat is exceeding the current level's limit (D3).
- **The score accumulates** across levels. The time shown while playing is the current level's; the defeat screen shows the total time of the game.
- Restart (the HUD button or "Play again") always starts a new game at level 1 with a score of 0. There is no restart of a single level.
- Each level sets four values: number of orbs, orb speed, maximum capture area and foul limit. The orb radius (12) and the minimum drawing length come from the base configuration (§4).

Level table (final balancing values, approved 2026-11-25):

| Level | Orbs | Speed (units/s) | Max capture area | Fouls allowed |
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
| 11 and later | 1 more per level, at most 16 | 300 | 8% | 2 |

- Speed never exceeds 300 (playtesting found 320 too fast, §4). The orb count never exceeds 16 and the maximum capture area never goes below 8%.

#### D11 — Per-level scoring

Replaces D9. Clarifies §6.

- **Capture:** each captured orb awards `100 × level` points.
- **Level-clear bonus**, awarded when a level is cleared, is the sum of:
  - **Level:** `500 × level`.
  - **Fouls:** `200` for each foul still unused (the level's foul limit minus the fouls committed).
  - **Time:** `10` for each whole second under 60 s of level time (`10 × floor(max(0, 60 − level seconds))`); nothing at 60 s or more.
- No part is ever negative. The level-cleared screen shows each part and their total.

### 11.2 Open Decisions

No open decisions remain.
