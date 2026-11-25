import type { ArenaDimensions } from '../config/gameConfig';
import type { Rect } from '../geometry/rect';
import type { Vec2 } from '../geometry/vector';
import type { ArenaTransform } from './arenaTransform';

/** Space available to the game. */
export interface Viewport {
  /** CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Canvas pixels per CSS pixel (device pixel ratio, possibly capped). */
  readonly pixelRatio: number;
}

/** Where the HUD sits relative to the arena (REQUIREMENTS §11.1, D6). */
export type HudPlacement = 'top' | 'side';

/** Number of HUD fields (captured, remaining, time, score, misses). */
export const HUD_FIELD_COUNT = 5;

export interface HudLayout {
  readonly placement: HudPlacement;
  readonly rect: Rect;
  /** Left-middle anchor of the title. */
  readonly title: Vec2;
  /** Left-middle anchor of each HUD field, in display order. */
  readonly fields: readonly Vec2[];
  /** Center of the restart button. */
  readonly restart: Vec2;
  readonly titleFontSize: number;
  readonly fieldFontSize: number;
  readonly buttonFontSize: number;
}

/** Full screen layout. All coordinates and sizes are in canvas pixels. */
export interface ScreenLayout {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly pixelRatio: number;
  readonly hud: HudLayout;
  /** Arena placement: uniform scale keeps its proportions (D6). */
  readonly arena: ArenaTransform;
  /** The arena's rectangle on the canvas. */
  readonly arenaRect: Rect;
}

// Layout metrics in CSS pixels, so the HUD stays readable at any pixel density.
const PADDING = 8;
const TOP_HEADER_HEIGHT = 40;
const FIELD_ROW_HEIGHT = 24;
const FIELD_COLUMN_WIDTH = 132;
const SIDE_WIDTH = 176;
const SIDE_FIELDS_TOP = 64;
const SIDE_MIN_HEIGHT = SIDE_FIELDS_TOP + HUD_FIELD_COUNT * FIELD_ROW_HEIGHT + 56;
const RESTART_HALF_WIDTH = 46;
const TITLE_FONT = 18;
const FIELD_FONT = 15;
const BUTTON_FONT = 18;

/**
 * Lays out the HUD and the arena for a viewport (REQUIREMENTS §5.1, §7.2):
 *
 * - The arena keeps its aspect ratio and is scaled as large as possible.
 * - The HUD goes on top, or in a side column when that leaves a larger arena
 *   (typically landscape phones). It never overlaps the arena.
 * - Everything fits inside the viewport, so there is no scrolling.
 */
export function computeLayout(viewport: Viewport, arena: ArenaDimensions): ScreenLayout {
  const top = topLayout(viewport, arena);
  if (viewport.height < SIDE_MIN_HEIGHT) return top;
  const side = sideLayout(viewport, arena);
  return side.arena.scale > top.arena.scale ? side : top;
}

function topLayout(viewport: Viewport, arena: ArenaDimensions): ScreenLayout {
  const r = viewport.pixelRatio;
  const columns = Math.max(1, Math.floor((viewport.width - 2 * PADDING) / FIELD_COLUMN_WIDTH));
  const rows = Math.ceil(HUD_FIELD_COUNT / columns);
  const hudHeight = TOP_HEADER_HEIGHT + rows * FIELD_ROW_HEIGHT + PADDING;

  const fields: Vec2[] = [];
  for (let i = 0; i < HUD_FIELD_COUNT; i++) {
    fields.push({
      x: (PADDING + (i % columns) * FIELD_COLUMN_WIDTH) * r,
      y: (TOP_HEADER_HEIGHT + Math.floor(i / columns) * FIELD_ROW_HEIGHT + FIELD_ROW_HEIGHT / 2) * r,
    });
  }

  const hud: HudLayout = {
    placement: 'top',
    rect: { x: 0, y: 0, width: viewport.width * r, height: hudHeight * r },
    title: { x: PADDING * r, y: (TOP_HEADER_HEIGHT / 2) * r },
    fields,
    restart: { x: (viewport.width - PADDING - RESTART_HALF_WIDTH) * r, y: (TOP_HEADER_HEIGHT / 2) * r },
    ...fontSizes(r),
  };

  const area = {
    x: PADDING,
    y: hudHeight,
    width: viewport.width - 2 * PADDING,
    height: viewport.height - hudHeight - PADDING,
  };
  return assemble(viewport, arena, hud, area);
}

function sideLayout(viewport: Viewport, arena: ArenaDimensions): ScreenLayout {
  const r = viewport.pixelRatio;
  const fields: Vec2[] = [];
  for (let i = 0; i < HUD_FIELD_COUNT; i++) {
    fields.push({ x: PADDING * 2 * r, y: (SIDE_FIELDS_TOP + i * FIELD_ROW_HEIGHT) * r });
  }

  const hud: HudLayout = {
    placement: 'side',
    rect: { x: 0, y: 0, width: SIDE_WIDTH * r, height: viewport.height * r },
    title: { x: PADDING * 2 * r, y: (PADDING + 20) * r },
    fields,
    restart: {
      x: (PADDING * 2 + RESTART_HALF_WIDTH) * r,
      y: (SIDE_FIELDS_TOP + HUD_FIELD_COUNT * FIELD_ROW_HEIGHT + 24) * r,
    },
    ...fontSizes(r),
  };

  const area = {
    x: SIDE_WIDTH,
    y: PADDING,
    width: viewport.width - SIDE_WIDTH - PADDING,
    height: viewport.height - 2 * PADDING,
  };
  return assemble(viewport, arena, hud, area);
}

function fontSizes(r: number): Pick<HudLayout, 'titleFontSize' | 'fieldFontSize' | 'buttonFontSize'> {
  return { titleFontSize: TITLE_FONT * r, fieldFontSize: FIELD_FONT * r, buttonFontSize: BUTTON_FONT * r };
}

/** Centers the largest arena that fits in `area` (CSS pixels) and converts to canvas pixels. */
function assemble(viewport: Viewport, arena: ArenaDimensions, hud: HudLayout, area: Rect): ScreenLayout {
  const r = viewport.pixelRatio;
  const cssScale = Math.max(0, Math.min(area.width / arena.width, area.height / arena.height));
  const width = arena.width * cssScale;
  const height = arena.height * cssScale;
  const x = area.x + (area.width - width) / 2;
  const y = area.y + (area.height - height) / 2;

  return {
    canvasWidth: viewport.width * r,
    canvasHeight: viewport.height * r,
    pixelRatio: r,
    hud,
    arena: { offsetX: x * r, offsetY: y * r, scale: cssScale * r },
    arenaRect: { x: x * r, y: y * r, width: width * r, height: height * r },
  };
}
