import { spokenLabel, swaraFor, type Notation } from '../lib/notation';
import { Swara } from './swara';
import type { Note } from '../lib/notes';

interface NoteTileProps {
  note: Note;
  onPlay: (note: Note) => void;
  /** Flash from clicking the tile to hear it. */
  isActive: boolean;
  /**
   * Cents off when this note is the one being heard, null when it is not
   * sounding.
   */
  detectedCents?: number | null;
  /** Cents either side of centre that still count as in tune. */
  tolerance: number;
  notation: Notation;
  /** Pitch class shown as Sa. Ignored in Western notation. */
  tonic: number;
}

/**
 * One key on the bed. Naturals are pale caps, accidentals graphite ones,
 * borrowing the keyboard's own encoding.
 *
 * Knows nothing about audio or the microphone — it reports clicks upward and
 * renders the state it is handed.
 */
export function NoteTile({
  note,
  onPlay,
  isActive,
  detectedCents = null,
  tolerance,
  notation,
  tonic,
}: NoteTileProps) {
  const detected = detectedCents !== null;
  const inTune = detected && Math.abs(detectedCents) <= tolerance;

  // Accidentals stay in the light palette, as on the reference hardware,
  // distinguished by a deeper cap and edge rather than going near-black.
  const surface = note.isAccidental
    ? 'border-cap-dark-edge bg-cap-dark bg-none'
    : 'bg-panel border-hairline';

  let state = '';
  if (detected) {
    state = inTune
      ? 'border-intune ring-[2.5px] ring-intune/35 -translate-y-px'
      : 'border-signal ring-[2.5px] ring-signal/35 -translate-y-px';
  } else if (isActive) {
    state = 'keycap-pressed';
  }

  return (
    <button
      type="button"
      onClick={() => onPlay(note)}
      aria-label={`Play ${spokenLabel(note, notation, tonic)}, ${note.frequency.toFixed(2)} hertz`}
      aria-current={detected ? 'true' : undefined}
      className={`keycap keycap-pressable relative flex h-full w-full flex-col items-center justify-center gap-[3px] hover:border-engrave hover:bg-white ${surface} ${state}`}
    >
      <span className="text-[13px] font-medium leading-none tracking-tight tabular-nums">
        {notation === 'sargam' ? (
          <Swara swara={swaraFor(note.midi, tonic)} />
        ) : (
          note.label
        )}
      </span>

      <span
        className={`font-mono text-[9px] leading-none tabular-nums ${
          detected ? (inTune ? 'text-intune' : 'text-signal') : 'text-engrave'
        }`}
      >
        {detected
          ? `${detectedCents > 0 ? '+' : ''}${detectedCents}`
          : note.frequency.toFixed(0)}
      </span>
    </button>
  );
}
