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
  const stopAtRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    stopAtRef.current?.();
    stopAtRef.current = null;
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

    for (const item of schedule.placed) {
      if (item.midi === null) continue;

      scheduleTone(
        frequencyOf(item.midi),
        startedAt + item.startBeat * perBeat,
        Math.max(item.beats * perBeat - GAP_SECONDS, 0.04),
        volume,
        voice,
      );
    }

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
