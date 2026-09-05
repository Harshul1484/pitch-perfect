/**
 * Turning a stream of pitch readings into something worth reviewing.
 *
 * The detector reports roughly sixty times a second. Nobody wants to read
 * that, so consecutive readings of the same note are collapsed into one event
 * with a duration and an average intonation.
 */

export interface Sample {
  /** Milliseconds since recording began. */
  at: number;
  midi: number;
  cents: number;
}

export interface NoteEvent {
  midi: number;
  startMs: number;
  durationMs: number;
  /** Average cents off across the note, rounded. */
  meanCents: number;
  inTune: boolean;
}

export interface RecordingSummary {
  events: NoteEvent[];
  durationMs: number;
  /** How many of the notes landed inside the tolerance. */
  inTuneCount: number;
  /** The note furthest out, or null when nothing was played. */
  worst: NoteEvent | null;
}

/**
 * Shorter than this and it is a passing wobble rather than a note — a bow
 * change, or the detector crossing between two pitches. Including them would
 * bury the real notes in noise.
 */
export const MIN_NOTE_MS = 90;

/**
 * A gap longer than this ends the current note even if the same pitch returns,
 * so two separate bows do not merge into one long note.
 */
export const MAX_GAP_MS = 180;

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Collapse samples into notes.
 *
 * Samples must be in time order, which they are: they come from a loop that
 * only ever appends.
 */
export function summarise(
  samples: Sample[],
  tolerance: number,
  durationMs?: number,
): RecordingSummary {
  const events: NoteEvent[] = [];

  let midi: number | null = null;
  let startMs = 0;
  let lastAt = 0;
  let cents: number[] = [];

  const close = () => {
    if (midi === null) return;

    const length = lastAt - startMs;
    if (length >= MIN_NOTE_MS) {
      const meanCents = Math.round(mean(cents));
      events.push({
        midi,
        startMs,
        durationMs: length,
        meanCents,
        inTune: Math.abs(meanCents) <= tolerance,
      });
    }
    midi = null;
    cents = [];
  };

  for (const sample of samples) {
    const sameNote = sample.midi === midi;
    const continuous = sample.at - lastAt <= MAX_GAP_MS;

    if (!sameNote || !continuous) {
      close();
      midi = sample.midi;
      startMs = sample.at;
    }

    cents.push(sample.cents);
    lastAt = sample.at;
  }
  close();

  const total =
    durationMs ?? (samples.length > 0 ? samples[samples.length - 1].at : 0);

  const worst = events.reduce<NoteEvent | null>(
    (furthest, event) =>
      furthest === null || Math.abs(event.meanCents) > Math.abs(furthest.meanCents)
        ? event
        : furthest,
    null,
  );

  return {
    events,
    durationMs: total,
    inTuneCount: events.filter((event) => event.inTune).length,
    worst,
  };
}

/** Portion of notes that landed in tune, 0 to 1. Null when nothing was played. */
export function accuracy(summary: RecordingSummary): number | null {
  if (summary.events.length === 0) return null;
  return summary.inTuneCount / summary.events.length;
}
