import { swaraFor, type Notation } from '../lib/notation';
import type { PitchMatch } from '../lib/notes';
import type { ListenStatus } from '../hooks/use-pitch-detection';
import { PitchMeter } from './pitch-meter';
import { Swara } from './swara';

interface TunerColumnProps {
  status: ListenStatus;
  match: PitchMatch | null;
  frequency: number | null;
  error: string | null;
  tolerance: number;
  notation: Notation;
  tonic: number;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Everything about the note being played, in one column beside the key bed.
 *
 * The readout used to be a wide bar across the top with a horizontal meter.
 * Standing it up puts the name, the amount you are out, and the meter in a
 * single vertical read, and gives the key bed the full width of the screen —
 * which matters most, since the bed is nine rows deep.
 */
export function TunerColumn({
  status,
  match,
  frequency,
  error,
  tolerance,
  notation,
  tonic,
  onStart,
  onStop,
}: TunerColumnProps) {
  const live = status === 'listening';
  const starting = status === 'starting';
  const inTune = match !== null && Math.abs(match.cents) <= tolerance;

  const tone = match === null ? 'text-hairline' : inTune ? 'text-intune' : 'text-signal';

  return (
    <div className="keycap flex w-[170px] shrink-0 flex-col gap-3 bg-tile p-3">
      <div className="flex flex-col gap-1.5">
        <span className="mono-label">note</span>

        <span
          className={`flex h-[46px] items-center text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums transition-colors duration-200 ${tone}`}
        >
          {match === null ? (
            '––'
          ) : notation === 'sargam' ? (
            <Swara swara={swaraFor(match.note.midi, tonic)} />
          ) : (
            match.note.label
          )}
        </span>

        <span className="font-mono text-[11px] leading-3 tabular-nums text-engrave">
          {frequency === null
            ? '–––.– hz'
            : notation === 'sargam' && match !== null
              ? `${match.note.label} · ${frequency.toFixed(1)} hz`
              : `${frequency.toFixed(1)} hz`}
        </span>

        {/* The reading in words, which the bar alone cannot give. */}
        <span className={`font-mono text-[12px] tabular-nums ${tone}`}>
          {match === null
            ? 'listening'
            : inTune
              ? 'in tune'
              : `${match.cents > 0 ? '+' : ''}${match.cents}¢ ${
                  match.cents > 0 ? 'sharp' : 'flat'
                }`}
        </span>
      </div>

      <span aria-hidden="true" className="h-px w-full shrink-0 bg-hairline-soft" />

      <PitchMeter cents={match?.cents ?? null} tolerance={tolerance} />

      <div className="flex shrink-0 flex-col gap-2">
        <span className="flex h-3 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-[1px] transition-colors duration-200 ${
              live ? 'bg-signal' : starting ? 'bg-engrave' : 'bg-hairline'
            }`}
          />
          <span className="mono-label">{live ? 'live' : starting ? 'wait' : 'idle'}</span>
        </span>

        <button
          type="button"
          onClick={live || starting ? onStop : onStart}
          disabled={starting}
          className={`keycap keycap-pressable flex h-10 items-center justify-center text-[13px] font-medium lowercase tracking-wide hover:border-engrave active:keycap-pressed disabled:cursor-wait ${
            live
              ? 'border-graphite bg-graphite bg-none text-panel hover:bg-graphite'
              : 'hover:bg-white'
          }`}
        >
          {starting ? 'starting' : live ? 'stop' : 'listen'}
        </button>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="border-t border-hairline pt-2 font-mono text-[10px] leading-[1.4] text-signal"
        >
          {error}
        </p>
      )}
    </div>
  );
}
