import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchMatch } from '../lib/notes';
import { summarise, type RecordingSummary, type Sample } from '../lib/recording';

export interface Recorder {
  isRecording: boolean;
  /** Milliseconds elapsed, updated a few times a second while recording. */
  elapsedMs: number;
  /** The finished recording, or null before one exists. */
  summary: RecordingSummary | null;
  start: () => void;
  stop: () => void;
  discard: () => void;
}

/** The clock in the corner ticks; the samples do not need it this often. */
const TICK_MS = 100;

/**
 * Capture what is played, without leaving the tuner.
 *
 * Samples land in a ref rather than in state. The detector reports about
 * sixty times a second, and re-rendering the whole page on each reading to
 * store a number nobody is looking at yet would be wasteful. The summary is
 * computed once, when recording stops.
 */
export function useRecorder(match: PitchMatch | null, tolerance: number): Recorder {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState<RecordingSummary | null>(null);

  const samples = useRef<Sample[]>([]);
  const startedAt = useRef(0);
  const toleranceRef = useRef(tolerance);

  useEffect(() => {
    toleranceRef.current = tolerance;
  }, [tolerance]);

  // Append each reading while recording.
  useEffect(() => {
    if (!isRecording || match === null) return;

    samples.current.push({
      at: performance.now() - startedAt.current,
      midi: match.note.midi,
      cents: match.cents,
    });
  }, [match, isRecording]);

  // The running clock.
  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt.current);
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  const start = useCallback(() => {
    samples.current = [];
    startedAt.current = performance.now();
    setElapsedMs(0);
    setSummary(null);
    setIsRecording(true);
  }, []);

  const stop = useCallback(() => {
    setIsRecording(false);
    const total = performance.now() - startedAt.current;
    setSummary(summarise(samples.current, toleranceRef.current, total));
  }, []);

  const discard = useCallback(() => {
    samples.current = [];
    setSummary(null);
    setElapsedMs(0);
  }, []);

  return { isRecording, elapsedMs, summary, start, stop, discard };
}
