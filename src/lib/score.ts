import { MAX_BPM, MIN_BPM } from './metronome';

/**
 * The most MusicXML a single piece may carry.
 *
 * A Firestore document is capped at a little under 1 MB, and this sits beside
 * the notation and the title in the same document. 200 KB is far more than a
 * single-staff melody needs — the fixtures run to a few kilobytes — while
 * still leaving the document room to spare if a scan comes back verbose.
 */
export const MAX_SCORE_XML = 200_000;

/** Beats in a bar, and which note gets the beat. */
const MIN_BEAT = 1;
const MAX_BEAT = 32;

export interface ScoreData {
  /** Bumped if the stored shape ever changes; old documents stay readable. */
  version: 1;
  musicXml: string;
  /** Whether this came from a scanned sheet or was engraved from the notes. */
  source: 'imported' | 'generated';
  timeSignature: { beats: number; beatType: number };
  tempo: number;
}

const SOURCES = ['imported', 'generated'] as const;

function isCount(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_BEAT &&
    value <= MAX_BEAT
  );
}

/**
 * Whether a value read back out of Firestore is score data.
 *
 * This is a boundary, not a formality. What comes out of a document is
 * whatever is in it, which is not necessarily what was last written — an older
 * build, a partial write, or a client that has been tampered with can all put
 * something else there. Everything past this guard may assume the shape, so
 * the guard checks the bounds as well: the security rules enforce the same
 * limits on the way in, and a document that predates them still has to be
 * rejected on the way out rather than trusted because it arrived.
 *
 * The XML itself is not parsed here. That costs a DOM parse on every snapshot
 * for every piece, and a string that is well-formed XML is still not
 * necessarily a score — the conversion is where that gets decided.
 */
export function isScoreData(value: unknown): value is ScoreData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const score = value as Record<string, unknown>;

  if (score.version !== 1) return false;

  if (typeof score.source !== 'string') return false;
  if (!SOURCES.includes(score.source as (typeof SOURCES)[number])) return false;

  if (typeof score.musicXml !== 'string') return false;
  if (score.musicXml.length === 0 || score.musicXml.length > MAX_SCORE_XML) return false;

  const time = score.timeSignature;
  if (typeof time !== 'object' || time === null || Array.isArray(time)) return false;
  const { beats, beatType } = time as Record<string, unknown>;
  if (!isCount(beats) || !isCount(beatType)) return false;

  // The same range the metronome accepts, because this tempo is what the
  // metronome is set to when a piece is opened.
  return (
    typeof score.tempo === 'number' &&
    Number.isFinite(score.tempo) &&
    score.tempo >= MIN_BPM &&
    score.tempo <= MAX_BPM
  );
}
