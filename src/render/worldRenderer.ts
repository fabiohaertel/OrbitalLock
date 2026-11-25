import Phaser from 'phaser';
import type { ArenaDimensions } from '../config/gameConfig';
import { clipPolygonToXRange, polygonArea, type Polygon } from '../geometry/polygon';
import type { Region } from '../geometry/regions';
import type { Segment } from '../geometry/segment';
import type { Vec2 } from '../geometry/vector';
import type { ArenaTransform } from '../layout/arenaTransform';
import type { Orb } from '../physics/orb';
import type { Wall } from '../drawing/wall';
import { BallMotion } from './ballMotion';
import { netCords } from './goalNet';
import { projectBallPatches, soccerBallSphere, type SpherePatch } from './soccerBall';
import { BALL_LEATHER_RADIUS_RATIO, ensureBallShadingTexture } from './soccerBallTexture';
import { fieldMarkings, fieldStripes, type FieldMarking, type FieldStripe } from './soccerField';
import { multiplyColor, THEME } from './theme';

/** Points per patch edge for rolling balls: smooth at on-screen ball sizes, cheap to project every frame. */
const BALL_POINTS_PER_EDGE = 4;

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
 * Draws the soccer-field arena, captured regions as goal nets, walls, orbs as
 * soccer balls, the drawing preview and the failure flash (REQUIREMENTS §5.4,
 * §8.5).
 *
 * Three layers, bottom to top, all positioned and scaled by the arena transform
 * so everything is drawn in arena coordinates:
 * 1. field, captured-region backdrops and walls (Graphics);
 * 2. balls (Container): motion-blur trails beneath all balls, then each
 *    ball's leather and rolling patches (Graphics), then one fixed shading
 *    image per ball, so the light does not turn as the ball rolls;
 * 3. net cords over captured regions, so captured balls sit behind the net;
 *    then the drawing preview, failure flash and arena border (Graphics).
 *
 * It only reads game state; it never changes it. Ball rolling and trails are
 * derived from how orb positions change between frames (`BallMotion`).
 */
export class WorldRenderer {
  private readonly scene: Phaser.Scene;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly ballLayer: Phaser.GameObjects.Container;
  private readonly foreground: Phaser.GameObjects.Graphics;
  private readonly trailGraphics: Phaser.GameObjects.Graphics;
  private readonly ballGraphics: Phaser.GameObjects.Graphics;
  private readonly shadings: Phaser.GameObjects.Image[] = [];
  private readonly shadingTexture: string;
  /** Ball patches on the sphere, computed once and projected per frame at each ball's orientation. */
  private readonly ballSphere: readonly SpherePatch[] = soccerBallSphere(BALL_POINTS_PER_EDGE);
  /** How far each ball has rolled, and its trail (REQUIREMENTS §5.4). */
  readonly ballMotion = new BallMotion();
  private readonly arena: ArenaDimensions;
  private readonly stripes: readonly FieldStripe[];
  private readonly markings: readonly FieldMarking[];
  /** Net cords per captured region. Regions never change once captured, so they are computed once. */
  private readonly netCache = new WeakMap<Region, readonly Segment[]>();
  /** Arena units per CSS pixel, so lines keep a constant on-screen width at any scale. */
  private unitsPerCssPixel = 1;

  constructor(scene: Phaser.Scene, arena: ArenaDimensions, transform: ArenaTransform, pixelRatio: number) {
    this.scene = scene;
    this.arena = arena;
    this.stripes = fieldStripes(arena);
    this.markings = fieldMarkings(arena);
    this.shadingTexture = ensureBallShadingTexture(scene);
    this.background = scene.add.graphics();
    this.ballLayer = scene.add.container();
    this.trailGraphics = scene.add.graphics();
    this.ballGraphics = scene.add.graphics();
    this.ballLayer.add([this.trailGraphics, this.ballGraphics]);
    this.foreground = scene.add.graphics();
    this.setTransform(transform, pixelRatio);
  }

  /** Re-applies the arena placement after a resize (REQUIREMENTS §5.1). */
  setTransform(transform: ArenaTransform, pixelRatio: number): void {
    for (const layer of [this.background, this.ballLayer, this.foreground]) {
      layer.setPosition(transform.offsetX, transform.offsetY).setScale(transform.scale);
    }
    this.unitsPerCssPixel = pixelRatio / transform.scale;
  }

  private width(cssPixels: number): number {
    return cssPixels * this.unitsPerCssPixel;
  }

  draw(view: WorldView): void {
    const g = this.background;
    g.clear();
    this.drawField();
    this.drawCapturedRegions(view.capturedRegions);

    g.lineStyle(this.width(THEME.wallWidth), THEME.wall, 1);
    for (const wall of view.walls) {
      strokePath(g, wall.path);
    }

    this.drawBalls(view.orbs);

    const f = this.foreground;
    f.clear();
    this.drawNets(view.capturedRegions);

    if (view.previewPath.length >= 2) {
      f.lineStyle(this.width(THEME.previewWidth), THEME.preview, 0.9);
      strokePath(f, view.previewPath);
    }

    if (view.failurePath.length >= 2 && view.failureAlpha > 0) {
      f.lineStyle(this.width(THEME.failureWidth), THEME.failure, view.failureAlpha);
      strokePath(f, view.failurePath);
    }

    f.lineStyle(this.width(THEME.arenaBorderWidth), THEME.arenaBorder, 1);
    f.strokeRect(0, 0, this.arena.width, this.arena.height);
  }

  /** Green mowing stripes plus faint pitch markings (REQUIREMENTS §5.4). */
  private drawField(): void {
    const g = this.background;
    for (const stripe of this.stripes) {
      g.fillStyle(stripeColor(stripe), 1);
      g.fillRect(stripe.x, 0, stripe.width, this.arena.height);
    }

    g.lineStyle(this.width(THEME.fieldMarkingWidth), THEME.fieldMarking, THEME.fieldMarkingAlpha);
    g.fillStyle(THEME.fieldMarking, THEME.fieldMarkingAlpha);
    for (const marking of this.markings) {
      switch (marking.kind) {
        case 'line':
          g.lineBetween(marking.from.x, marking.from.y, marking.to.x, marking.to.y);
          break;
        case 'circle':
          g.strokeCircle(marking.center.x, marking.center.y, marking.radius);
          break;
        case 'arc':
          g.beginPath();
          g.arc(marking.center.x, marking.center.y, marking.radius, marking.start, marking.end);
          g.strokePath();
          break;
        case 'spot':
          g.fillCircle(marking.center.x, marking.center.y, marking.radius);
          break;
      }
    }
  }

  /**
   * Fills captured regions (D4) with the net's shadowed backdrop. Larger
   * regions are drawn first and their holes repainted with the field stripes,
   * so a captured island inside a captured region (drawn later, being smaller)
   * stays visible.
   */
  private drawCapturedRegions(regions: readonly Region[]): void {
    const g = this.background;
    const ordered = [...regions].sort((a, b) => polygonArea(b.outline) - polygonArea(a.outline));
    for (const region of ordered) {
      g.fillStyle(THEME.netBackdrop, 1);
      fillPolygon(g, region.outline);
      for (const hole of region.holes) this.fillWithStripes(hole);
    }
  }

  /** Goal-net cords over captured regions, above the balls so they look trapped (REQUIREMENTS §5.4). */
  private drawNets(regions: readonly Region[]): void {
    if (regions.length === 0) return;
    const f = this.foreground;
    f.lineStyle(this.width(THEME.netCordWidth), THEME.netCord, THEME.netCordAlpha);
    for (const region of regions) {
      let cords = this.netCache.get(region);
      if (cords === undefined) {
        cords = netCords(region);
        this.netCache.set(region, cords);
      }
      for (const cord of cords) f.lineBetween(cord.a.x, cord.a.y, cord.b.x, cord.b.y);
    }
  }

  /** Repaints a polygon with the field stripes it covers (markings are not repainted). */
  private fillWithStripes(polygon: Polygon): void {
    const g = this.background;
    for (const stripe of this.stripes) {
      const piece = clipPolygonToXRange(polygon, stripe.x, stripe.x + stripe.width);
      if (piece.length < 3) continue;
      g.fillStyle(stripeColor(stripe), 1);
      fillPolygon(g, piece);
    }
  }

  /**
   * Draws every ball (REQUIREMENTS §5.4): motion-blur trails first, then each
   * ball rolled to its current orientation with fixed shading on top. Balls
   * match their collision radius; captured balls are dimmed and have no trail.
   */
  private drawBalls(orbs: readonly Orb[]): void {
    this.ballMotion.update(orbs);

    const trail = this.trailGraphics;
    trail.clear();
    for (const orb of orbs) {
      for (const ghost of this.ballMotion.trail(orb)) {
        trail.fillStyle(THEME.ballTrail, ghost.alpha);
        trail.fillCircle(ghost.position.x, ghost.position.y, ghost.radius);
      }
    }

    this.ballGraphics.clear();
    while (this.shadings.length < orbs.length) {
      const shading = this.scene.add.image(0, 0, this.shadingTexture);
      this.ballLayer.add(shading);
      this.shadings.push(shading);
    }
    this.shadings.forEach((shading, index) => {
      const orb = orbs[index];
      if (orb === undefined) {
        shading.setVisible(false);
        return;
      }
      const dimmed = orb.capture !== 'active';
      this.paintBall(orb, dimmed);
      shading
        .setVisible(true)
        .setPosition(orb.position.x, orb.position.y)
        .setDisplaySize(orb.radius * 2, orb.radius * 2);
      if (dimmed) shading.setTint(THEME.orbCaptured);
      else shading.clearTint();
    });
  }

  /** White leather, black pentagons and seams of one ball at its current orientation. */
  private paintBall(orb: Orb, dimmed: boolean): void {
    const g = this.ballGraphics;
    const color = (value: number) => (dimmed ? multiplyColor(value, THEME.orbCaptured) : value);
    const { x: cx, y: cy } = orb.position;
    const r = orb.radius * BALL_LEATHER_RADIUS_RATIO;

    g.fillStyle(color(THEME.ballLeather), 1);
    g.fillCircle(cx, cy, r);
    g.fillStyle(color(THEME.ballPatch), 1);
    g.lineStyle(orb.radius * THEME.ballSeamWidthRatio, color(THEME.ballSeam), THEME.ballSeamAlpha);
    for (const patch of projectBallPatches(this.ballSphere, this.ballMotion.orientation(orb))) {
      const outline = patch.outline.map((p) => ({ x: cx + p.x * r, y: cy + p.y * r }));
      if (patch.kind === 'pentagon') fillPolygon(g, outline);
      strokeClosed(g, outline);
    }
  }
}

function stripeColor(stripe: FieldStripe): number {
  return stripe.shade === 'light' ? THEME.fieldLight : THEME.fieldDark;
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

function strokeClosed(g: Phaser.GameObjects.Graphics, polygon: readonly Vec2[]): void {
  const [first, ...rest] = polygon;
  if (first === undefined) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const point of rest) g.lineTo(point.x, point.y);
  g.closePath();
  g.strokePath();
}
