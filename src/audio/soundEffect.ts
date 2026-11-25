import Phaser from 'phaser';

export interface SoundEffectOptions {
  /** Unique audio cache key. */
  readonly key: string;
  /** Produces the mono samples for the given sample rate. */
  readonly synthesize: (sampleRate: number) => Float32Array;
  /** Playback volume, 0..1. */
  readonly volume: number;
  /**
   * Skip playback while the browser still blocks audio. Use it for sounds the
   * game makes on its own (collisions): queued, they would all play late and at
   * once when the player first interacts. Leave it off for sounds that answer
   * the player's input (misses): the input itself unlocks audio, and Phaser only
   * notices that a frame later, so skipping would drop the first one.
   */
  readonly skipWhileLocked: boolean;
}

/**
 * A short synthesized sound effect (REQUIREMENTS §5.5). The samples are
 * generated at startup into a Web Audio buffer and played through Phaser's
 * sound manager, which handles the browser's autoplay unlock.
 *
 * Without Web Audio (HTML5 or no-audio managers) it stays silent, and the game
 * is unaffected.
 */
export class SoundEffect {
  private readonly sound: Phaser.Sound.BaseSoundManager;
  private readonly options: SoundEffectOptions;
  private readonly available: boolean;
  private played = 0;

  constructor(scene: Phaser.Scene, options: SoundEffectOptions) {
    this.sound = scene.sound;
    this.options = options;
    this.available = registerBuffer(scene, options);
  }

  /** Number of times this sound was started, for tests. */
  get playedCount(): number {
    return this.played;
  }

  play(): void {
    if (!this.available) return;
    if (this.options.skipWhileLocked && this.sound.locked) return;
    if (this.sound.play(this.options.key, { volume: this.options.volume })) this.played++;
  }
}

/** Adds the sound to the audio cache as a decoded buffer. Returns false without Web Audio. */
function registerBuffer(scene: Phaser.Scene, options: SoundEffectOptions): boolean {
  if (!(scene.sound instanceof Phaser.Sound.WebAudioSoundManager)) return false;
  const cache = scene.cache.audio;
  if (cache.exists(options.key)) return true;

  const context = scene.sound.context;
  const samples = options.synthesize(context.sampleRate);
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  cache.add(options.key, buffer);
  return true;
}
