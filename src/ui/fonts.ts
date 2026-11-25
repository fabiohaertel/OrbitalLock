import orbitronBoldUrl from '../assets/fonts/orbitron-latin-800-normal.woff2?url';
import orbitronMediumUrl from '../assets/fonts/orbitron-latin-500-normal.woff2?url';

/** Family name of the bundled UI font (Orbitron, SIL Open Font License; see `src/assets/fonts/OFL.txt`). */
export const UI_FONT_FAMILY = 'Orbitron';

/** Longest wait for the UI font before starting with the fallback font instead. */
const FONT_LOAD_TIMEOUT_MS = 3000;

/**
 * Loads the bundled UI font (weights 500 and 800) so Phaser Text objects are
 * measured and drawn with it from their first frame: canvas text does not
 * re-render when a web font arrives later. The font ships with the game (no
 * CDN), so it also works offline and inside itch.io's iframe.
 *
 * Never rejects: if loading fails or takes too long, the game starts with
 * the fallback system font.
 */
export async function loadUiFonts(): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
  const faces = [
    new FontFace(UI_FONT_FAMILY, `url(${orbitronMediumUrl}) format('woff2')`, { weight: '500' }),
    new FontFace(UI_FONT_FAMILY, `url(${orbitronBoldUrl}) format('woff2')`, { weight: '800' }),
  ];
  const loading = Promise.all(
    faces.map(async (face) => {
      document.fonts.add(await face.load());
    }),
  ).then(
    () => undefined,
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS));
  await Promise.race([loading, timeout]);
}
