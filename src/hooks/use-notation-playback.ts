import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContext, scheduleTone, type Voice } from '../lib/audio';
import type { Line } from '../lib/composition';
import { frequencyOf } from '../lib/notes';
import { beatAt, beatSeconds, buildSchedule, tokenAtBeat } from '../lib/playback';

export interface NotationPlayback {
  isPlaying: boolean;
  /** Index of the token being played, across the whole piece. */
  token: number | null;
  play: () => void;
  stop: () => void;
}

/** Leaves a little air between notes so repeated pitches are separable. */
const GAP_SECONDS = 0.06;
/** A moment before the first note, so the start is not clipped. */
const LEAD_IN = 0.08;
/**
 * Cutting a phrase off mid-note has to be a quick fade rather than an instant
 * mute, or the waveform is chopped part-way through a cycle and the speakers
 * click.
 */
const CUT_SECONDS = 0.04;

/**
 * Play a written page.
 *
 * The whole phrase is scheduled up front against the AudioContext clock, which
 * keeps it in time regardless of what the main thread is doing. The highlight
 * is then driven from that same clock, so what you see matches what you hear.
 */
export function useNotationPlayback(
  lines: Line[],
  tonic: number,
  bpm: number,
  volume: number,
  voice: Voice = 'violin',
): NotationPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [token, setToken] = useState<number | null>(null);

  const frameRef = useRef<number | null>(null);
  /**
   * Silences whatever `play` scheduled. The whole phrase goes onto the audio
   * clock up front, so nothing the React side does can call it back — without
   * this, stopping cleared the highlight while the piece played on to the end.
   */
  const silenceRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    silenceRef.current?.();
    silenceRef.current = null;
    setToken(null);
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const schedule = buildSchedule(lines, tonic);
    const { totalBeats } = schedule;
    if (totalBeats === 0) return;

    const perBeat = beatSeconds(bpm);
    const startedAt = ctx.currentTime + LEAD_IN;

    // Everything plays through one bus, so stopping is one fade rather than a
    // hunt through however many notes are still in flight.
    const bus = ctx.createGain();
    bus.connect(ctx.destination);

    const sources: AudioScheduledSourceNode[] = [];

    for (const item of schedule.placed) {
      if (item.midi === null) continue;

      sources.push(
        ...scheduleTone(
          frequencyOf(item.midi),
          startedAt + item.startBeat * perBeat,
          Math.max(item.beats * perBeat - GAP_SECONDS, 0.04),
          volume,
          voice,
          bus,
        ),
      );
    }

    silenceRef.current = () => {
      const now = ctx.currentTime;

      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + CUT_SECONDS);

      // Faded out, then actually stopped: a silent oscillator is still an
      // oscillator, and a long piece would leave dozens of them running.
      for (const source of sources) {
        try {
          source.stop(now + CUT_SECONDS);
        } catch {
          // Already stopped, which is exactly what we wanted anyway.
        }
      }
    };

    setIsPlaying(true);

    const follow = () => {
      const current = beatAt(ctx.currentTime - startedAt, bpm, totalBeats);

      if (current === null && ctx.currentTime > startedAt) {
        stop();
        return;
      }

      setToken(tokenAtBeat(schedule, current));
      frameRef.current = requestAnimationFrame(follow);
    };

    frameRef.current = requestAnimationFrame(follow);
  }, [lines, tonic, bpm, volume, voice, stop]);

  useEffect(() => stop, [stop]);

  return { isPlaying, token, play, stop };
}
