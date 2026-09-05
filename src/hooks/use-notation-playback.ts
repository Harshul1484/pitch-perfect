import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContext, scheduleTone } from '../lib/audio';
import type { Line } from '../lib/composition';
import { frequencyOf } from '../lib/notes';
import { beatAt, beatSeconds, buildSchedule } from '../lib/playback';

export interface NotationPlayback {
  isPlaying: boolean;
  /** Token index currently sounding, which is also the beat number. */
  beat: number | null;
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
): NotationPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);

  const frameRef = useRef<number | null>(null);
  const stopAtRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    stopAtRef.current?.();
    stopAtRef.current = null;
    setBeat(null);
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const { events, totalBeats } = buildSchedule(lines, tonic);
    if (totalBeats === 0) return;

    const perBeat = beatSeconds(bpm);
    const startedAt = ctx.currentTime + LEAD_IN;

    for (const event of events) {
      scheduleTone(
        frequencyOf(event.midi),
        startedAt + event.tokenIndex * perBeat,
        Math.max(event.beats * perBeat - GAP_SECONDS, 0.05),
        volume,
      );
    }

    setIsPlaying(true);

    const follow = () => {
      const current = beatAt(ctx.currentTime - startedAt, bpm, totalBeats);

      if (current === null && ctx.currentTime > startedAt) {
        stop();
        return;
      }

      setBeat(current);
      frameRef.current = requestAnimationFrame(follow);
    };

    frameRef.current = requestAnimationFrame(follow);
  }, [lines, tonic, bpm, volume, stop]);

  useEffect(() => stop, [stop]);

  return { isPlaying, beat, play, stop };
}
