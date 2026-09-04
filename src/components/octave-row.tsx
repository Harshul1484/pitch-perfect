import type { Note, OctaveGroup } from '../lib/notes';
import { NoteTile } from './note-tile';

interface OctaveRowProps {
  group: OctaveGroup;
  onPlay: (note: Note) => void;
  activeMidi: number | null;
  detectedMidi: number | null;
  detectedCents: number | null;
}

export function OctaveRow({
  group,
  onPlay,
  activeMidi,
  detectedMidi,
  detectedCents,
}: OctaveRowProps) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
        Octave {group.octave}
        <span className="ml-2 font-normal normal-case tracking-normal opacity-60">
          {group.notes.length} {group.notes.length === 1 ? 'note' : 'notes'}
        </span>
      </h2>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {group.notes.map((note) => (
          <NoteTile
            key={note.midi}
            note={note}
            onPlay={onPlay}
            isActive={note.midi === activeMidi}
            detectedCents={note.midi === detectedMidi ? detectedCents : null}
          />
        ))}
      </div>
    </section>
  );
}
