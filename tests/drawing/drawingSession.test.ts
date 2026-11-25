import { describe, expect, it } from 'vitest';
import { ARENA, DEFAULT_GAMEPLAY_CONFIG } from '../../src/config/gameConfig';
import {
  DEFAULT_SAMPLE_SPACING,
  DEFAULT_SIMPLIFY_TOLERANCE,
  DEFAULT_START_DISTANCE,
  DrawingSession,
  createDrawingOptions,
  type DrawingOptions,
  type DrawingResult,
  type PointerInput,
} from '../../src/drawing/drawingSession';
import { screenToArena } from '../../src/layout/arenaTransform';

const options: DrawingOptions = { minLength: 40, sampleSpacing: 2, startDistance: 8, simplifyTolerance: 1 };

function at(x: number, y: number, pointerId = 1, isPrimary = true): PointerInput {
  return { pointerId, position: { x, y }, isPrimary };
}

function expectCompleted(result: DrawingResult | undefined) {
  if (result?.kind !== 'completed') {
    throw new Error(`expected a completed drawing, got ${String(result?.kind)}`);
  }
  return result;
}

/** Draws a straight stroke through `steps` intermediate points. */
function stroke(session: DrawingSession, from: [number, number], to: [number, number], steps = 50) {
  session.begin(at(from[0], from[1]));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    session.move(at(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t));
  }
  return session.end(at(to[0], to[1]));
}

describe('createDrawingOptions', () => {
  it('uses the configured minimum drawing length and default sampling', () => {
    expect(createDrawingOptions(DEFAULT_GAMEPLAY_CONFIG)).toEqual({
      minLength: DEFAULT_GAMEPLAY_CONFIG.minDrawingLength,
      sampleSpacing: DEFAULT_SAMPLE_SPACING,
      startDistance: DEFAULT_START_DISTANCE,
      simplifyTolerance: DEFAULT_SIMPLIFY_TOLERANCE,
    });
  });

  it('keeps the start distance above the sample spacing and well below the minimum drawing length', () => {
    expect(DEFAULT_START_DISTANCE).toBeGreaterThanOrEqual(DEFAULT_SAMPLE_SPACING);
    expect(DEFAULT_START_DISTANCE).toBeLessThan(DEFAULT_GAMEPLAY_CONFIG.minDrawingLength / 2);
  });

  it('keeps the simplification tolerance well below the default orb radius', () => {
    expect(DEFAULT_SIMPLIFY_TOLERANCE).toBeLessThan(DEFAULT_GAMEPLAY_CONFIG.orbRadius / 4);
  });
});

describe('DrawingSession — starting', () => {
  it('accepts a primary press inside the arena, but draws nothing until the pointer moves', () => {
    const session = new DrawingSession(ARENA, options);
    expect(session.isDrawing).toBe(false);
    expect(session.begin(at(100, 100))).toBe(true);
    expect(session.isPressed).toBe(true);
    expect(session.isDrawing).toBe(false);
    expect(session.previewPath).toEqual([]);
  });

  it('starts drawing once the pointer is the start distance from the press point, from the press point', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    session.move(at(104, 103)); // 5 units away: still a press
    expect(session.isDrawing).toBe(false);
    expect(session.previewPath).toEqual([]);
    session.move(at(100, 108)); // exactly 8 units away
    expect(session.isDrawing).toBe(true);
    expect(session.previewPath).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 108 },
    ]);
  });

  it('keeps drawing once started, even if the pointer comes back near the press point', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    session.move(at(130, 100));
    session.move(at(101, 100));
    expect(session.isDrawing).toBe(true);
    expect(session.previewPath.at(-1)).toEqual({ x: 101, y: 100 });
  });

  it('measures the start distance after clamping to the arena', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(2, 100));
    session.move(at(-50, 100)); // clamped to x = 0: only 2 units from the press
    expect(session.isDrawing).toBe(false);
  });

  it('starts on the arena border', () => {
    const session = new DrawingSession(ARENA, options);
    expect(session.begin(at(0, ARENA.height))).toBe(true);
  });

  it('does not start from non-primary input (e.g. right mouse button)', () => {
    const session = new DrawingSession(ARENA, options);
    expect(session.begin(at(100, 100, 1, false))).toBe(false);
    expect(session.isDrawing).toBe(false);
  });

  it('does not start outside the arena', () => {
    const session = new DrawingSession(ARENA, options);
    expect(session.begin(at(-5, 100))).toBe(false);
    expect(session.begin(at(100, ARENA.height + 1))).toBe(false);
    expect(session.isDrawing).toBe(false);
  });

  it('does not start a second drawing while one is in progress', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100, 1));
    expect(session.begin(at(300, 300, 2))).toBe(false);
    session.move(at(150, 100, 1));
    expect(session.previewPath[0]).toEqual({ x: 100, y: 100 });
  });
});

describe('DrawingSession — drawing', () => {
  it('follows the pointer, including the latest position in the preview', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    session.move(at(110, 100));
    session.move(at(111, 100)); // closer than the sample spacing: preview tip only
    expect(session.previewPath).toEqual([
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 111, y: 100 },
    ]);
    session.move(at(120, 100));
    expect(session.previewPath).toEqual([
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 120, y: 100 },
    ]);
  });

  it('filters jitter smaller than the sample spacing', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    for (let i = 0; i < 100; i++) {
      session.move(at(100 + (i % 2) * 0.5, 100));
    }
    expect(session.previewPath.length).toBeLessThanOrEqual(2);
  });

  it('clamps points outside the arena onto its border', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(50, 50));
    session.move(at(-200, 50));
    session.move(at(-200, -300));
    session.move(at(ARENA.width + 50, ARENA.height + 50));
    expect(session.previewPath).toEqual([
      { x: 50, y: 50 },
      { x: 0, y: 50 },
      { x: 0, y: 0 },
      { x: ARENA.width, y: ARENA.height },
    ]);
    for (const point of session.previewPath) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(ARENA.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(ARENA.height);
    }
  });

  it('ignores movement from secondary pointers (e.g. a second finger)', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100, 7));
    session.move(at(500, 500, 8));
    session.move(at(150, 100, 7));
    expect(session.previewPath).toEqual([
      { x: 100, y: 100 },
      { x: 150, y: 100 },
    ]);
  });

  it('ignores movement when not drawing', () => {
    const session = new DrawingSession(ARENA, options);
    session.move(at(100, 100));
    expect(session.previewPath).toEqual([]);
  });
});

describe('DrawingSession — finishing', () => {
  it('completes a stroke longer than the minimum and simplifies it', () => {
    const session = new DrawingSession(ARENA, options);
    const result = expectCompleted(stroke(session, [100, 100], [300, 100]));
    expect(result.path).toEqual([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ]);
    expect(result.length).toBeCloseTo(200, 9);
    expect(session.isDrawing).toBe(false);
    expect(session.previewPath).toEqual([]);
  });

  it('keeps diagonal and free-form shapes (REQUIREMENTS §3.3)', () => {
    const session = new DrawingSession(ARENA, options);
    const diagonal = expectCompleted(stroke(session, [100, 100], [300, 300]));
    expect(diagonal.path).toHaveLength(2);

    session.begin(at(200, 200));
    for (let i = 1; i <= 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      session.move(at(200 + Math.sin(angle) * 80, 200 - Math.cos(angle) * 80 + 80));
    }
    const circle = expectCompleted(session.end(at(200, 200)));
    expect(circle.path.length).toBeGreaterThan(8);
    expect(circle.length).toBeGreaterThan(2 * Math.PI * 80 * 0.95);
  });

  it('includes the release position', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    const result = expectCompleted(session.end(at(100, 160)));
    expect(result.path).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 160 },
    ]);
  });

  it('clamps the release position', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    const result = expectCompleted(session.end(at(-500, 100)));
    expect(result.path.at(-1)).toEqual({ x: 0, y: 100 });
  });

  it('rejects strokes shorter than the minimum length', () => {
    const session = new DrawingSession(ARENA, options);
    const result = stroke(session, [100, 100], [130, 100]);
    expect(result?.kind).toBe('tooShort');
    expect(result?.kind === 'tooShort' ? result.length : Number.NaN).toBeCloseTo(30, 9);
    expect(session.isDrawing).toBe(false);
  });

  it('accepts a stroke exactly at the minimum length', () => {
    const session = new DrawingSession(ARENA, options);
    expect(stroke(session, [100, 100], [140, 100])?.kind).toBe('completed');
  });

  it('measures the length along the path, not between its endpoints', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    session.move(at(125, 100));
    const result = session.end(at(100, 100.5)); // back near the start: 50 units drawn
    expect(result?.kind).toBe('completed');
  });

  it('reports a click or tap (no movement) as not started, and ends the press', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    expect(session.end(at(100, 100))).toEqual({ kind: 'notStarted' });
    expect(session.isPressed).toBe(false);
    expect(session.begin(at(200, 200))).toBe(true);
  });

  it('reports a press with jitter below the start distance as not started', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    session.move(at(103, 98));
    session.move(at(97, 104));
    expect(session.end(at(105, 100))).toEqual({ kind: 'notStarted' });
  });

  it('treats a tap as not started, even with zero start distance and minimum length', () => {
    const session = new DrawingSession(ARENA, { ...options, minLength: 0, startDistance: 0 });
    session.begin(at(100, 100));
    expect(session.end(at(100, 100))).toEqual({ kind: 'notStarted' });
  });

  it('rejects a started drawing that is still shorter than the minimum length', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    expect(session.end(at(115, 100))?.kind).toBe('tooShort');
  });

  it('ignores release of a secondary pointer', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100, 1));
    session.move(at(200, 100, 1));
    expect(session.end(at(400, 100, 2))).toBeUndefined();
    expect(session.isDrawing).toBe(true);
  });

  // Regression (Phase 10): the mouse has one pointer id for all buttons, and
  // Phaser reports every button's release as `pointerup`. A right click while
  // drawing with the left button used to end the drawing early.
  it('ignores the release of another mouse button while drawing', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100, 1));
    session.move(at(200, 100, 1));
    expect(session.end(at(200, 100, 1, false))).toBeUndefined();
    expect(session.isDrawing).toBe(true);

    session.move(at(300, 100, 1, false));
    const result = session.end(at(300, 100, 1, true));
    expect(result?.kind).toBe('completed');
    expect(result?.kind === 'completed' && result.path.at(-1)).toEqual({ x: 300, y: 100 });
  });

  it('ignores the release of another mouse button before the drawing has started', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100, 1));
    expect(session.end(at(100, 100, 1, false))).toBeUndefined();
    expect(session.isPressed).toBe(true);
  });

  it('can start a new drawing after finishing one', () => {
    const session = new DrawingSession(ARENA, options);
    stroke(session, [100, 100], [300, 100]);
    expect(session.begin(at(50, 50, 3))).toBe(true);
  });
});

describe('DrawingSession — cancel', () => {
  it('discards the drawing in progress', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    session.move(at(200, 100));
    expect(session.cancel()).toBe(true);
    expect(session.isDrawing).toBe(false);
    expect(session.previewPath).toEqual([]);
    expect(session.end(at(300, 100))).toBeUndefined();
  });

  it('returns false when nothing was being drawn', () => {
    expect(new DrawingSession(ARENA, options).cancel()).toBe(false);
  });

  it('discards a press that has not started drawing, returning false', () => {
    const session = new DrawingSession(ARENA, options);
    session.begin(at(100, 100));
    expect(session.cancel()).toBe(false);
    expect(session.isPressed).toBe(false);
    expect(session.end(at(300, 100))).toBeUndefined();
  });
});

describe('DrawingSession — options', () => {
  it('rejects negative or NaN options', () => {
    for (const bad of [
      { ...options, minLength: -1 },
      { ...options, sampleSpacing: Number.NaN },
      { ...options, simplifyTolerance: -0.1 },
      { ...options, startDistance: -1 },
    ]) {
      expect(() => new DrawingSession(ARENA, bad)).toThrow(RangeError);
    }
  });
});

describe('screen input to arena path', () => {
  it('draws the same arena path at different screen scales', () => {
    const results = [0.5, 1, 2.5].map((scale) => {
      const transform = { offsetX: 30, offsetY: 10, scale };
      const toScreen = (x: number, y: number) => ({ x: 30 + x * scale, y: 10 + y * scale });
      const session = new DrawingSession(ARENA, options);
      const input = (x: number, y: number): PointerInput => ({
        pointerId: 1,
        isPrimary: true,
        position: screenToArena(toScreen(x, y), transform),
      });
      session.begin(input(100, 100));
      session.move(input(200, 150));
      return expectCompleted(session.end(input(300, 100))).path;
    });

    for (const path of results) {
      expect(path).toHaveLength(3);
      path.forEach((point, index) => {
        const reference = results[0]?.[index];
        expect(point.x).toBeCloseTo(reference?.x ?? Number.NaN, 9);
        expect(point.y).toBeCloseTo(reference?.y ?? Number.NaN, 9);
      });
    }
  });
});
