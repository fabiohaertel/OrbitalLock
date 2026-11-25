import type Phaser from 'phaser';
import { THEME } from './theme';

export const BALL_SHADING_TEXTURE = 'soccer-ball-shading';

/** Texture size in pixels: sharp up to roughly 64 px on-screen balls at 2× pixel density. */
const TEXTURE_SIZE = 128;

/**
 * Radius of the ball's leather inside the outline, as a fraction of the orb
 * radius. The renderer draws the rolling patches within this radius and the
 * shading texture's outline around it.
 */
export const BALL_LEATHER_RADIUS_RATIO = 1 - 1 / 48;

/**
 * Creates the ball shading texture once per game (REQUIREMENTS §5.4): shading
 * towards the rim, a highlight lit from the top left, and the dark outline,
 * transparent elsewhere. It is drawn over the rolling patches without turning,
 * so the light stays fixed while the ball rolls. The texture spans the ball
 * edge to edge, so an image drawn at the orb's diameter matches its collision
 * radius.
 */
export function ensureBallShadingTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(BALL_SHADING_TEXTURE)) return BALL_SHADING_TEXTURE;
  const texture = scene.textures.createCanvas(BALL_SHADING_TEXTURE, TEXTURE_SIZE, TEXTURE_SIZE);
  if (texture === null) return BALL_SHADING_TEXTURE;
  paintShading(texture.getContext(), TEXTURE_SIZE);
  texture.refresh();
  return BALL_SHADING_TEXTURE;
}

function paintShading(ctx: CanvasRenderingContext2D, size: number): void {
  const radius = size / 2;
  const outlineWidth = size / 48;
  const r = radius * BALL_LEATHER_RADIUS_RATIO;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, r, 0, Math.PI * 2);
  ctx.clip();

  // Shade towards the rim, lit from the top left.
  const shade = ctx.createRadialGradient(radius * 0.7, radius * 0.65, r * 0.1, radius, radius, r);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);

  const highlight = ctx.createRadialGradient(radius * 0.62, radius * 0.55, 0, radius * 0.62, radius * 0.55, r * 0.5);
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(radius, radius, r, 0, Math.PI * 2);
  ctx.lineWidth = outlineWidth;
  ctx.strokeStyle = THEME.ballOutline;
  ctx.stroke();
}
