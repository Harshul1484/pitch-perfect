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

export interface PlayOptions {
  durationSeconds?: number;
  /** 0 to 1, scaling the peak gain. */
  volume?: number;
}

const PEAK_GAIN = 0.28;
const ATTACK_SECONDS = 0.015;
/** exponentialRampToValueAtTime cannot reach zero, so decay to near-silence. */
const SILENCE = 0.0001;

/**
 * Play a single tone. Returns false when Web Audio is unavailable, which is
 * the case in jsdom and in browsers that block audio entirely.
 */
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
): boolean {
  const ctx = getAudioContext();
  if (!ctx || volume <= 0) return false;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  // Triangle reads as a warmer, less piercing tone than a sine across the
  // full 88-key range, where the top octaves get shrill fast.
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, startedAt);

  // A hard start and stop produces an audible click; ramping avoids it.
  gain.gain.setValueAtTime(SILENCE, startedAt);
  gain.gain.exponentialRampToValueAtTime(PEAK_GAIN * volume, startedAt + ATTACK_SECONDS);
  gain.gain.exponentialRampToValueAtTime(SILENCE, startedAt + durationSeconds);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startedAt);
  oscillator.stop(startedAt + durationSeconds);

  return true;
}

/** Sound a tone immediately. */
export function playFrequency(frequency: number, options: PlayOptions = {}): boolean {
  const { durationSeconds = DEFAULT_DURATION, volume = 1 } = options;

  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') void ctx.resume();

  return scheduleTone(frequency, ctx.currentTime, durationSeconds, volume);
}
