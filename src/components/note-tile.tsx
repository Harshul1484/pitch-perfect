import type { Note } from '../lib/notes';

interface NoteTileProps {
  note: Note;
  onPlay: (note: Note) => void;
  isActive: boolean;
}

/**
 * A single note. Knows nothing about audio — it reports the click upward and
 * lets the dashboard decide what sounding a note means.
 */
export function NoteTile({ note, onPlay, isActive }: NoteTileProps) {
  const tone = note.isAccidental
    ? 'bg-ink text-white/90 hover:bg-ink/85'
    : 'bg-white text-ink hover:bg-white/70';

  const active = isActive ? 'ring-2 ring-accent scale-95' : 'ring-1 ring-black/10';

  return (
    <button
      type="button"
      onClick={() => onPlay(note)}
      aria-label={`Play ${note.label}, ${note.frequency.toFixed(2)} hertz`}
      className={`flex aspect-square flex-col items-center justify-center rounded-lg transition-all duration-150 ${tone} ${active}`}
    >
      <span className="text-base font-semibold tabular-nums">{note.label}</span>
      <span className="mt-0.5 text-[10px] opacity-60 tabular-nums">
        {note.frequency.toFixed(1)} Hz
      </span>
    </button>
  );
}
