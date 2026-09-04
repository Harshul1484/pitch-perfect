import { IN_TUNE_CENTS, type Note } from '../lib/notes';

interface NoteTileProps {
  note: Note;
  onPlay: (note: Note) => void;
  /** Flash from clicking the tile to hear it. */
  isActive: boolean;
  /**
   * Cents off when this note is the one being heard through the microphone,
   * null when it is not sounding.
   */
  detectedCents?: number | null;
}

/**
 * A single note. Knows nothing about audio or the microphone — it reports
 * clicks upward and renders whatever state it is handed.
 */
export function NoteTile({
  note,
  onPlay,
  isActive,
  detectedCents = null,
}: NoteTileProps) {
  const detected = detectedCents !== null;
  const inTune = detected && Math.abs(detectedCents) <= IN_TUNE_CENTS;

  const tone = note.isAccidental
    ? 'bg-ink text-white/90 hover:bg-ink/85'
    : 'bg-white text-ink hover:bg-white/70';

  let emphasis = 'ring-1 ring-black/10';
  if (detected) {
    emphasis = inTune
      ? 'ring-4 ring-intune shadow-lg shadow-intune/40 scale-105'
      : 'ring-4 ring-offtune shadow-lg shadow-offtune/40 scale-105';
  } else if (isActive) {
    emphasis = 'ring-2 ring-accent scale-95';
  }

  return (
    <button
      type="button"
      onClick={() => onPlay(note)}
      aria-label={`Play ${note.label}, ${note.frequency.toFixed(2)} hertz`}
      aria-current={detected ? 'true' : undefined}
      className={`flex aspect-square flex-col items-center justify-center rounded-lg transition-all duration-150 ${tone} ${emphasis}`}
    >
      <span className="text-base font-semibold tabular-nums">{note.label}</span>
      <span className="mt-0.5 text-[10px] opacity-60 tabular-nums">
        {detected
          ? `${detectedCents > 0 ? '+' : ''}${detectedCents}¢`
          : `${note.frequency.toFixed(1)} Hz`}
      </span>
    </button>
  );
}
