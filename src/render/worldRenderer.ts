import Phaser from 'phaser';
import type { ArenaDimensions } from '../config/gameConfig';
import { polygonArea, type Polygon } from '../geometry/polygon';
import type { Region } from '../geometry/regions';
import type { Vec2 } from '../geometry/vector';
import type { ArenaTransform } from '../layout/arenaTransform';
import type { Orb } from '../physics/orb';
import type { Wall } from '../drawing/wall';
import { THEME } from './theme';

/** Everything the renderer draws in one frame, read from the game world. */
export interface WorldView {
  readonly orbs: readonly Orb[];
  readonly walls: readonly Wall[];
  readonly capturedRegions: readonly Region[];
  readonly previewPath: readonly Vec2[];
  readonly failurePath: readonly Vec2[];
  readonly failureAlpha: number;
}

/**
 * Draws the arena, captured regions, walls, orbs, the drawing preview and the
 * failure flash (REQUIREMENTS §8.5). Uses one Graphics object positioned and
 * scaled by the arena transform, so all drawing happens in arena coordinates.
 * It only reads game state; it never changes it.
 */
export class WorldRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly arena: ArenaDimensions;
  /** Arena units per CSS pixel, so lines keep a constant on-screen width at any scale. */
  private unitsPerCssPixel = 1;

  constructor(scene: Phaser.Scene, arena: ArenaDimensions, transform: ArenaTransform, pixelRatio: number) {
    this.arena = arena;
    this.graphics = scene.add.graphics();
    this.setTransform(transform, pixelRatio);
  }

  /** Re-applies the arena placement after a resize (REQUIREMENTS §5.1). */
  setTransform(transform: ArenaTransform, pixelRatio: number): void {
    this.graphics.setPosition(transform.offsetX, transform.offsetY).setScale(transform.scale);
    this.unitsPerCssPixel = pixelRatio / transform.scale;
  }

  private width(cssPixels: number): number {
    return cssPixels * this.unitsPerCssPixel;
  }

  draw(view: WorldView): void {
    const g = this.graphics;
    g.clear();

    g.fillStyle(THEME.arena, 1);
    g.fillRect(0, 0, this.arena.width, this.arena.height);

    this.drawCapturedRegions(view.capturedRegions);

    g.lineStyle(this.width(THEME.wallWidth), THEME.wall, 1);
    for (const wall of view.walls) {
      strokePath(g, wall.path);
    }

    for (const orb of view.orbs) {
      g.fillStyle(orb.capture === 'active' ? THEME.orbActive : THEME.orbCaptured, 1);
      g.fillCircle(orb.position.x, orb.position.y, orb.radius);
    }

    if (view.previewPath.length >= 2) {
      g.lineStyle(this.width(THEME.previewWidth), THEME.preview, 0.9);
      strokePath(g, view.previewPath);
    }

    if (view.failurePath.length >= 2 && view.failureAlpha > 0) {
      g.lineStyle(this.width(THEME.failureWidth), THEME.failure, view.failureAlpha);
      strokePath(g, view.failurePath);
    }

    g.lineStyle(this.width(THEME.arenaBorderWidth), THEME.arenaBorder, 1);
    g.strokeRect(0, 0, this.arena.width, this.arena.height);
  }

  /**
   * Fills captured regions as solid space (D4). Larger regions are drawn
   * first and their holes repainted with the arena color, so a captured island
   * inside a captured region (drawn later, being smaller) stays visible.
   */
  private drawCapturedRegions(regions: readonly Region[]): void {
    const g = this.graphics;
    const ordered = [...regions].sort((a, b) => polygonArea(b.outline) - polygonArea(a.outline));
    for (const region of ordered) {
      g.fillStyle(THEME.capturedRegion, 1);
      fillPolygon(g, region.outline);
      g.fillStyle(THEME.arena, 1);
      for (const hole of region.holes) fillPolygon(g, hole);
    }
  }
}

function strokePath(g: Phaser.GameObjects.Graphics, path: readonly Vec2[]): void {
  const [first, ...rest] = path;
  if (first === undefined) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const point of rest) g.lineTo(point.x, point.y);
  g.strokePath();
}

function fillPolygon(g: Phaser.GameObjects.Graphics, polygon: Polygon): void {
  const [first, ...rest] = polygon;
  if (first === undefined) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const point of rest) g.lineTo(point.x, point.y);
  g.closePath();
  g.fillPath();
}
