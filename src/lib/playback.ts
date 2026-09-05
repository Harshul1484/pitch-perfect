import { midiFor, type Line } from './composition';

/**
 * Turning written notation into something playable.
 *
 * A beat is the unit. A plain note takes one; notes tied together share one
 * between them, which is what the curved tie in a notebook means; a hold adds
 * a beat to the note before it; and a bar line takes none at all, being a
 * marker rather than a sound.
 */

export interface Placed {
  /** Index of the token across the whole piece, bars and holds included. */
  tokenIndex: number;
  /** Beats from the start. Fractional inside a tied group. */
  startBeat: number;
  /** Length in beats. Zero for a bar line. */
  beats: number;
  /** Pitch to sound, or null for a hold or a bar. */
  midi: number | null;
}

export interface Schedule {
  placed: Placed[];
  totalBeats: number;
}

/** Flatten the page into placed tokens, each with a time and a length. */
export function buildSchedule(lines: Line[], tonic: number): Schedule {
  const tokens = lines.flat();
  const placed: Placed[] = [];

  let beat = 0;
  let unitStart = 0;
  let unit: { tokenIndex: number; midi: number }[] = [];
  /** Where in `placed` the last sounding note went, so a hold can extend it. */
  let lastSounding = -1;

  const flush = () => {
    if (unit.length === 0) return;

    const share = 1 / unit.length;
    unit.forEach((note, position) => {
      placed.push({
        tokenIndex: note.tokenIndex,
        startBeat: unitStart + position * share,
        beats: share,
        midi: note.midi,
      });
      lastSounding = placed.length - 1;
    });

    unit = [];
    beat = unitStart + 1;
  };

  tokens.forEach((token, tokenIndex) => {
    if (token.kind === 'bar') {
      flush();
      placed.push({ tokenIndex, startBeat: beat, beats: 0, midi: null });
      return;
    }

    if (token.kind === 'sustain') {
      flush();
      placed.push({ tokenIndex, startBeat: beat, beats: 1, midi: null });
      // A hold lengthens the note it follows. After silence it is just silence.
      if (lastSounding >= 0) placed[lastSounding].beats += 1;
      beat += 1;
      return;
    }

    if (token.grouped) {
      if (unit.length === 0) unitStart = beat;
    } else {
      flush();
      unitStart = beat;
    }

    unit.push({ tokenIndex, midi: midiFor(token, tonic) });
  });

  flush();

  return { placed, totalBeats: beat };
}

/** Seconds a beat lasts at a given tempo. */
export function beatSeconds(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

/** How many beats have passed, as a fraction. Null once the piece is over. */
export function beatAt(
  elapsedSeconds: number,
  bpm: number,
  totalBeats: number,
): number | null {
  if (totalBeats <= 0 || elapsedSeconds < 0) return null;

  const beat = elapsedSeconds / beatSeconds(bpm);
  return beat >= totalBeats ? null : beat;
}

/**
 * Which token to highlight at a given moment.
 *
 * A held note and the hold that extends it cover the same beats, so more than
 * one token can match. The latest to start wins, which walks the highlight
 * along the page cell by cell — the way you read it — instead of parking it on
 * the note for the whole of a long hold.
 *
 * Bars are skipped: they occupy no time, so nothing is ever "on" one.
 */
export function tokenAtBeat(schedule: Schedule, beat: number | null): number | null {
  if (beat === null) return null;

  const current = schedule.placed.reduce<Placed | null>((best, item) => {
    const covers =
      item.beats > 0 && beat >= item.startBeat && beat < item.startBeat + item.beats;
    if (!covers) return best;
    return best === null || item.startBeat >= best.startBeat ? item : best;
  }, null);

  return current?.tokenIndex ?? null;
}
