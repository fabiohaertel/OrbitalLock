import Phaser from 'phaser';
import type { ArenaDimensions } from '../config/gameConfig';
import { clipPolygonToXRange, polygonArea, type Polygon } from '../geometry/polygon';
import { polylineLength } from '../geometry/polyline';
import type { Region } from '../geometry/regions';
import type { Segment } from '../geometry/segment';
import type { Vec2 } from '../geometry/vector';
import type { ArenaTransform } from '../layout/arenaTransform';
import type { Orb } from '../physics/orb';
import type { Wall } from '../drawing/wall';
import { BallMotion } from './ballMotion';
import { dashSegments, slicePath } from './dashedPath';
import { previewDanger } from './drawingHints';
import type { FailurePiece } from './failureFlash';
import { netCords } from './goalNet';
import { projectBallPatches, soccerBallSphere, type SpherePatch } from './soccerBall';
import { BALL_LEATHER_RADIUS_RATIO, ensureBallShadingTexture } from './soccerBallTexture';
import { fieldMarkings, fieldStripes, type FieldMarking, type FieldStripe } from './soccerField';
import { mixColor, multiplyColor, THEME } from './theme';

/** Points per patch edge for rolling balls: smooth at on-screen ball sizes, cheap to project every frame. */
const BALL_POINTS_PER_EDGE = 4;

/** Everything the renderer draws in one frame, read from the game world. */
export interface WorldView {
  readonly orbs: readonly Orb[];
  readonly walls: readonly Wall[];
  readonly capturedRegions: readonly Region[];
  readonly previewPath: readonly Vec2[];
  /** Where the drawing in progress would attach if released now (D1). */
  readonly snapHints: readonly Vec2[];
  /** Pieces of a failed drawing breaking apart. */
  readonly failurePieces: readonly FailurePiece[];
  /** How much of each wall is painted, 0..1; new walls are painted from start to end. */
  readonly wallPaint: (wall: Wall) => number;
  /** Animation clock in seconds: drives the marching dashes and pulses, never the game. */
  readonly time: number;
}

/**
 * Draws the soccer-field arena, captured regions as goal nets, walls, orbs as
 * soccer balls, the chalk-line drawing preview with its snap and danger
 * hints, and the failed line breaking apart (REQUIREMENTS §5.4, §8.5).
 *
 * Three layers, bottom to top, all positioned and scaled by the arena transform
 * so everything is drawn in arena coordinates:
 * 1. field, captured-region backdrops and chalk-line walls (Graphics);
 * 2. balls (Container): motion-blur trails beneath all balls, then each
 *    ball's leather and rolling patches (Graphics), then one fixed shading
 *    image per ball, so the light does not turn as the ball rolls;
 * 3. net cords over captured regions, so captured balls sit behind the net;
 *    then the drawing preview, snap hints, failure pieces and arena
 *    border (Graphics).
 *
 * It only reads game state; it never changes it. Ball rolling and trails are
 * derived from how orb positions change between frames (`BallMotion`); the
 * marching dashes and pulses from the view's animation clock.
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
  /** Animation state: clock of the last frame, dash march (CSS pixels), pulse phase and current danger. */
  private lastTime = 0;
  private marchCssPixels = 0;
  private pulsePhase = 0;
  private danger = 0;

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

    this.advanceAnimation(view);
    this.drawWalls(view.walls, view.wallPaint);

    this.drawBalls(view.orbs);

    const f = this.foreground;
    f.clear();
    this.drawNets(view.capturedRegions);
    this.drawPreview(view.previewPath, view.snapHints);

    for (const piece of view.failurePieces) {
      if (piece.points.length < 2 || piece.alpha <= 0) continue;
      f.lineStyle(this.width(THEME.failureWidth), THEME.failure, piece.alpha);
      strokePath(f, piece.points);
    }

    f.lineStyle(this.width(THEME.arenaBorderWidth), THEME.arenaBorder, 1);
    f.strokeRect(0, 0, this.arena.width, this.arena.height);
  }

  /**
   * Advances the marching dashes and the pulse from the animation clock. They
   * speed up while a ball threatens the drawing; integrating the speed (rather
   * than multiplying the clock) keeps them from jumping when it changes.
   */
  private advanceAnimation(view: WorldView): void {
    const dt = Math.max(0, Math.min(0.25, view.time - this.lastTime));
    this.lastTime = view.time;
    this.danger = view.previewPath.length >= 2 ? previewDanger(view.previewPath, view.orbs) : 0;
    const speedup = this.danger >= THEME.previewAlarmDanger ? THEME.previewAlarmSpeedup : 1;
    this.marchCssPixels += THEME.previewDashSpeed * speedup * dt;
    this.pulsePhase += 2 * Math.PI * THEME.previewTipPulseHz * speedup * dt;
  }

  /** 0..1, rising and falling with the tip and snap-hint pulse. */
  private get pulse(): number {
    return 0.5 + 0.5 * Math.sin(this.pulsePhase);
  }

  /**
   * Walls as freshly painted chalk lines (REQUIREMENTS §5.4): a thin shadow,
   * a soft halo and an opaque core. A new wall is painted from its start to
   * its end; the unpainted rest is still dashed, with a glow at the paint front.
   */
  private drawWalls(walls: readonly Wall[], paint: (wall: Wall) => number): void {
    const g = this.background;
    const painted = walls.map((wall) => {
      const progress = paint(wall);
      if (progress >= 1) return { wall, solid: wall.path, rest: [] as Vec2[], length: 0, progress };
      const length = polylineLength(wall.path);
      const front = length * Math.max(0, progress);
      return { wall, solid: slicePath(wall.path, 0, front), rest: slicePath(wall.path, front, length), length, progress };
    });

    const shadow = this.width(THEME.wallShadowOffset);
    g.lineStyle(this.width(THEME.wallWidth), THEME.wallShadow, THEME.wallShadowAlpha);
    for (const { solid } of painted) strokePath(g, solid.map((p) => ({ x: p.x + shadow, y: p.y + shadow })));
    g.lineStyle(this.width(THEME.wallHaloWidth), THEME.wall, THEME.wallHaloAlpha);
    for (const { solid } of painted) strokePath(g, solid);
    g.lineStyle(this.width(THEME.wallWidth), THEME.wall, 1);
    for (const { solid } of painted) strokePath(g, solid);

    for (const { rest, solid, length, progress } of painted) {
      if (progress >= 1 || length <= 0) continue;
      g.lineStyle(this.width(THEME.previewWidth), THEME.preview, 1);
      for (const dash of this.dashes(rest)) strokePath(g, dash);
      const front = solid.at(-1) ?? rest[0];
      if (front !== undefined) {
        g.fillStyle(THEME.paintGlow, 0.85);
        g.fillCircle(front.x, front.y, this.width(THEME.paintGlowRadius));
      }
    }
  }

  /** The marching dashes of a chalk line, sized in CSS pixels so they look the same at any scale. */
  private dashes(path: readonly Vec2[]): Vec2[][] {
    return dashSegments(
      path,
      this.width(THEME.previewDash),
      this.width(THEME.previewGap),
      this.width(this.marchCssPixels),
    );
  }

  /**
   * The drawing in progress (REQUIREMENTS §5.4): a dashed chalk line marching
   * towards a pulsing tip, heating from white through orange to red as an
   * active ball gets close, and a gold ring where it would attach (D1).
   */
  private drawPreview(path: readonly Vec2[], snapHints: readonly Vec2[]): void {
    if (path.length < 2) return;
    const f = this.foreground;
    const danger = this.danger;
    const color =
      danger < 0.5
        ? mixColor(THEME.preview, THEME.previewWarm, danger * 2)
        : mixColor(THEME.previewWarm, THEME.failure, (danger - 0.5) * 2);
    const pulse = this.pulse;

    f.lineStyle(this.width(THEME.previewHaloWidth), color, THEME.previewHaloAlpha);
    strokePath(f, path);
    f.lineStyle(this.width(THEME.previewWidth), color, 1);
    for (const dash of this.dashes(path)) strokePath(f, dash);

    const tip = path.at(-1) as Vec2;
    f.fillStyle(color, 0.6 + 0.4 * pulse);
    f.fillCircle(tip.x, tip.y, this.width(THEME.previewTipRadius) * (0.85 + 0.35 * pulse));

    const ring = this.width(THEME.snapHintRadius) * (1 + 0.15 * pulse);
    for (const hint of snapHints) {
      f.fillStyle(THEME.snapHint, THEME.snapHintFillAlpha);
      f.fillCircle(hint.x, hint.y, ring);
      f.lineStyle(this.width(THEME.snapHintWidth), THEME.snapHint, 1);
      f.strokeCircle(hint.x, hint.y, ring);
    }
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
