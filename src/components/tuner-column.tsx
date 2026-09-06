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

  // Hairline is a border colour; as 40px text it measured 1.9:1, which is not
  // text at all. Waiting for a note is a quiet state, not an invisible one.
  const tone = match === null ? 'text-engrave' : inTune ? 'text-intune' : 'text-signal';

  return (
    <div className="keycap relative flex min-h-0 w-[170px] shrink-0 flex-1 flex-col gap-3 bg-tile p-3 tall:w-[196px] narrow:w-[126px] short:gap-1 short:p-1.5">
      {/*
       * The note is the one thing you read with the instrument under your
       * chin, so where the screen has height to spare it is set large. Growing
       * the whole panel was tried first and was worse: it pushed the metronome
       * off the bottom and left the readout adrift in an empty box.
       */}
      <div className="flex shrink-0 flex-col gap-1.5 short:gap-1">
        <span className="mono-label">note</span>

        <span
          className={`flex h-[46px] items-center text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums transition-colors duration-200 tall:h-[68px] tall:text-[60px] short:h-[28px] short:text-[24px] ${tone}`}
        >
          {match === null ? (
            '––'
          ) : notation === 'sargam' ? (
            <Swara swara={swaraFor(match.note.midi, tonic)} />
          ) : (
            match.note.label
          )}
        </span>

        <span className="font-mono text-[11px] leading-3 tabular-nums text-engrave short:text-[9px]">
          {frequency === null
            ? '–––.– hz'
            : notation === 'sargam' && match !== null
              ? `${match.note.label} · ${frequency.toFixed(1)} hz`
              : `${frequency.toFixed(1)} hz`}
        </span>

        {/*
         * The reading in words, which the bar alone cannot give — and, before
         * there is a reading, what to do about it. This said "listening" while
         * the microphone was shut, which was both untrue and the only place a
         * first-time player might have been told how to start.
         */}
        <span className={`font-mono text-[12px] tabular-nums short:text-[10px] ${tone}`}>
          {match === null
            ? live
              ? 'listening'
              : starting
                ? 'starting'
                : /* The phone column is 126px wide, where the fuller sentence
                     wraps to three lines and pushes the panel off the screen. */
                  [
                    'press listen',
                    <span key="then" className="narrow:hidden">
                      , then play
                    </span>,
                  ]
            : inTune
              ? 'in tune'
              : `${match.cents > 0 ? '+' : ''}${match.cents}¢ ${
                  match.cents > 0 ? 'sharp' : 'flat'
                }`}
        </span>
      </div>

      {/*
       * When the microphone could not be opened there is nothing to meter, and
       * on a phone the message needs the room the meter would take. Everywhere
       * else there is space for both, so both stay.
       */}
      <div
        className={`flex min-h-0 flex-1 flex-col justify-center gap-3 short:gap-1 ${
          error === null ? '' : 'short:hidden'
        }`}
      >
        <span aria-hidden="true" className="h-px w-full shrink-0 bg-hairline-soft" />

        <PitchMeter cents={match?.cents ?? null} tolerance={tolerance} />
      </div>

      <div className="flex shrink-0 flex-col gap-2 short:gap-1">
        {/*
         * On a phone this moves out of the column and into the free corner
         * beside the "note" label: the same one indicator, sited where there
         * is room for it, rather than a second copy of it.
         */}
        <span className="flex h-3 items-center gap-1.5 short:absolute short:right-1.5 short:top-1.5">
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
          className={`keycap keycap-pressable flex h-10 items-center justify-center text-[13px] font-medium lowercase tracking-wide hover:border-engrave active:keycap-pressed disabled:cursor-wait short:h-8 short:text-[12px] ${
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
