import type { Notation } from '../lib/notation';
import { ALL_NOTES, HIGHEST_MIDI, LOWEST_MIDI, type Note } from '../lib/notes';
import type { Mark } from '../lib/practice';
import { NoteTile } from './note-tile';

const FIRST_OCTAVE = Math.floor(LOWEST_MIDI / 12) - 1;
const LAST_OCTAVE = Math.floor(HIGHEST_MIDI / 12) - 1;
const COLUMNS = 12;

/** Chromatic column for a note: C is 1, B is 12. */
function columnOf(midi: number): number {
  return (midi % 12) + 1;
}

const byPosition = new Map(
  ALL_NOTES.map((note) => [note.octave * COLUMNS + (columnOf(note.midi) - 1), note]),
);

interface KeybedProps {
  notation: Notation;
  tonic: number;
  onPlay: (note: Note) => void;
  activeMidi: number | null;
  detectedMidi: number | null;
  detectedCents: number | null;
  tolerance: number;
  /** What was played earlier in this session, by midi number. */
  marks?: Record<number, Mark>;
  /** The note a piece is waiting for, or null. */
  targetMidi?: number | null;
  /**
   * Show only these octaves, inclusive. The notes page practises one or two
   * octaves at a time and has no room for the other seven.
   */
  octaves?: { from: number; to: number };
}

/**
 * The whole key bed as one plate: twelve chromatic columns by nine octave rows,
 * divided by hairlines rather than split into separate keys.
 *
 * The grid is drawn complete. A piano stops at A0 and C8, so eleven positions
 * have no note; they render as blank cells so the plate stays rectangular
 * instead of ending in a ragged step.
 *
 * Every column is a pitch class, so C is always leftmost and B always
 * rightmost, and the octave rides on each label as a superscript — which is
 * why this needs no separate row legend.
 */
export function Keybed({
  notation,
  tonic,
  onPlay,
  activeMidi,
  detectedMidi,
  detectedCents,
  tolerance,
  marks,
  targetMidi = null,
  octaves,
}: KeybedProps) {
  const from = octaves?.from ?? FIRST_OCTAVE;
  const to = octaves?.to ?? LAST_OCTAVE;
  const rows = to - from + 1;

  const cells = Array.from({ length: rows * COLUMNS }, (_, index) => index);

  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-12 gap-px overflow-hidden rounded-[4px] border border-hairline bg-hairline"
      style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {cells.map((position) => {
        const octave = from + Math.floor(position / COLUMNS);
        const note = byPosition.get(octave * COLUMNS + (position % COLUMNS));

        if (!note) {
          return <span key={position} aria-hidden="true" className="bg-panel" />;
        }

        return (
          <NoteTile
            key={position}
            note={note}
            onPlay={onPlay}
            isActive={note.midi === activeMidi}
            detectedCents={note.midi === detectedMidi ? detectedCents : null}
            tolerance={tolerance}
            notation={notation}
            tonic={tonic}
            mark={marks?.[note.midi] ?? null}
            isTarget={note.midi === targetMidi}
          />
        );
      })}
    </div>
  );
}
