import { midiFor, type Line, type Token } from './composition';

/**
 * Turning written notation into something playable.
 *
 * Every token occupies exactly one beat, whether it is a note or a hold. That
 * makes the beat number and the token index the same thing, which is why the
 * highlight during playback needs no separate timeline: the beat being played
 * *is* the cell to light up.
 */

export interface PlaybackEvent {
  /** Index of the note across the whole piece, counting every token. */
  tokenIndex: number;
  midi: number;
  /** Length in beats: one, plus any holds that follow. */
  beats: number;
}

export interface Schedule {
  events: PlaybackEvent[];
  /** Total length in beats, which is also the number of tokens. */
  totalBeats: number;
}

/**
 * Flatten the page into notes with durations.
 *
 * A hold extends the note before it. A hold with no note before it — the start
 * of a piece, or after nothing — is silence, and simply takes up its beat.
 */
export function buildSchedule(lines: Line[], tonic: number): Schedule {
  const events: PlaybackEvent[] = [];
  let index = 0;

  const tokens: Token[] = lines.flat();

  for (const token of tokens) {
    if (token.kind === 'note') {
      events.push({ tokenIndex: index, midi: midiFor(token, tonic), beats: 1 });
    } else {
      const last = events[events.length - 1];
      // Only extend a note that runs right up to this beat; a hold after
      // silence is silence.
      if (last && last.tokenIndex + last.beats === index) {
        last.beats += 1;
      }
    }
    index += 1;
  }

  return { events, totalBeats: index };
}

/** Seconds a beat lasts at a given tempo. */
export function beatSeconds(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

/** Which beat is sounding after a given time, or null once the piece ends. */
export function beatAt(
  elapsedSeconds: number,
  bpm: number,
  totalBeats: number,
): number | null {
  if (totalBeats <= 0 || elapsedSeconds < 0) return null;

  const beat = Math.floor(elapsedSeconds / beatSeconds(bpm));
  return beat >= totalBeats ? null : beat;
}
