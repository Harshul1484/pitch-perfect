import type { Notation } from '../lib/notation';
import { ALL_NOTES, HIGHEST_MIDI, LOWEST_MIDI, type Note } from '../lib/notes';
import { NoteTile } from './note-tile';

const FIRST_OCTAVE = Math.floor(LOWEST_MIDI / 12) - 1;
const LAST_OCTAVE = Math.floor(HIGHEST_MIDI / 12) - 1;
const ROWS = LAST_OCTAVE - FIRST_OCTAVE + 1;
const COLUMNS = 12;

/** Chromatic column for a note: C is 1, B is 12. */
function columnOf(midi: number): number {
  return (midi % 12) + 1;
}

/** Every cell position, so the plate stays a clean rectangle. */
const CELLS = Array.from({ length: ROWS * COLUMNS }, (_, index) => index);

const byPosition = new Map(
  ALL_NOTES.map((note) => [
    (note.octave - FIRST_OCTAVE) * COLUMNS + (columnOf(note.midi) - 1),
    note,
  ]),
);

interface KeybedProps {
  notation: Notation;
  tonic: number;
  onPlay: (note: Note) => void;
  activeMidi: number | null;
  detectedMidi: number | null;
  detectedCents: number | null;
  tolerance: number;
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
}: KeybedProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-9 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline">
      {CELLS.map((position) => {
        const note = byPosition.get(position);

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
          />
        );
      })}
    </div>
  );
}
