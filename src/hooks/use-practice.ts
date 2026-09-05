import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchMatch } from '../lib/notes';
import {
  EMPTY,
  expire,
  nextExpiry,
  observe,
  type Mark,
  type PracticeState,
} from '../lib/practice';

/** One shared empty map, so a switched-off hook returns a stable object. */
const NOTHING: Record<number, Mark> = {};

export interface Practice {
  /** The latest attempt at each pitch, by midi number. */
  marks: Record<number, Mark>;
  /** The attempt that has just counted. Null on every other render. */
  committed: Mark | null;
  reset: () => void;
}

/**
 * Remember how each note was played.
 *
 * The accumulating state lives in a ref and only the marks are mirrored into
 * React state, because the detector reports about sixty times a second and the
 * bed only needs re-rendering when what it is showing actually changed.
 *
 * Fading is one scheduled timeout rather than a tick: most of the time nothing
 * is due, and on "no fade" nothing ever is.
 */
export function usePractice(
  match: PitchMatch | null,
  tolerance: number,
  holdMs: number | null,
  enabled: boolean,
): Practice {
  const state = useRef<PracticeState>(EMPTY);
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [committed, setCommitted] = useState<Mark | null>(null);

  // Take each reading as it arrives. This is accumulation over a stream, not
  // state derived from props: what the bed shows depends on every reading so
  // far, so there is nothing to compute during render instead.
  useEffect(() => {
    if (!enabled || match === null) return;

    const step = observe(
      state.current,
      { at: performance.now(), midi: match.note.midi, cents: match.cents },
      tolerance,
    );

    state.current = step.state;
    setMarks(step.state.marks);
    setCommitted(step.committed);
  }, [match, enabled, tolerance]);

  // Switching off wipes the slate, so turning it back on starts a session
  // rather than resuming one from an hour ago. The accumulator is a ref, so
  // this is a write rather than a state change — there is nothing to render
  // until the next reading arrives, and what is shown is derived below.
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    if (wasEnabled.current === enabled) return;

    state.current = EMPTY;
    wasEnabled.current = enabled;
  }, [enabled]);

  // One timeout, set for whenever the oldest mark falls due.
  useEffect(() => {
    const due = nextExpiry(state.current, holdMs);
    if (due === null) return;

    const timer = window.setTimeout(
      () => {
        state.current = expire(state.current, performance.now(), holdMs);
        setMarks(state.current.marks);
      },
      Math.max(0, due - performance.now()),
    );

    return () => window.clearTimeout(timer);
  }, [marks, holdMs]);

  const reset = useCallback(() => {
    state.current = EMPTY;
    setMarks({});
    setCommitted(null);
  }, []);

  // Switched off shows nothing, derived rather than cleared: there is no state
  // to reconcile, and no render where the bed still carries the last session.
  return enabled ? { marks, committed, reset } : { marks: NOTHING, committed: null, reset };
}
