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

/** Number of HUD fields (captured, remaining, time, score, fouls). */
export const HUD_FIELD_COUNT = 5;

/**
 * How a scoreboard card arranges its label and value: label above a large
 * value in the top bar, label and value side by side in the narrow side column.
 */
export type HudCardStyle = 'stacked' | 'inline';

export interface HudLayout {
  readonly placement: HudPlacement;
  readonly rect: Rect;
  /** Left-middle anchor of the title. */
  readonly title: Vec2;
  /** One scoreboard card per HUD field, in display order. Cards never overlap. */
  readonly cards: readonly Rect[];
  readonly cardStyle: HudCardStyle;
  /** Restart button (a pill), at least `MIN_TOUCH_TARGET` CSS pixels tall. */
  readonly restart: Rect;
  readonly titleFontSize: number;
  readonly labelFontSize: number;
  readonly valueFontSize: number;
  readonly buttonFontSize: number;
  /** Corner radius of the cards. */
  readonly cornerRadius: number;
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

/** Smallest height of a button, in CSS pixels, so it is easy to tap (REQUIREMENTS §5.6, §7.3). */
export const MIN_TOUCH_TARGET = 40;

// Layout metrics in CSS pixels, on an 8-pixel grid, so the HUD stays readable at any pixel density.
const PADDING = 8;
const GAP = 8;
/** Room reserved for the title in the top bar. */
const TITLE_WIDTH = 208;
const CARD_HEIGHT = 48;
const CARD_MIN_WIDTH = 96;
const CARD_MAX_WIDTH = 136;
const BUTTON_WIDTH = 128;
const BUTTON_HEIGHT = MIN_TOUCH_TARGET;
/** Header row above the cards when they do not fit next to the title. */
const HEADER_HEIGHT = PADDING + BUTTON_HEIGHT;
const SIDE_WIDTH = 184;
const SIDE_TITLE_HEIGHT = 32;
const SIDE_CARD_HEIGHT = 34;
const SIDE_CARD_GAP = 6;
const SIDE_CARDS_HEIGHT = HUD_FIELD_COUNT * SIDE_CARD_HEIGHT + (HUD_FIELD_COUNT - 1) * SIDE_CARD_GAP;
const SIDE_MIN_HEIGHT = PADDING + SIDE_TITLE_HEIGHT + GAP + SIDE_CARDS_HEIGHT + GAP + BUTTON_HEIGHT + PADDING;
const CORNER_RADIUS = 8;
/** Narrowest viewport where the title, all cards and the button fit in one bar. */
const SINGLE_ROW_MIN_WIDTH =
  PADDING + TITLE_WIDTH + GAP + HUD_FIELD_COUNT * CARD_MIN_WIDTH + (HUD_FIELD_COUNT + 1) * GAP + BUTTON_WIDTH + PADDING;

/**
 * Lays out the HUD and the arena for a viewport (REQUIREMENTS §5.1, §5.3, §7.2):
 *
 * - The arena keeps its aspect ratio and is scaled as large as possible.
 * - The HUD goes on top, or in a side column when that leaves a larger arena
 *   (typically landscape phones). It never overlaps the arena.
 * - On top, the title, the five scoreboard cards and the restart button share
 *   one bar when they fit. Otherwise a header holds the title and the button,
 *   and the cards wrap into rows below it.
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
  const width = viewport.width;

  let cards: Rect[];
  let hudHeight: number;
  let barCenterY: number;
  if (width >= SINGLE_ROW_MIN_WIDTH) {
    // One bar: title | cards, centered in the space between | button.
    const left = PADDING + TITLE_WIDTH + GAP;
    const right = width - PADDING - BUTTON_WIDTH - GAP;
    cards = cardRow(left, right, PADDING, HUD_FIELD_COUNT, CARD_MAX_WIDTH);
    hudHeight = PADDING + CARD_HEIGHT + PADDING;
    barCenterY = PADDING + CARD_HEIGHT / 2;
  } else {
    const fit = Math.floor((width - 2 * PADDING + GAP) / (CARD_MIN_WIDTH + GAP));
    const columns = Math.max(1, Math.min(HUD_FIELD_COUNT, fit));
    const rows = Math.ceil(HUD_FIELD_COUNT / columns);
    // Every row uses the full row's card width, so the cards line up in columns.
    const cardWidth = Math.min(CARD_MAX_WIDTH, (width - 2 * PADDING - (columns - 1) * GAP) / columns);
    cards = [];
    for (let row = 0; row < rows; row++) {
      const count = Math.min(columns, HUD_FIELD_COUNT - row * columns);
      const y = HEADER_HEIGHT + GAP + row * (CARD_HEIGHT + GAP);
      cards.push(...cardRow(PADDING, width - PADDING, y, count, cardWidth));
    }
    hudHeight = HEADER_HEIGHT + GAP + rows * CARD_HEIGHT + (rows - 1) * GAP + PADDING;
    barCenterY = PADDING + BUTTON_HEIGHT / 2;
  }

  const restart = {
    x: width - PADDING - BUTTON_WIDTH,
    y: barCenterY - BUTTON_HEIGHT / 2,
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
  };
  const hud: HudLayout = {
    placement: 'top',
    rect: scaleRect({ x: 0, y: 0, width, height: hudHeight }, r),
    title: { x: PADDING * r, y: barCenterY * r },
    cards: cards.map((card) => scaleRect(card, r)),
    cardStyle: 'stacked',
    restart: scaleRect(restart, r),
    titleFontSize: 20 * r,
    labelFontSize: 10 * r,
    valueFontSize: 19 * r,
    buttonFontSize: 14 * r,
    cornerRadius: CORNER_RADIUS * r,
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
  const innerWidth = SIDE_WIDTH - 2 * PADDING;
  const cardsTop = PADDING + SIDE_TITLE_HEIGHT + GAP;
  const cards: Rect[] = [];
  for (let i = 0; i < HUD_FIELD_COUNT; i++) {
    const y = cardsTop + i * (SIDE_CARD_HEIGHT + SIDE_CARD_GAP);
    cards.push({ x: PADDING, y, width: innerWidth, height: SIDE_CARD_HEIGHT });
  }
  const restart = { x: PADDING, y: cardsTop + SIDE_CARDS_HEIGHT + GAP, width: innerWidth, height: BUTTON_HEIGHT };

  const hud: HudLayout = {
    placement: 'side',
    rect: scaleRect({ x: 0, y: 0, width: SIDE_WIDTH, height: viewport.height }, r),
    title: { x: PADDING * r, y: (PADDING + SIDE_TITLE_HEIGHT / 2) * r },
    cards: cards.map((card) => scaleRect(card, r)),
    cardStyle: 'inline',
    restart: scaleRect(restart, r),
    titleFontSize: 16 * r,
    labelFontSize: 10 * r,
    valueFontSize: 15 * r,
    buttonFontSize: 14 * r,
    cornerRadius: CORNER_RADIUS * r,
  };

  const area = {
    x: SIDE_WIDTH,
    y: PADDING,
    width: viewport.width - SIDE_WIDTH - PADDING,
    height: viewport.height - 2 * PADDING,
  };
  return assemble(viewport, arena, hud, area);
}

/** `count` cards of up to `maxWidth`, evenly spaced and centered between `left` and `right`. */
function cardRow(left: number, right: number, y: number, count: number, maxWidth: number): Rect[] {
  const available = right - left;
  const cardWidth = Math.min(maxWidth, (available - (count - 1) * GAP) / count);
  const rowWidth = count * cardWidth + (count - 1) * GAP;
  const start = left + (available - rowWidth) / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: start + i * (cardWidth + GAP),
    y,
    width: cardWidth,
    height: CARD_HEIGHT,
  }));
}

function scaleRect(rect: Rect, r: number): Rect {
  return { x: rect.x * r, y: rect.y * r, width: rect.width * r, height: rect.height * r };
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
