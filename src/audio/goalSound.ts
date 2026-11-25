import { createSeededRandom } from '../physics/random';

/** Shape of the synthesized goal sound played on a capture (REQUIREMENTS §5.5). */
export interface GoalSoundOptions {
  /** Length of the net swish that opens the sound, in seconds. */
  readonly swishSeconds: number;
  /**
   * Low-pass cutoff of the swish at its start and end, in Hz. Sweeping it down
   * turns plain noise into the "shhh" of a ball hitting the net.
   */
  readonly swishStartCutoff: number;
  readonly swishEndCutoff: number;
  /** Loudness of the swish relative to the notes, 0..1. */
  readonly swishLevel: number;
  /** Pitches of the rising arpeggio, in Hz, lowest first. */
  readonly notes: readonly number[];
  /** Length of every note but the last, in seconds. */
  readonly noteSeconds: number;
  /** Length of the last note, which rings out and fades, in seconds. */
  readonly lastNoteSeconds: number;
  /** Peak sample amplitude after normalization, in (0, 1]. */
  readonly peak: number;
}

/** Net swish, then a rising C-major arpeggio (C5, E5, G5): "shhh, ta-da-diing". */
export const GOAL_SOUND: GoalSoundOptions = Object.freeze({
  swishSeconds: 0.15,
  swishStartCutoff: 6000,
  swishEndCutoff: 1200,
  swishLevel: 0.6,
  notes: Object.freeze([523.25, 659.25, 783.99]),
  noteSeconds: 0.08,
  lastNoteSeconds: 0.24,
  peak: 0.9,
});

/** Playback volume for the goal sound (0..1). Moderate, like the other sound effects (§5.5). */
export const GOAL_SOUND_VOLUME = 0.3;

const ATTACK_SECONDS = 0.005;
/** Short notes fade out over their last 15 ms, so consecutive notes are articulated, not slurred. */
const NOTE_RELEASE_SECONDS = 0.015;
/** Decay time constant of the ringing last note. */
const LAST_NOTE_DECAY_SECONDS = 0.09;
/** Fixed seed: the swish noise is the same on every run. */
const NOISE_SEED = 0x60a1;

/** Total length of the goal sound, in seconds. */
export function goalSoundDuration(options: GoalSoundOptions = GOAL_SOUND): number {
  return options.swishSeconds + options.noteSeconds * Math.max(0, options.notes.length - 1) + options.lastNoteSeconds;
}

/**
 * Synthesizes the goal sound as mono samples in [-1, 1] (REQUIREMENTS §5.5):
 * a short swish of noise whose low-pass cutoff sweeps down, then a rising
 * arpeggio of soft triangle-wave notes, the last one ringing out. Every part
 * rises and falls smoothly, so playback never clicks. Deterministic: same
 * inputs, same samples.
 */
export function synthesizeGoal(sampleRate: number, options: GoalSoundOptions = GOAL_SOUND): Float32Array {
  const length = Math.max(1, Math.round(goalSoundDuration(options) * sampleRate));
  const samples = new Float32Array(length);
  addSwish(samples, sampleRate, options);
  addArpeggio(samples, sampleRate, options);

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) {
    const gain = options.peak / peak;
    for (let i = 0; i < length; i++) samples[i] = (samples[i] as number) * gain;
  }
  return samples;
}

/** The net swish: low-passed noise with a downward cutoff sweep, fading to silence. */
function addSwish(samples: Float32Array, sampleRate: number, options: GoalSoundOptions): void {
  const random = createSeededRandom(NOISE_SEED);
  const count = Math.min(samples.length, Math.round(options.swishSeconds * sampleRate));
  let filtered = 0;
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    // Exponential sweep, so the fall in pitch sounds even.
    const cutoff = options.swishStartCutoff * (options.swishEndCutoff / options.swishStartCutoff) ** progress;
    const smoothing = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
    filtered += smoothing * (random() * 2 - 1 - filtered);
    const t = i / sampleRate;
    const envelope = Math.min(1, t / ATTACK_SECONDS) * (1 - progress) ** 2;
    samples[i] = (samples[i] as number) + filtered * options.swishLevel * envelope;
  }
}

/** The rising arpeggio after the swish; the last note rings and fades out. */
function addArpeggio(samples: Float32Array, sampleRate: number, options: GoalSoundOptions): void {
  let start = options.swishSeconds;
  options.notes.forEach((frequency, index) => {
    const isLast = index === options.notes.length - 1;
    const seconds = isLast ? options.lastNoteSeconds : options.noteSeconds;
    const first = Math.round(start * sampleRate);
    const count = Math.round(seconds * sampleRate);
    for (let i = 0; i < count && first + i < samples.length; i++) {
      const t = i / sampleRate;
      const tone = triangle(2 * Math.PI * frequency * t);
      const attack = Math.min(1, t / ATTACK_SECONDS);
      const release = Math.min(1, Math.max(0, (seconds - t) / NOTE_RELEASE_SECONDS));
      const decay = isLast ? Math.exp(-t / LAST_NOTE_DECAY_SECONDS) : 1;
      samples[first + i] = (samples[first + i] as number) + tone * attack * release * decay;
    }
    start += seconds;
  });
}

/** Triangle wave in [-1, 1] with the same phase as a sine: soft, like an old game console. */
function triangle(phase: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(phase));
}
