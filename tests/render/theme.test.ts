import { describe, expect, it } from 'vitest';
import { multiplyColor, THEME } from '../../src/render/theme';

describe('multiplyColor (dims captured balls, REQUIREMENTS §5.4)', () => {
  it('multiplies each channel like a tint', () => {
    expect(multiplyColor(0xffffff, 0x7a8499)).toBe(0x7a8499);
    expect(multiplyColor(0x000000, 0x7a8499)).toBe(0x000000);
    expect(multiplyColor(0x808080, 0xff0000)).toBe(0x800000);
    expect(multiplyColor(0x123456, 0xffffff)).toBe(0x123456);
  });
});

/** Perceived brightness of a 0xRRGGBB color (Rec. 709 weights), 0-255. */
function luminance(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('goal-net backdrop (REQUIREMENTS §5.4)', () => {
  it('is darker than the field stripes, so captured regions stand out', () => {
    expect(luminance(THEME.netBackdrop)).toBeLessThan(luminance(THEME.fieldDark));
  });

  it('is not near-black: lighter than the original very dark backdrop', () => {
    expect(luminance(THEME.netBackdrop)).toBeGreaterThan(luminance(0x1c3320) * 1.5);
  });

  it('is still dark enough for the white net cords to contrast with it', () => {
    expect(luminance(THEME.netCord) - luminance(THEME.netBackdrop)).toBeGreaterThan(120);
  });

  it('is still a green', () => {
    const g = (THEME.netBackdrop >> 8) & 0xff;
    expect(g).toBeGreaterThan(((THEME.netBackdrop >> 16) & 0xff) * 1.5);
    expect(g).toBeGreaterThan((THEME.netBackdrop & 0xff) * 1.5);
  });
});

/** WCAG relative luminance of a 0xRRGGBB color, 0-1. */
function relativeLuminance(color: number): number {
  const linear = (shift: number) => {
    const c = ((color >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(16) + 0.7152 * linear(8) + 0.0722 * linear(0);
}

/** WCAG contrast ratio between two colors, 1-21. */
function contrast(a: number | string, b: number | string): number {
  const value = (c: number | string) => (typeof c === 'string' ? Number.parseInt(c.slice(1), 16) : c);
  const [l1, l2] = [relativeLuminance(value(a)), relativeLuminance(value(b))].sort((x, y) => y - x);
  return ((l1 ?? 0) + 0.05) / ((l2 ?? 0) + 0.05);
}

describe('interface colors (REQUIREMENTS §5.6)', () => {
  it('uses the bundled Orbitron font with a system fallback', () => {
    expect(THEME.fontFamily.startsWith('Orbitron,')).toBe(true);
    expect(THEME.fontFamily).toContain('sans-serif');
  });

  it.each([
    ['card label', THEME.textMuted],
    ['captured value', THEME.accentCaptured],
    ['score value', THEME.accentScore],
    ['neutral value', THEME.accentNeutral],
    ['danger label', THEME.dangerText],
  ])('makes the %s readable on a card (contrast ≥ 4.5)', (_name, color) => {
    expect(contrast(color, THEME.cardFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('makes button labels readable on the button, idle and hovered (contrast ≥ 4.5)', () => {
    expect(contrast(THEME.buttonText, THEME.buttonFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(THEME.buttonText, THEME.buttonFillHover)).toBeGreaterThanOrEqual(4.5);
  });

  it('makes used and free foul pips distinguishable from the card', () => {
    expect(contrast(THEME.foulUsed, THEME.cardFill)).toBeGreaterThanOrEqual(3);
    expect(contrast(THEME.foulFree, THEME.cardFill)).toBeGreaterThanOrEqual(2);
  });
});
