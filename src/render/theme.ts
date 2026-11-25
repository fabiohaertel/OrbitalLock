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
  wall: 0xe6ecff,
  wallWidth: 3,
  preview: 0x7fd4ff,
  previewWidth: 2,
  failure: 0xff4d5e,
  failureWidth: 4,
  /** Captured regions are drawn as a goal net over a shadowed backdrop (REQUIREMENTS §5.4). */
  netBackdrop: 0x1c3320,
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
  text: '#e6ecff',
  textMuted: '#9aa6c4',
  button: '#ffd166',
  buttonHover: '#ffe39f',
  overlay: 0x05070d,
  overlayAlpha: 0.85,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

/** Multiplies two 0xRRGGBB colors channel by channel, like a tint. */
export function multiplyColor(color: number, tint: number): number {
  const channel = (shift: number) => Math.round((((color >> shift) & 0xff) * ((tint >> shift) & 0xff)) / 255);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
