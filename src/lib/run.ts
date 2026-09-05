import { beatSeconds, type Schedule } from './playback';
import type { Sample } from './recording';

/**
 * Scoring a piece played in time.
 *
 * A run is a recording judged against a schedule, and both of those already
 * exist: `buildSchedule` says which note owns which beats, and the recorder
 * already collects timestamped readings. So playing a piece to the metronome
 * needs no clock of its own and no new way of listening — only this.
 */

export type Verdict = 'hit' | 'out' | 'wrong' | 'missed';

export interface Graded {
  /** Where this note sits on the page, so the page can colour it. */
  tokenIndex: number;
  expected: number;
  /** What was heard on that beat, or null if nothing was. */
  played: number | null;
  cents: number | null;
  verdict: Verdict;
}

export interface RunResult {
  notes: Graded[];
  hits: number;
  total: number;
}

/**
 * The pitch heard most often in a window, which is the note that was played.
 *
 * Taking the majority rather than the first reading matters: the detector
 * crosses through neighbouring pitches on the way to a note, and a bow change
 * at the start of a beat should not decide what the whole beat was.
 */
function dominant(samples: Sample[]): { midi: number; cents: number } | null {
  if (samples.length === 0) return null;

  const groups = new Map<number, Sample[]>();
  for (const sample of samples) {
    groups.set(sample.midi, [...(groups.get(sample.midi) ?? []), sample]);
  }

  const [midi, group] = [...groups.entries()].reduce((best, entry) =>
    entry[1].length > best[1].length ? entry : best,
  );

  const cents = group.reduce((total, sample) => total + sample.cents, 0) / group.length;
  return { midi, cents: Math.round(cents) };
}

/** Score a run against the piece it was meant to be. */
export function grade(
  schedule: Schedule,
  samples: Sample[],
  bpm: number,
  tolerance: number,
): RunResult {
  const perBeatMs = beatSeconds(bpm) * 1000;

  const notes: Graded[] = schedule.placed
    .filter((item) => item.midi !== null)
    .map((item) => {
      const from = item.startBeat * perBeatMs;
      const to = from + item.beats * perBeatMs;
      const expected = item.midi as number;

      const heard = dominant(
        samples.filter((sample) => sample.at >= from && sample.at < to),
      );

      if (heard === null) {
        return {
          tokenIndex: item.tokenIndex,
          expected,
          played: null,
          cents: null,
          verdict: 'missed' as const,
        };
      }

      const verdict: Verdict =
        heard.midi !== expected
          ? 'wrong'
          : Math.abs(heard.cents) <= tolerance
            ? 'hit'
            : 'out';

      return {
        tokenIndex: item.tokenIndex,
        expected,
        played: heard.midi,
        cents: heard.cents,
        verdict,
      };
    });

  return {
    notes,
    hits: notes.filter((note) => note.verdict === 'hit').length,
    total: notes.length,
  };
}
