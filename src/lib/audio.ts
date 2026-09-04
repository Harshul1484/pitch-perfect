/**
 * Tone playback via the Web Audio API. No audio files, no dependencies.
 *
 * The AudioContext is created lazily because browsers refuse to start one
 * outside a user gesture, and is reused across every note.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return null;
  }

  context ??= new window.AudioContext();
  return context;
}

export const DEFAULT_DURATION = 1.4;

const PEAK_GAIN = 0.28;
const ATTACK_SECONDS = 0.015;
/** exponentialRampToValueAtTime cannot reach zero, so decay to near-silence. */
const SILENCE = 0.0001;

/**
 * Play a single tone. Returns false when Web Audio is unavailable, which is
 * the case in jsdom and in browsers that block audio entirely.
 */
export function playFrequency(
  frequency: number,
  duration: number = DEFAULT_DURATION,
): boolean {
  const ctx = getContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const startedAt = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  // Triangle reads as a warmer, less piercing tone than a sine across the
  // full 88-key range, where the top octaves get shrill fast.
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, startedAt);

  // A hard start and stop produces an audible click; ramping avoids it.
  gain.gain.setValueAtTime(SILENCE, startedAt);
  gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, startedAt + ATTACK_SECONDS);
  gain.gain.exponentialRampToValueAtTime(SILENCE, startedAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startedAt);
  oscillator.stop(startedAt + duration);

  return true;
}
