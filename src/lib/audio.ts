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
/** Rolls off the buzz of a raw sawtooth into something closer to a string. */
const BODY_HZ = 2600;

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
): OscillatorNode[] {
  const oscillator = ctx.createOscillator();
  const body = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(frequency, startedAt);

  body.type = 'lowpass';
  // Track the note: high notes need the filter open further or they go dull.
  body.frequency.setValueAtTime(Math.max(BODY_HZ, frequency * 4), startedAt);
  body.Q.setValueAtTime(0.7, startedAt);

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

  lfo.start(startedAt);
  lfo.stop(startedAt + durationSeconds);
  oscillator.start(startedAt);
  oscillator.stop(startedAt + durationSeconds);

  return [oscillator, lfo];
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
): OscillatorNode[] {
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
): OscillatorNode[] {
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
): OscillatorNode[] {
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
