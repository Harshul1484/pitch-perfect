import { ALL_NOTES, HIGHEST_MIDI, LOWEST_MIDI, type Note } from '../lib/notes';
import { BrailleNumber } from './braille';
import { NoteTile } from './note-tile';

const FIRST_OCTAVE = Math.floor(LOWEST_MIDI / 12) - 1;
const LAST_OCTAVE = Math.floor(HIGHEST_MIDI / 12) - 1;
const OCTAVES = Array.from(
  { length: LAST_OCTAVE - FIRST_OCTAVE + 1 },
  (_, index) => FIRST_OCTAVE + index,
);

/** Chromatic column for a note: C is 1, B is 12. */
function columnOf(midi: number): number {
  return (midi % 12) + 1;
}

interface KeybedProps {
  onPlay: (note: Note) => void;
  activeMidi: number | null;
  detectedMidi: number | null;
  detectedCents: number | null;
  tolerance: number;
}

/**
 * The whole key bed as one grid: twelve chromatic columns by nine octave rows.
 *
 * Laying it out as a single grid rather than nine separate rows means every
 * key is the same size and every column lines up, so C is always leftmost and
 * the partial first and last octaves indent the way they do on a real
 * keyboard. The grid stretches to whatever height it is given, which is what
 * lets the instrument fit one screen without scrolling.
 */
export function Keybed({
  onPlay,
  activeMidi,
  detectedMidi,
  detectedCents,
  tolerance,
}: KeybedProps) {
  const detectedOctave = detectedMidi === null ? null : Math.floor(detectedMidi / 12) - 1;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[34px_1fr] gap-2">
      {/* Row legend, one cell per octave, aligned to the key rows. */}
      <div className="grid min-h-0 grid-rows-9 gap-1">
        {OCTAVES.map((octave) => (
          <div key={octave} className="flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-[1px] transition-colors duration-200 ${
                octave === detectedOctave ? 'bg-signal' : 'bg-hairline'
              }`}
            />
            <span className="font-mono text-[10px] leading-none tabular-nums text-graphite">
              {octave}
            </span>
            <BrailleNumber value={octave} />
          </div>
        ))}
      </div>

      <div className="grid min-h-0 grid-cols-12 grid-rows-9 gap-1">
        {ALL_NOTES.map((note) => {
          const row = note.octave - FIRST_OCTAVE + 1;

          return (
            <div
              key={note.midi}
              className="relative min-h-0"
              style={{ gridColumnStart: columnOf(note.midi), gridRowStart: row }}
            >
              <NoteTile
                note={note}
                onPlay={onPlay}
                isActive={note.midi === activeMidi}
                detectedCents={note.midi === detectedMidi ? detectedCents : null}
                tolerance={tolerance}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
