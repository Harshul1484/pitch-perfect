import { MAX_GAP_MS, MIN_NOTE_MS, type Sample } from './recording';

/**
 * What the key bed remembers.
 *
 * The bed already tints the note being played, and that tint lasts exactly as
 * long as the note does. A mark is the same judgement kept afterwards, so a
 * scale you have just played is still on the screen to be read — which is the
 * whole of practice mode. The colour was never the feature; the memory is.
 */
export interface Mark {
  midi: number;
  /** Mean cents across the attempt, rounded. */
  cents: number;
  inTune: boolean;
  /**
   * When the attempt was last heard. Refreshed while the note is still
   * sounding, so the fade starts when you leave the pitch rather than when you
   * first found it.
   */
  at: number;
}

export interface PracticeState {
  /** The latest attempt at each pitch, by midi number. */
  marks: Record<number, Mark>;
  /** The attempt in progress: what is being heard, and for how long. */
  pending: {
    midi: number;
    since: number;
    /** The last reading, so a silence can end the attempt. */
    lastAt: number;
    cents: number[];
    committed: boolean;
  } | null;
}

export const EMPTY: PracticeState = { marks: {}, pending: null };

/** How long a mark stays before it fades. Null means "until reset". */
export const HOLDS: { ms: number | null; label: string }[] = [
  { ms: 5_000, label: '5s' },
  { ms: 15_000, label: '15s' },
  { ms: 30_000, label: '30s' },
  { ms: 45_000, label: '45s' },
  { ms: 60_000, label: '1m' },
  { ms: 120_000, label: '2m' },
  { ms: 300_000, label: '5m' },
  { ms: null, label: 'none' },
];

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Take one reading.
 *
 * A pitch has to be held before it marks the bed — the same threshold Quick
 * Record uses to decide what counts as a note. Without it, sliding between
 * notes paints red cells that were never played, and the bed fills with the
 * detector's noise rather than with music.
 *
 * `committed` is set only on the reading where an attempt first counts, so a
 * caller can treat it as an event rather than having to diff the state.
 *
 * An attempt ends when the pitch changes *or* when the readings stop for long
 * enough — the same gap Quick Record uses to keep two separate bows from
 * merging. Without it, playing a note badly, walking away, and coming back to
 * play it well would average the two into one indifferent mark.
 */
export function observe(
  state: PracticeState,
  sample: Sample,
  tolerance: number,
): { state: PracticeState; committed: Mark | null } {
  const continuing =
    state.pending !== null &&
    state.pending.midi === sample.midi &&
    sample.at - state.pending.lastAt <= MAX_GAP_MS;

  const pending = continuing
    ? state.pending!
    : {
        midi: sample.midi,
        since: sample.at,
        lastAt: sample.at,
        cents: [],
        committed: false,
      };

  const cents = [...pending.cents, sample.cents];
  const held = sample.at - pending.since;

  if (held < MIN_NOTE_MS) {
    return {
      state: { ...state, pending: { ...pending, cents, lastAt: sample.at } },
      committed: null,
    };
  }

  const average = Math.round(mean(cents));
  const mark: Mark = {
    midi: sample.midi,
    cents: average,
    inTune: Math.abs(average) <= tolerance,
    at: sample.at,
  };

  return {
    state: {
      marks: { ...state.marks, [sample.midi]: mark },
      pending: { ...pending, cents, lastAt: sample.at, committed: true },
    },
    committed: pending.committed ? null : mark,
  };
}

/**
 * Drop marks whose hold has run out.
 *
 * Returns the state unchanged when nothing went, so a caller can skip
 * re-rendering eighty-eight tiles for no reason.
 */
export function expire(
  state: PracticeState,
  now: number,
  holdMs: number | null,
): PracticeState {
  if (holdMs === null) return state;

  const kept = Object.entries(state.marks).filter(([, mark]) => now - mark.at <= holdMs);
  if (kept.length === Object.keys(state.marks).length) return state;

  return { ...state, marks: Object.fromEntries(kept) };
}

/**
 * When the next mark falls due, so a caller can set one timeout rather than
 * tick. Null when nothing will ever expire.
 */
export function nextExpiry(state: PracticeState, holdMs: number | null): number | null {
  if (holdMs === null) return null;

  const times = Object.values(state.marks).map((mark) => mark.at);
  if (times.length === 0) return null;

  return Math.min(...times) + holdMs;
}

export function reset(): PracticeState {
  return EMPTY;
}
