/**
 * Tone playback via the Web Audio API. No audio files, no dependencies.
 *
 * The AudioContext is created lazily because browsers refuse to start one
 * outside a user gesture, and is reused across every note.
 */

let context: AudioContext | null = null;

/**
 * The one AudioContext for the whole app. Shared with the metronome, because
 * browsers cap how many a page may open.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return null;
  }

  context ??= new window.AudioContext();
  return context;
}

export const DEFAULT_DURATION = 1.4;

/** Which instrument the app sounds notes with. */
export type Voice = 'violin' | 'piano';

export const VOICES: Voice[] = ['violin', 'piano'];

export interface PlayOptions {
  durationSeconds?: number;
  /** 0 to 1, scaling the peak gain. */
  volume?: number;
  voice?: Voice;
}

/** exponentialRampToValueAtTime cannot reach zero, so decay to near-silence. */
const SILENCE = 0.0001;

const PIANO_PEAK = 0.28;
const PIANO_ATTACK = 0.015;

const VIOLIN_PEAK = 0.2;
/** The bow takes hold rather than starting instantly. */
const VIOLIN_ATTACK = 0.09;
const VIOLIN_RELEASE = 0.14;
/** Vibrato: rate in Hz and depth in cents, and how long before it comes in. */
const VIBRATO_HZ = 5.5;
const VIBRATO_CENTS = 11;
const VIBRATO_DELAY = 0.18;
/** The low-pass is deliberately open: a violin keeps its upper harmonics. */
const BODY_HZ = 4800;
const CHORUS_CENTS = -4;
const BOW_NOISE_PEAK = 0.014;

type SoundSource = AudioScheduledSourceNode;

/**
 * A compact harmonic profile measured in partials rather than a raw sawtooth.
 * The third through sixth partials stay present, which supplies the bright,
 * woody quality that makes a bowed string recognisable at a small volume.
 */
function violinWave(ctx: BaseAudioContext): PeriodicWave {
  const real = new Float32Array(13);
  const imaginary = new Float32Array([
    0,
    1,
    0.72,
    0.74,
    0.48,
    0.36,
    0.28,
    0.21,
    0.16,
    0.12,
    0.09,
    0.06,
    0.04,
  ]);
  return ctx.createPeriodicWave(real, imaginary, { disableNormalization: false });
}

/** A repeatable, soft bow-noise buffer: texture without random test output. */
function bowNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 0x1a2b3c4d;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    samples[index] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

/**
 * A bowed string.
 *
 * A sawtooth is the classic starting point, because bowing is a stick-slip
 * motion and produces a sawtooth-like waveform. On its own it buzzes, so it
 * goes through a lowpass to give it a body, gets a slow attack rather than a
 * struck one, and carries a little delayed vibrato — which is what most
 * separates a bowed note from a synthesised one.
 */
function bowed(
  ctx: BaseAudioContext,
  destination: AudioNode,
  frequency: number,
  startedAt: number,
  durationSeconds: number,
  volume: number,
): SoundSource[] {
  const oscillator = ctx.createOscillator();
  const chorus = ctx.createOscillator();
  const body = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  oscillator.setPeriodicWave(violinWave(ctx));
  oscillator.frequency.setValueAtTime(frequency, startedAt);
  chorus.type = 'triangle';
  chorus.frequency.setValueAtTime(frequency, startedAt);
  chorus.detune.setValueAtTime(CHORUS_CENTS, startedAt);

  body.type = 'lowpass';
  // Track the note: high notes need the filter open further or they go dull.
  body.frequency.setValueAtTime(Math.max(BODY_HZ, frequency * 6), startedAt);
  body.Q.setValueAtTime(0.45, startedAt);

  const attack = Math.min(VIOLIN_ATTACK, durationSeconds * 0.4);
  const release = Math.min(VIOLIN_RELEASE, durationSeconds * 0.4);
  const peak = VIOLIN_PEAK * volume;

  // A linear attack, not an exponential one. Exponential from near-silence is
  // very concave: it stays almost inaudible for most of the attack and then
  // jumps, which reads as a struck note rather than a bowed one.
  gain.gain.setValueAtTime(0, startedAt);
  gain.gain.linearRampToValueAtTime(peak, startedAt + attack);
  // Hold roughly level while the bow travels, then ease off.
  gain.gain.setValueAtTime(peak, startedAt + durationSeconds - release);
  gain.gain.exponentialRampToValueAtTime(SILENCE, startedAt + durationSeconds);

  oscillator.connect(body);
  const chorusGain = ctx.createGain();
  chorusGain.gain.setValueAtTime(0.16, startedAt);
  chorus.connect(chorusGain);
  chorusGain.connect(body);
  body.connect(gain);
  gain.connect(destination);

  // Vibrato, easing in so short notes stay straight.
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.setValueAtTime(VIBRATO_HZ, startedAt);
  depth.gain.setValueAtTime(0, startedAt);
  depth.gain.linearRampToValueAtTime(
    VIBRATO_CENTS,
    startedAt + Math.min(VIBRATO_DELAY + 0.2, durationSeconds),
  );
  lfo.connect(depth);
  depth.connect(oscillator.detune);
  depth.connect(chorus.detune);

  // A quiet, filtered bow trace is felt more than heard. It avoids the sterile
  // pure-tone quality while remaining far below the pitched string.
  const noise = ctx.createBufferSource();
  const noiseFilter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  noise.buffer = bowNoise(ctx, durationSeconds);
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(Math.min(Math.max(frequency * 1.2, 500), 3200), startedAt);
  noiseFilter.Q.setValueAtTime(0.9, startedAt);
  noiseGain.gain.setValueAtTime(0, startedAt);
  noiseGain.gain.linearRampToValueAtTime(BOW_NOISE_PEAK * volume, startedAt + attack);
  noiseGain.gain.setValueAtTime(BOW_NOISE_PEAK * volume * 0.4, startedAt + attack + 0.08);
  noiseGain.gain.exponentialRampToValueAtTime(SILENCE, startedAt + durationSeconds);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(destination);

  lfo.start(startedAt);
  lfo.stop(startedAt + durationSeconds);
  oscillator.start(startedAt);
  oscillator.stop(startedAt + durationSeconds);
  chorus.start(startedAt);
  chorus.stop(startedAt + durationSeconds);
  noise.start(startedAt);
  noise.stop(startedAt + durationSeconds);

  return [oscillator, chorus, lfo, noise];
}

/**
 * A struck string: an immediate attack and a decay that runs the whole length,
 * with no sustain. Triangle rather than sine, which gets shrill in the top
 * octaves of an 88-key range.
 */
function struck(
  ctx: BaseAudioContext,
  destination: AudioNode,
  frequency: number,
  startedAt: number,
  durationSeconds: number,
  volume: number,
): SoundSource[] {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, startedAt);

  gain.gain.setValueAtTime(SILENCE, startedAt);
  gain.gain.exponentialRampToValueAtTime(PIANO_PEAK * volume, startedAt + PIANO_ATTACK);
  gain.gain.exponentialRampToValueAtTime(SILENCE, startedAt + durationSeconds);

  oscillator.connect(gain);
  gain.connect(destination);

  oscillator.start(startedAt);
  oscillator.stop(startedAt + durationSeconds);

  return [oscillator];
}

/**
 * Sound a tone at a given AudioContext time. Notation playback schedules a
 * whole phrase ahead of time, so it needs to say when each note starts rather
 * than only being able to play one now.
 */
export function scheduleTone(
  frequency: number,
  startedAt: number,
  durationSeconds: number,
  volume: number,
  voice: Voice = 'violin',
  /** Where to play into. Defaults to the speakers. */
  destination?: AudioNode,
): SoundSource[] {
  const ctx = getAudioContext();
  if (!ctx || volume <= 0) return [];

  return buildVoice(
    ctx,
    destination ?? ctx.destination,
    voice,
    frequency,
    startedAt,
    durationSeconds,
    volume,
  );
}

/**
 * Build one note into a given context and destination.
 *
 * Exported so the voices can be rendered into an OfflineAudioContext and
 * measured. Timbre is otherwise only checkable by ear, which no test can do.
 */
export function buildVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  voice: Voice,
  frequency: number,
  startedAt: number,
  durationSeconds: number,
  volume: number,
): SoundSource[] {
  return voice === 'piano'
    ? struck(ctx, destination, frequency, startedAt, durationSeconds, volume)
    : bowed(ctx, destination, frequency, startedAt, durationSeconds, volume);
}

/** Sound a tone immediately. */
export function playFrequency(frequency: number, options: PlayOptions = {}): boolean {
  const { durationSeconds = DEFAULT_DURATION, volume = 1, voice = 'violin' } = options;

  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') void ctx.resume();

  return scheduleTone(frequency, ctx.currentTime, durationSeconds, volume, voice).length > 0;
}
