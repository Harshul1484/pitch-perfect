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

/** Cents at the edge of a tile's meter. Beyond this the marker pins. */
const METER_RANGE = 50;
/** How much of the tile height the marker may travel, either side of centre. */
const TRAVEL = 34;

/**
 * One cell of the key bed.
 *
 * Flat, not a keycap: the bed reads as one engraved plate divided by hairlines
 * rather than 88 separate objects, which at this density is calmer and lets
 * state be shown by a tint instead of a ring.
 *
 * When a note is heard, the cell becomes its own little meter — a fixed line
 * at the true pitch and a marker riding above or below it. Reading the amount
 * you are out on the note you are out on beats looking somewhere else for it.
 *
 * Knows nothing about audio or the microphone: it reports clicks upward and
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

  // Accidentals are a shade cooler rather than a different colour. The
  // distinction should be findable, not loud.
  const base = note.isAccidental ? 'bg-recess' : 'bg-panel';

  // State is a wash laid over that base, not a replacement for it. Replacing
  // it let the translucent colour composite against the grid lines showing
  // through, which turned a light red into mud.
  let wash = '';
  let ink = 'text-graphite/75';

  if (inTune) {
    wash = 'bg-intune/20';
    ink = 'text-intune';
  } else if (detected) {
    wash = 'bg-signal/10';
    ink = 'text-graphite';
  } else if (isActive) {
    wash = 'bg-graphite/8';
    ink = 'text-graphite';
  }

  /** A stable name for what this key is showing, for tests and styling alike. */
  const state = inTune ? 'in-tune' : detected ? 'out' : isActive ? 'active' : 'idle';

  // Sharp rides above the line, flat below.
  const marker =
    detectedCents === null
      ? 50
      : 50 -
        (Math.max(-METER_RANGE, Math.min(METER_RANGE, detectedCents)) / METER_RANGE) *
          TRAVEL;

  return (
    <button
      type="button"
      onClick={() => onPlay(note)}
      aria-label={`Play ${spokenLabel(note, notation, tonic)}, ${note.frequency.toFixed(2)} hertz`}
      aria-current={detected ? 'true' : undefined}
      data-state={state}
      title={`${note.label} · ${note.frequency.toFixed(2)} Hz`}
      className={`group relative flex h-full w-full items-center justify-center overflow-hidden transition-colors duration-150 ${base} ${ink}`}
    >
      {/* The state wash, over an opaque key rather than over the grid. */}
      <span
        aria-hidden="true"
        className={`absolute inset-0 transition-colors duration-150 group-hover:bg-white/60 ${wash}`}
      />
      {detected && (
        <>
          {/* The true pitch, and where you actually are. Both are drawn as a
              pair of stubs so the note name stays legible between them. */}
          {['left-0.5', 'right-0.5'].map((side) => (
            <span
              key={`target-${side}`}
              aria-hidden="true"
              className={`absolute top-1/2 h-0.5 w-[26%] -translate-y-1/2 bg-graphite/45 ${side}`}
            />
          ))}
          {['left-0.5', 'right-0.5'].map((side) => (
            <span
              key={`marker-${side}`}
              aria-hidden="true"
              className={`absolute h-0.5 w-[26%] -translate-y-1/2 rounded-full transition-[top] duration-100 ease-out ${side} ${
                inTune ? 'bg-intune' : 'bg-signal'
              }`}
              style={{ top: `${marker}%` }}
            />
          ))}
        </>
      )}

      <span className="relative flex items-baseline gap-1">
        {notation === 'sargam' ? (
          <Swara swara={swaraFor(note.midi, tonic)} className="text-[14px]" />
        ) : (
          <span className="text-[14px] leading-none tracking-tight">
            {note.name}
            <sup className="ml-px text-[9px] font-medium tabular-nums opacity-70">
              {note.octave}
            </sup>
          </span>
        )}

        {detected && (
          <span className="font-mono text-[9px] leading-none tabular-nums">
            {detectedCents > 0 ? '+' : ''}
            {detectedCents}
          </span>
        )}
      </span>
    </button>
  );
}
