import { createSeededRandom } from '../physics/random';

/** Shape of the synthesized referee whistle (REQUIREMENTS §5.5). */
export interface WhistleSoundOptions {
  /** Total length of the single blow, in seconds. */
  readonly durationSeconds: number;
  /** Main pitch of the whistle, in Hz. */
  readonly frequency: number;
  /**
   * Rate of the trill, in Hz: the pea inside a referee's whistle spins and
   * flutters the tone, which gives it its rattling sound.
   */
  readonly trillRate: number;
  /** Pitch wobble from the trill, as a fraction of `frequency`. */
  readonly trillPitchDepth: number;
  /** Loudness wobble from the trill, 0..1. */
  readonly trillLevelDepth: number;
  /** Level of the breath noise relative to the tone, 0..1. */
  readonly breathLevel: number;
  /** Rise and fall times of the blow, in seconds. */
  readonly attackSeconds: number;
  readonly releaseSeconds: number;
  /** Peak sample amplitude after normalization, in (0, 1]. */
  readonly peak: number;
}

export const REFEREE_WHISTLE: WhistleSoundOptions = Object.freeze({
  durationSeconds: 0.42,
  frequency: 2900,
  trillRate: 32,
  trillPitchDepth: 0.025,
  trillLevelDepth: 0.35,
  breathLevel: 0.08,
  attackSeconds: 0.02,
  releaseSeconds: 0.06,
  peak: 0.9,
});

/** Playback volume for the miss whistle (0..1). A whistle is piercing, so it is kept moderate. */
export const MISS_WHISTLE_VOLUME = 0.25;

/** The blow starts slightly flat and settles on pitch, like a whistle catching breath. */
const PITCH_SETTLE_SECONDS = 0.04;
const PITCH_START_RATIO = 0.93;
/** Weight of the second harmonic, for a less pure, more whistle-like timbre. */
const SECOND_HARMONIC = 0.18;
/** Fixed seed: the breath noise is the same on every run. */
const NOISE_SEED = 0x5157;

/**
 * Synthesizes a single blow of a referee's pea whistle as mono samples in
 * [-1, 1]: a high tone fluttered by the trill, a little breath noise, and a
 * smooth rise and fall so playback never clicks. Deterministic: same inputs,
 * same samples.
 */
export function synthesizeWhistle(
  sampleRate: number,
  options: WhistleSoundOptions = REFEREE_WHISTLE,
): Float32Array {
  const length = Math.max(1, Math.round(options.durationSeconds * sampleRate));
  const samples = new Float32Array(length);
  const random = createSeededRandom(NOISE_SEED);

  let phase = 0;
  let previousNoise = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const trill = Math.sin(2 * Math.PI * options.trillRate * t);
    const settle = PITCH_START_RATIO + (1 - PITCH_START_RATIO) * Math.min(1, t / PITCH_SETTLE_SECONDS);
    const frequency = options.frequency * settle * (1 + options.trillPitchDepth * trill);
    phase += (2 * Math.PI * frequency) / sampleRate;

    const tone = (Math.sin(phase) + SECOND_HARMONIC * Math.sin(2 * phase)) * (1 - options.trillLevelDepth * (0.5 - 0.5 * trill));
    // First difference of white noise: a hiss tilted towards high frequencies, like breath.
    const noise = random() * 2 - 1;
    const breath = (noise - previousNoise) * 0.5 * options.breathLevel;
    previousNoise = noise;

    const value = (tone + breath) * envelope(t, options);
    samples[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }

  if (peak > 0) {
    const gain = options.peak / peak;
    for (let i = 0; i < length; i++) samples[i] = (samples[i] as number) * gain;
  }
  return samples;
}

/** Smooth (raised-cosine) rise and fall, flat in between: one continuous blow. */
function envelope(t: number, options: WhistleSoundOptions): number {
  const rise = Math.min(1, t / options.attackSeconds);
  const fall = Math.min(1, Math.max(0, (options.durationSeconds - t) / options.releaseSeconds));
  return smooth(rise) * smooth(fall);
}

function smooth(x: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
}
