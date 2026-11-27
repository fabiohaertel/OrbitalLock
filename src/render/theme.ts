/**
 * Colors and sizes shared by the renderer and UI. Colors are 0xRRGGBB, or CSS
 * strings where a canvas or text style needs them; line widths are CSS pixels.
 */
export const THEME = {
  background: 0x0b0e17,
  /** Soccer-field mowing stripes (REQUIREMENTS §5.4). */
  fieldLight: 0x3f9142,
  fieldDark: 0x357c38,
  /** Field markings: faint, so they never look like walls. */
  fieldMarking: 0xffffff,
  fieldMarkingAlpha: 0.22,
  fieldMarkingWidth: 1.5,
  arenaBorder: 0x3a4a6b,
  arenaBorderWidth: 2,
  /**
   * Walls are freshly painted chalk lines (REQUIREMENTS §5.4): an opaque white
   * core over a soft halo, with a thin shadow on the grass. Far stronger than
   * the faint field markings.
   */
  wall: 0xf4f6f2,
  wallWidth: 3.5,
  wallHaloWidth: 8,
  wallHaloAlpha: 0.22,
  wallShadow: 0x0b1a0d,
  wallShadowAlpha: 0.3,
  wallShadowOffset: 1.5,
  /** Bright spot at the front of the paint while a new wall is painted. */
  paintGlow: 0xffffff,
  paintGlowRadius: 6,
  /**
   * The drawing in progress is a dashed chalk line whose dashes march towards
   * the pulsing tip, like a line-marking machine (REQUIREMENTS §5.4). Lengths
   * in CSS pixels, speed in CSS pixels per second, pulse in Hz.
   */
  preview: 0xf4f6f2,
  previewWidth: 3,
  previewHaloWidth: 8,
  previewHaloAlpha: 0.18,
  previewDash: 10,
  previewGap: 7,
  previewDashSpeed: 40,
  previewTipRadius: 4.5,
  previewTipPulseHz: 3,
  /** A ball close to the drawing heats it from chalk white through orange to the failure red. */
  previewWarm: 0xffa94d,
  /** Above this danger level the dashes march and the tip pulses faster. */
  previewAlarmDanger: 0.6,
  previewAlarmSpeedup: 2.2,
  /** Gold ring where the drawing would attach if released now (D1). */
  snapHint: 0xffd166,
  snapHintRadius: 9,
  snapHintWidth: 2,
  snapHintFillAlpha: 0.25,
  failure: 0xff4d5e,
  failureWidth: 4,
  /**
   * Captured regions are drawn as a goal net over a shadowed backdrop
   * (REQUIREMENTS §5.4): a medium-dark green, darker than the field stripes
   * but not near-black.
   */
  netBackdrop: 0x2a5a2f,
  netCord: 0xf4f6f2,
  netCordAlpha: 0.7,
  netCordWidth: 1.25,
  /** Soccer ball (REQUIREMENTS §5.4). Seam width is a fraction of the ball radius. */
  ballLeather: 0xf7f7f4,
  ballPatch: 0x16181c,
  ballSeam: 0x1e2024,
  ballSeamAlpha: 0.6,
  ballSeamWidthRatio: 1 / 24,
  ballOutline: 'rgba(10, 12, 16, 0.75)',
  /** Motion-blur trail behind moving balls. */
  ballTrail: 0xdde1e6,
  /** Tint that dims captured balls. */
  orbCaptured: 0x7a8499,
  /**
   * Interface (REQUIREMENTS §5.3, §5.6): a stadium-scoreboard look. Text
   * colors are CSS strings for Phaser Text; fills are 0xRRGGBB.
   */
  text: '#e6ecff',
  textMuted: '#8fa0c8',
  /** Scoreboard cards: dark navy panels with a thin border. */
  cardFill: 0x111a2e,
  cardFillAlpha: 0.92,
  cardBorder: 0x2c3d63,
  /** Accent color of each card's value. */
  accentCaptured: '#7ee08a',
  accentScore: '#ffd166',
  accentNeutral: '#f2f5ff',
  /** Foul pips: used fouls are filled; the card glows red when the next foul loses. */
  foulUsed: 0xff5d6c,
  foulFree: 0x5a6d99,
  danger: 0xff5d6c,
  dangerText: '#ff5d6c',
  /** Primary (pill) buttons. */
  buttonFill: 0xffd166,
  buttonFillHover: 0xffe39f,
  buttonText: '#1a1405',
  buttonShadow: 0x000000,
  victory: '#ffd166',
  defeat: '#ff5d6c',
  overlay: 0x05070d,
  overlayAlpha: 0.7,
  /** The bundled Orbitron UI font, with system fonts as fallback. */
  fontFamily: 'Orbitron, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

/** Blends two 0xRRGGBB colors: `t` = 0 gives `from`, 1 gives `to` (clamped). */
export function mixColor(from: number, to: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const channel = (shift: number) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * k);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Multiplies two 0xRRGGBB colors channel by channel, like a tint. */
export function multiplyColor(color: number, tint: number): number {
  const channel = (shift: number) => Math.round((((color >> shift) & 0xff) * ((tint >> shift) & 0xff)) / 255);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
