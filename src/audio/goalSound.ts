import { createSeededRandom, type RandomSource } from '../physics/random';

/** One resonance of the vowel the crowd shouts ("ahhh"). */
export interface Formant {
  /** Centre frequency, in Hz. */
  readonly frequency: number;
  /** Sharpness of the resonance: higher is narrower. */
  readonly q: number;
  /** Loudness of this resonance relative to the others. */
  readonly gain: number;
}

/** Shape of the synthesized goal sound played on a capture: a stadium crowd cheering (REQUIREMENTS §5.5). */
export interface GoalSoundOptions {
  /** Total length, in seconds (at most 2). */
  readonly durationSeconds: number;
  /** The cheer swells up over this many seconds... */
  readonly attackSeconds: number;
  /** ...and dies away over the last this many seconds, ending in silence. */
  readonly releaseSeconds: number;
  /** Number of shouting voices mixed together. */
  readonly voices: number;
  /** Range of the voices' fundamental pitch, in Hz. */
  readonly lowestPitch: number;
  readonly highestPitch: number;
  /** Voices join over this many seconds, not all at once. */
  readonly entrySpreadSeconds: number;
  /** Resonances that turn the voices into an open "ah" vowel. */
  readonly formants: readonly Formant[];
  /** Breathy noise mixed into the voices, relative to one voice, giving the roar of a big crowd. */
  readonly noiseLevel: number;
  /** Echoes of the stadium stands: delay in seconds and level relative to the dry sound. */
  readonly echoes: readonly { readonly seconds: number; readonly level: number }[];
  /** Peak sample amplitude after normalization, in (0, 1]. */
  readonly peak: number;
}

/** A crowd of voices shouting "ahhh": swells, holds, then fades, in under two seconds. */
export const GOAL_SOUND: GoalSoundOptions = Object.freeze({
  durationSeconds: 1.8,
  attackSeconds: 0.3,
  releaseSeconds: 0.7,
  voices: 40,
  lowestPitch: 110,
  highestPitch: 290,
  entrySpreadSeconds: 0.25,
  formants: Object.freeze([
    Object.freeze({ frequency: 750, q: 5, gain: 1 }),
    Object.freeze({ frequency: 1150, q: 6, gain: 0.6 }),
    Object.freeze({ frequency: 2500, q: 8, gain: 0.25 }),
  ]),
  noiseLevel: 6,
  echoes: Object.freeze([
    Object.freeze({ seconds: 0.037, level: 0.35 }),
    Object.freeze({ seconds: 0.061, level: 0.25 }),
    Object.freeze({ seconds: 0.089, level: 0.15 }),
  ]),
  peak: 0.9,
});

/** Playback volume for the goal sound (0..1). Moderate, like the other sound effects (§5.5). */
export const GOAL_SOUND_VOLUME = 0.3;

/** How long one voice takes to reach full strength after it joins. */
const VOICE_ATTACK_SECONDS = 0.12;
/** Each voice starts this much flat and slides up to its pitch as it shouts: "aaAH". */
const PITCH_RISE = 0.08;
/** ...and sags by this much as the cheer dies away. */
const PITCH_SAG = 0.06;
/** Fixed seed: the crowd is the same on every run. */
const CROWD_SEED = 0x60a1;

/** Total length of the goal sound, in seconds. */
export function goalSoundDuration(options: GoalSoundOptions = GOAL_SOUND): number {
  return options.durationSeconds;
}

/**
 * Synthesizes the goal sound as mono samples in [-1, 1] (REQUIREMENTS §5.5): a
 * stadium crowd shouting "ahhh". Many voices, each a buzzing source with its
 * own pitch, wobble and entry time, plus breathy noise, are shaped into an "ah"
 * vowel by a bank of resonant filters, given a few echoes from the stands, and
 * swelled in and faded out to silence. Deterministic: same inputs, same samples.
 */
export function synthesizeGoal(sampleRate: number, options: GoalSoundOptions = GOAL_SOUND): Float32Array {
  const length = Math.max(1, Math.round(options.durationSeconds * sampleRate));
  const random = createSeededRandom(CROWD_SEED);
  const source = new Float32Array(length);
  for (let v = 0; v < options.voices; v++) addVoice(source, sampleRate, options, random);
  addNoise(source, options.noiseLevel, random);

  const vowel = applyFormants(source, sampleRate, options.formants);
  const samples = addEchoes(vowel, sampleRate, options.echoes);
  applyEnvelope(samples, sampleRate, options);

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0) {
    const gain = options.peak / peak;
    for (let i = 0; i < length; i++) samples[i] = (samples[i] as number) * gain;
  }
  return samples;
}

/** One shouting voice: a sawtooth buzz with its own pitch contour, joining the crowd a little late. */
function addVoice(source: Float32Array, sampleRate: number, options: GoalSoundOptions, random: RandomSource): void {
  const pitch = options.lowestPitch + (options.highestPitch - options.lowestPitch) * random() ** 1.5;
  const level = 0.5 + 0.5 * random();
  const entry = Math.round(random() * options.entrySpreadSeconds * sampleRate);
  const vibratoRate = 4 + 3 * random();
  const vibratoDepth = 0.01 + 0.015 * random();
  const driftRate = 0.4 + 1.2 * random();
  const driftDepth = 0.02 * random();
  const vibratoPhase = 2 * Math.PI * random();
  const driftPhase = 2 * Math.PI * random();
  const releaseStart = options.durationSeconds - options.releaseSeconds;
  let phase = random();
  for (let i = entry; i < source.length; i++) {
    const t = i / sampleRate;
    const sinceEntry = (i - entry) / sampleRate;
    const rise = 1 - PITCH_RISE * (1 - Math.min(1, sinceEntry / options.attackSeconds));
    const sag = 1 - PITCH_SAG * Math.max(0, (t - releaseStart) / options.releaseSeconds);
    const wobble =
      1 +
      vibratoDepth * Math.sin(2 * Math.PI * vibratoRate * t + vibratoPhase) +
      driftDepth * Math.sin(2 * Math.PI * driftRate * t + driftPhase);
    phase += (pitch * rise * sag * wobble) / sampleRate;
    phase -= Math.floor(phase);
    const fadeIn = Math.min(1, sinceEntry / VOICE_ATTACK_SECONDS);
    source[i] = (source[i] as number) + (2 * phase - 1) * level * fadeIn;
  }
}

/** Breathy white noise under the voices: the hiss of thousands of people shouting at once. */
function addNoise(source: Float32Array, level: number, random: RandomSource): void {
  for (let i = 0; i < source.length; i++) source[i] = (source[i] as number) + (random() * 2 - 1) * level;
}

/** Parallel bank of band-pass resonators (RBJ biquads, 0 dB peak) that shape the source into an "ah". */
function applyFormants(source: Float32Array, sampleRate: number, formants: readonly Formant[]): Float32Array {
  const out = new Float32Array(source.length);
  for (const formant of formants) {
    const w0 = (2 * Math.PI * formant.frequency) / sampleRate;
    const alpha = Math.sin(w0) / (2 * formant.q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - alpha) / a0;
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < source.length; i++) {
      const x = source[i] as number;
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[i] = (out[i] as number) + y * formant.gain;
    }
  }
  return out;
}

/** Adds delayed copies of the sound, like its echo off the stands. */
function addEchoes(
  dry: Float32Array,
  sampleRate: number,
  echoes: GoalSoundOptions['echoes'],
): Float32Array {
  const out = Float32Array.from(dry);
  for (const echo of echoes) {
    const delay = Math.round(echo.seconds * sampleRate);
    for (let i = delay; i < out.length; i++) out[i] = (out[i] as number) + (dry[i - delay] as number) * echo.level;
  }
  return out;
}

/** Smooth swell in, hold, and fade to exactly zero at the end, so playback never clicks. */
function applyEnvelope(samples: Float32Array, sampleRate: number, options: GoalSoundOptions): void {
  const last = samples.length - 1;
  for (let i = 0; i <= last; i++) {
    const t = i / sampleRate;
    const attack = smoothstep(Math.min(1, t / options.attackSeconds));
    const remaining = last > 0 ? (last - i) / last : 0;
    const release = Math.min(1, (remaining * options.durationSeconds) / options.releaseSeconds) ** 2;
    samples[i] = (samples[i] as number) * attack * release;
  }
}

function smoothstep(x: number): number {
  return x * x * (3 - 2 * x);
}
