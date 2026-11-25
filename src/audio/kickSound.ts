import { createSeededRandom } from '../physics/random';

/** Shape of the synthesized soft kick (REQUIREMENTS §5.5). */
export interface KickSoundOptions {
  /** Total length in seconds. */
  readonly durationSeconds: number;
  /** Pitch of the thump at impact and at its end, in Hz (the pitch drops like a struck ball). */
  readonly startFrequency: number;
  readonly endFrequency: number;
  /** Decay time constants in seconds: the low "body" and the short leather "slap". */
  readonly bodyDecaySeconds: number;
  readonly slapDecaySeconds: number;
  /** Loudness of the slap relative to the body, 0..1. Low values keep the kick soft. */
  readonly slapLevel: number;
  /** Cutoff of the low-pass filter on the slap, in Hz. Lower is more muffled. */
  readonly slapCutoff: number;
  /** Peak sample amplitude after normalization, in (0, 1]. */
  readonly peak: number;
}

export const SOFT_KICK: KickSoundOptions = Object.freeze({
  durationSeconds: 0.16,
  startFrequency: 170,
  endFrequency: 70,
  bodyDecaySeconds: 0.035,
  slapDecaySeconds: 0.006,
  slapLevel: 0.3,
  slapCutoff: 1400,
  peak: 0.9,
});

/** Playback volume for the collision sound (0..1). Kept low so the kick is soft (§5.5). */
export const COLLISION_SOUND_VOLUME = 0.3;

const ATTACK_SECONDS = 0.002;
const FADE_OUT_SECONDS = 0.01;
const PITCH_DROP_SECONDS = 0.03;
/** Fixed seed: the noise in the slap is the same on every run. */
const NOISE_SEED = 0x6b1c;

/**
 * Synthesizes a soft kick of a soccer ball as mono samples in [-1, 1]: a
 * low sine "thump" whose pitch drops quickly, plus a short burst of muffled
 * noise for the contact. It rises over 2 ms and fades to silence at the end,
 * so playback never clicks. Deterministic: same inputs, same samples.
 */
export function synthesizeKick(sampleRate: number, options: KickSoundOptions = SOFT_KICK): Float32Array {
  const length = Math.max(1, Math.round(options.durationSeconds * sampleRate));
  const samples = new Float32Array(length);
  const random = createSeededRandom(NOISE_SEED);
  // One-pole low-pass coefficient for the slap.
  const smoothing = 1 - Math.exp((-2 * Math.PI * options.slapCutoff) / sampleRate);

  let phase = 0;
  let noise = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const frequency =
      options.endFrequency + (options.startFrequency - options.endFrequency) * Math.exp(-t / PITCH_DROP_SECONDS);
    phase += (2 * Math.PI * frequency) / sampleRate;
    const body = Math.sin(phase) * Math.exp(-t / options.bodyDecaySeconds);

    noise += smoothing * (random() * 2 - 1 - noise);
    const slap = noise * options.slapLevel * Math.exp(-t / options.slapDecaySeconds);

    const value = (body + slap) * envelope(t, options.durationSeconds);
    samples[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }

  if (peak > 0) {
    const gain = options.peak / peak;
    for (let i = 0; i < length; i++) samples[i] = (samples[i] as number) * gain;
  }
  return samples;
}

/** Linear 2 ms attack and a linear fade to zero over the last 10 ms. */
function envelope(t: number, duration: number): number {
  const attack = Math.min(1, t / ATTACK_SECONDS);
  const release = Math.min(1, Math.max(0, (duration - t) / FADE_OUT_SECONDS));
  return attack * release;
}
