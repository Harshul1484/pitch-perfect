import { useCallback, useEffect, useRef, useState } from 'react';
import type { Line } from '../lib/composition';
import type { PitchMatch } from '../lib/notes';
import { BEATS_PER_BAR } from '../lib/metronome';
import { beatSeconds, buildSchedule } from '../lib/playback';
import { grade, type RunResult } from '../lib/run';
import type { Sample } from '../lib/recording';
import { useMetronome } from './use-metronome';

export interface Run {
  /** True from the count-in until the last beat of the piece. */
  running: boolean;
  /** True during the count-in bar, before anything is being scored. */
  countingIn: boolean;
  /** Which beat of the bar the metronome is on, for the count-in display. */
  beat: number | null;
  /** The last run's score, kept until it is cleared or another run starts. */
  result: RunResult | null;
  start: () => void;
  stop: () => void;
  clear: () => void;
}

/**
 * Playing a written piece in time, and being scored on it.
 *
 * A bar of metronome counts you in first — without it there is no way to know
 * the tempo you are meant to be playing at, and the first note would always be
 * marked late. Readings are timestamped from the end of that count-in, so beat
 * zero of the piece is time zero of the recording.
 *
 * The scoring itself is `grade`: this hook only decides when the run starts,
 * when it ends, and what was heard in between.
 */
export function useRun(
  lines: Line[],
  tonic: number,
  bpm: number,
  tolerance: number,
  match: PitchMatch | null,
): Run {
  const [running, setRunning] = useState(false);
  const [countingIn, setCountingIn] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const metronome = useMetronome(bpm, 1);
  const samples = useRef<Sample[]>([]);
  /** When beat zero of the piece falls, in performance.now() terms. */
  const startsAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  const { stop: stopMetronome } = metronome;

  const stop = useCallback(() => {
    clearTimers();
    stopMetronome();
    setRunning(false);
    setCountingIn(false);
  }, [clearTimers, stopMetronome]);

  // Collect readings while the piece itself is under way. The count-in is
  // deliberately not recorded: nothing is expected of you yet.
  useEffect(() => {
    if (!running || countingIn || match === null) return;

    samples.current.push({
      at: performance.now() - startsAt.current,
      midi: match.note.midi,
      cents: match.cents,
    });
  }, [match, running, countingIn]);

  const start = useCallback(() => {
    const schedule = buildSchedule(lines, tonic);
    if (schedule.totalBeats === 0) return;

    const perBeatMs = beatSeconds(bpm) * 1000;
    const countInMs = BEATS_PER_BAR * perBeatMs;
    const pieceMs = schedule.totalBeats * perBeatMs;

    samples.current = [];
    startsAt.current = performance.now() + countInMs;

    setResult(null);
    setRunning(true);
    setCountingIn(true);
    metronome.start();

    clearTimers();
    timers.current = [
      window.setTimeout(() => setCountingIn(false), countInMs),
      window.setTimeout(() => {
        stopMetronome();
        setRunning(false);
        setResult(grade(schedule, samples.current, bpm, tolerance));
      }, countInMs + pieceMs),
    ];
  }, [lines, tonic, bpm, tolerance, metronome, stopMetronome, clearTimers]);

  const clear = useCallback(() => setResult(null), []);

  useEffect(() => stop, [stop]);

  return { running, countingIn, beat: metronome.beat, result, start, stop, clear };
}
